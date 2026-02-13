// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(supabaseUrl, serviceRole!);

    console.log('--- Queue Worker Started ---');

    try {
        // 1. Fetch and Lock Pending Items (Atomic-ish via RPC or specific fetch-update pattern)
        // ideally uses a stored procedure for true atomicity, but for now we do select-update

        // Fetch 50 pending items
        const { data: items, error: fetchError } = await supabase
            .from('notification_queue')
            .select('*')
            .eq('status', 'PENDING')
            .order('priority', { ascending: false }) // High priority first
            .order('created_at', { ascending: true }) // Oldest first
            .limit(50);

        if (fetchError) throw fetchError;

        if (!items || items.length === 0) {
            return new Response(JSON.stringify({ message: 'Queue empty' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const itemIds = items.map((i: any) => i.id);

        // Mark as PROCESSING
        await supabase
            .from('notification_queue')
            .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
            .in('id', itemIds);

        const results = [];

        // 2. Process Items
        for (const item of items) {
            let status = 'DONE';
            let errorMsg = null;

            try {
                // Parse payload
                const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;

                // TODO: CHECK LIMITS HERE (Logic added as per plan)
                // We check existing usage
                const { data: usage } = await supabase.from('school_usage_trackers').select('messages_sent_count, limit_messages').eq('school_id', item.school_id).single();

                // If usage tracking exists and limit is reached
                if (usage && usage.limit_messages > 0 && usage.messages_sent_count >= usage.limit_messages) {
                    throw new Error('Monthly limit exceeded');
                }

                // Construct Message
                // We rely on the payload to have the raw params to build the message OR the message itself.
                // In process-dunning, we decided to pass params.

                const { params, template_key } = payload;
                if (!template_key || !params) throw new Error('Invalid payload structure');

                // Generate Text (We fetch template again to ensure latest version is used)
                const { data: dbTemplate } = await supabase.from('wpp_notification_templates').select('*').eq('key', template_key).maybeSingle();

                let rawMessage = dbTemplate?.message_template || `Olá {{parent_name}}, aviso de cobrança.`;
                if (dbTemplate?.title_template) rawMessage = `*${dbTemplate.title_template}*\n\n${rawMessage}`;

                let message = rawMessage;
                // Replace vars
                for (const key of Object.keys(params)) {
                    message = message.replace(new RegExp(`{{${key}}}`, 'g'), params[key]);
                }
                // Legacy replacements just in case
                message = message.replace(/{{responsavel}}/g, params.parent_name)
                    .replace(/{{aluno}}/g, params.student_name)
                    .replace(/{{vencimento}}/g, params.due_date)
                    .replace(/{{valor}}/g, params.amount)
                    .replace(/{{quantidade}}/g, params.count);


                // FAILSAFE: Don't actually send logic if it's a dry run, but real call:
                const { error: sendError } = await supabase.functions.invoke('send-whatsapp', {
                    body: {
                        schoolId: item.school_id,
                        number: payload.phone,
                        message: message
                    }
                });

                if (sendError) throw new Error('Send Function Error: ' + sendError.message);

                // SUCCESS: Log to dunning_logs and Update Usage
                await supabase.from('dunning_logs').insert((payload.installment_ids || []).map((id: string) => ({
                    school_id: item.school_id,
                    installment_id: id,
                    step_id: payload.step_id,
                    status: 'SUCCESS',
                    metadata: { message, aggregated_count: params.count }
                })));

                // Increment Usage
                await supabase.rpc('increment_school_message_usage', { school_id_param: item.school_id });

            } catch (err: any) {
                console.error(`Error processing item ${item.id}:`, err);
                status = 'FAILED';
                errorMsg = err.message;
            }

            // Update item final status
            await supabase
                .from('notification_queue')
                .update({
                    status: status,
                    error_message: errorMsg,
                    attempts: item.attempts + 1,
                    last_attempt_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', item.id);

            results.push({ id: item.id, status });
        }

        return new Response(JSON.stringify({ processed: results.length, details: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
