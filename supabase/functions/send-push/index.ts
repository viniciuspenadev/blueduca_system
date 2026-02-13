import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:vinicius@bluedigitalhub.com.br';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface PushPayload {
    user_id: string;
    title: string;
    body: string;
    url?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    requireInteraction?: boolean;
    strategy?: 'latest_active' | 'broadcast_all';
}

Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            }
        });
    }

    try {
        // Parse request body
        const payload: PushPayload & { communication_id?: string } = await req.json();
        const { user_id, communication_id, title, body, url = '/', icon, badge, tag } = payload;

        // Initialize Supabase client
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let targetSubscriptions = [];

        if (payload.strategy === 'latest_active') {
            const { data: subs, error: fetchError } = await supabase
                .from('user_push_subscriptions')
                .select('id, subscription, user_id')
                .limit(1)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            targetSubscriptions = subs || [];
            console.log(`[Debug] Strategy latest_active selected user: ${targetSubscriptions[0]?.user_id}`);
        } else if (communication_id) {
            console.log(`Processing batch push for communication: ${communication_id}`);

            // 1. Get all recipients for this communication
            const { data: recipients, error: recError } = await supabase
                .from('communication_recipients')
                .select('guardian_id')
                .eq('communication_id', communication_id);

            if (recError) throw recError;

            const uniqueUserIds = [...new Set(recipients?.map((r: any) => r.guardian_id) || [])];
            console.log(`Found ${uniqueUserIds.length} unique guardians to notify`);

            if (uniqueUserIds.length > 0) {
                // 2. Get all subscriptions for these users
                const { data: subs, error: subsError } = await supabase
                    .from('user_push_subscriptions')
                    .select('id, subscription, user_id')
                    .in('user_id', uniqueUserIds);

                if (subsError) throw subsError;
                targetSubscriptions = subs || [];
            }
        } else if (user_id) {
            // INDIVIDUAL SEND
            const { data: subs, error: fetchError } = await supabase
                .from('user_push_subscriptions')
                .select('id, subscription, user_id')
                .eq('user_id', user_id);

            if (fetchError) throw fetchError;
            targetSubscriptions = subs || [];
        } else {
            return new Response(
                JSON.stringify({ error: 'Missing user_id or communication_id' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (targetSubscriptions.length === 0) {
            return new Response(
                JSON.stringify({
                    message: 'No subscriptions found',
                    sent: 0,
                    debug_user_id: user_id,
                    debug_comm_id: communication_id,
                    debug_table_count: (await supabase.from('user_push_subscriptions').select('id', { count: 'exact', head: true })).count
                }),
                { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
        }

        // Prepare notification payload
        const notificationPayload = {
            title: title || 'Notificação da Escola',
            body: body || 'Abra o app para ver os detalhes.',
            icon: icon || '/logo_blueduca.png',
            badge: badge || '/logo_blueduca.png',
            data: { url: communication_id ? `/pais/comunicados/${communication_id}` : url },
            tag: tag || (communication_id ? `comm-${communication_id}` : 'blueduca-notification'),
            requireInteraction: payload.requireInteraction || false,
            vibrate: [200, 100, 200],
        };

        // Send push to all subscriptions
        const results = await Promise.allSettled(
            targetSubscriptions.map(async (sub: any) => {
                try {
                    await webpush.sendNotification(
                        sub.subscription,
                        JSON.stringify(notificationPayload),
                        {
                            vapidDetails: {
                                subject: vapidSubject,
                                publicKey: vapidPublicKey,
                                privateKey: vapidPrivateKey,
                            },
                        }
                    );
                    return { success: true, id: sub.id, user_id: sub.user_id };
                } catch (error: any) {
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await supabase.from('user_push_subscriptions').delete().eq('id', sub.id);
                    }
                    return { success: false, id: sub.id, error: error.message };
                }
            })
        );

        // Count successes and failures
        const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;

        console.log(`Push sent: ${successful} successful, ${failed} failed out of ${results.length} total`);

        return new Response(
            JSON.stringify({
                message: 'Push notifications sent',
                sent: successful,
                failed,
                total: results.length,
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );

    } catch (error: any) {
        console.error('Error in send-push function:', error);
        return new Response(
            JSON.stringify({ error: 'Internal server error', details: error.message }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
            }
        );
    }
});
