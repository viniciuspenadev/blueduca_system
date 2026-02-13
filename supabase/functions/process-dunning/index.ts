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

    // timezone handling: default to America/Sao_Paulo (UTC-3) for processing
    const body = await req.json().catch(() => ({}));

    let todayStr;
    if (body.targetDate) {
        todayStr = body.targetDate;
        console.log(`Using manual target date: ${todayStr}`);
    } else {
        // Simple BRT offset (UTC-3)
        const brDate = new Date(new Date().getTime() - (3 * 60 * 60 * 1000));
        todayStr = brDate.toISOString().split('T')[0];
    }

    console.log(`--- Dunning Sweep Started: ${todayStr} ---`);

    try {
        const { data: schools } = await supabase.from('schools').select('*').eq('active', true);
        const summary = [];

        for (const school of schools || []) {
            if (!school.config_modules?.dunning) continue;

            const { data: activeSetting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('school_id', school.id)
                .eq('key', 'finance_dunning_active')
                .maybeSingle();

            if (activeSetting?.value !== true && activeSetting?.value !== 'true') continue;

            // Iterate over each active step individually
            const { data: steps } = await supabase.from('dunning_steps').select('*').eq('school_id', school.id).eq('event_type', 'DUE_DATE').eq('active', true);

            for (const step of steps || []) {
                const targetDate = new Date(todayStr);
                targetDate.setUTCDate(targetDate.getUTCDate() - step.day_offset);
                const dateString = targetDate.toISOString().split('T')[0];

                // Fetch installments ONLY for this specific step/date
                const { data: installments } = await supabase
                    .from('installments')
                    .select(`
                        id, value, due_date, billing_url, enrollment_id,
                        enrollments (
                            id, candidate_name, details, student_id
                        )
                    `)
                    .eq('school_id', school.id)
                    .eq('status', 'pending')
                    .eq('due_date', dateString);

                if (!installments || installments.length === 0) continue;

                // Group by student within THIS step only
                const stepGroups: Record<string, any[]> = {};
                for (const inst of installments) {
                    if (!stepGroups[inst.enrollment_id]) stepGroups[inst.enrollment_id] = [];
                    stepGroups[inst.enrollment_id].push(inst);
                }

                for (const enrollmentId in stepGroups) {
                    const group = stepGroups[enrollmentId];
                    const instIds = group.map(i => i.id);

                    // Check if specifically THESE items were already sent for THIS step
                    const { data: existingLogs } = await supabase.from('dunning_logs')
                        .select('installment_id')
                        .in('installment_id', instIds)
                        .eq('step_id', step.id);

                    const alreadySentIds = (existingLogs || []).map((l: any) => l.installment_id);
                    const pendingInGroup = group.filter(i => !alreadySentIds.includes(i.id));

                    if (pendingInGroup.length === 0) continue;

                    if (pendingInGroup.length === 0) continue;

                    // Enqueue message for this specific step group
                    // Pass enroll data from the first item
                    await enqueueInstallmentGroup(supabase, school.id, pendingInGroup, step, pendingInGroup[0].enrollments);
                    summary.push({ student: pendingInGroup[0].enrollments?.candidate_name || 'Desconhecido', count: pendingInGroup.length, step: step.id });
                }
            }
        }

        return new Response(JSON.stringify({ success: true, enqueued_groups: summary.length, details: summary }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});

async function enqueueInstallmentGroup(supabase: any, schoolId: string, group: any[], step: any, enroll: any) {
    if (!enroll) return;

    // Check if WhatsApp is active for this school
    const { data: waConfig } = await supabase.from('app_settings').select('value').eq('school_id', schoolId).eq('key', 'whatsapp_config').maybeSingle();
    const config = typeof waConfig?.value === 'string' ? JSON.parse(waConfig.value) : waConfig?.value;
    if (!config?.active) return;

    const student = enroll.candidate_name || 'Aluno';
    const guardian = enroll.details?.parent_name || 'Responsável';
    const phone = enroll.details?.parent_phone;
    if (!phone) return;

    // Prepare Payload
    const totalValue = group.reduce((sum: number, inst: any) => sum + inst.value, 0);
    const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue);
    const firstDueDate = new Date(group[0].due_date + 'T12:00:00').toLocaleDateString('pt-BR');
    const dueDate = group.length > 1 ? firstDueDate : firstDueDate;
    const link = group[0].billing_url || '';

    // We don't build the final message here IF we want the worker to be dynamic, 
    // BUT for simplicity and consistency with current logic, let's build the metadata here
    // or pass the raw data for the worker to build.
    // Let's pass the RAW data so the Worker can fetch the latest template version if needed, 
    // OR build it here to lock the version. 
    // DECISION: Build params here, let worker assemble text.

    // Calculate Priority (Creation = HIGH)
    const priority = step.event_type === 'CREATION' ? 2 : 1;

    const payload = {
        type: 'dunning',
        school_id: schoolId,
        student_id: enroll.id, // Assuming enroll has student info or we use enroll id
        phone: phone,
        params: {
            student_name: student,
            parent_name: guardian,
            amount: amount,
            due_date: dueDate,
            link: link,
            count: group.length
        },
        template_key: step.template_key,
        step_id: step.id,
        installment_ids: group.map((i: any) => i.id)
    };

    // Insert into Queue
    const { error } = await supabase.from('notification_queue').insert({
        school_id: schoolId,
        payload: payload,
        status: 'PENDING',
        priority: priority
    });

    // ==========================================
    // PUSH NOTIFICATION: Regularize (Atraso)
    // ==========================================
    try {
        const studentId = enroll.student_id || enroll.details?.student_id;
        if (studentId) {
            const { data: guardians } = await supabase.from('student_guardians').select('guardian_id').eq('student_id', studentId);
            if (guardians && guardians.length > 0) {
                const uniqueUserIds = [...new Set(guardians.map((g: any) => g.guardian_id))];
                for (const userId of uniqueUserIds) {
                    try {
                        await supabase.functions.invoke('send-push', {
                            body: {
                                user_id: userId,
                                title: "⚠️ Regularize",
                                body: `Olá! Identificamos que a fatura de ${student} ainda está pendente.`,
                                url: "/pais/financeiro"
                            }
                        });
                    } catch (e) { console.error('Push error:', e); }
                }
            }
        }
    } catch (pushErr) {
        console.error('Dunning push logic failed:', pushErr);
    }

    if (error) console.error('Error enqueueing:', error);
}
