// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const event = await req.json()
        console.log('Webhook Asaas Received:', JSON.stringify(event))

        // Validar Evento
        // Asaas envia: { event: "PAYMENT_RECEIVED", payment: { ... } }
        if (!event.event || !event.payment) {
            return new Response(JSON.stringify({ message: 'Ignored: Invalid Payload' }), { headers: corsHeaders, status: 200 })
        }

        const validEvents = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']
        if (!validEvents.includes(event.event)) {
            console.log(`Evento ignorado: ${event.event}`)
            return new Response(JSON.stringify({ message: 'Ignored: Not a confirmation event' }), { headers: corsHeaders, status: 200 })
        }

        const asaasId = event.payment.id
        const paymentDate = event.payment.paymentDate || new Date().toISOString()
        const billingType = event.payment.billingType // BOLETO, PIX, CREDIT_CARD

        console.log(`Processando pagamento ${asaasId} - Tipo: ${billingType}`)

        // Buscar Parcela
        const { data: installment, error: fetchError } = await supabaseClient
            .from('installments')
            .select('*, enrollments(id, candidate_name, student_id, details)')
            .eq('gateway_integration_id', asaasId)
            .single()

        if (fetchError || !installment) {
            console.error('Parcela não encontrada para este ID Asaas:', asaasId)
            return new Response(JSON.stringify({ error: 'Installment not found' }), { headers: corsHeaders, status: 200 })
        }

        // VALIDAR TOKEN DE SEGURANÇA (MULTI-TENANT)
        // O header 'asaas-access-token' deve bater com o token configurado na escola dona da cobrança
        const receivedToken = req.headers.get('asaas-access-token')
        if (receivedToken && installment.school_id) {
            const { data: settingsData } = await supabaseClient
                .from('app_settings')
                .select('value')
                .eq('key', 'finance_gateway_config')
                .eq('school_id', installment.school_id)
                .single()

            if (settingsData?.value) {
                const config = typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value
                // Se a escola tiver token configurado, valida.
                // Usamos api_key ou um campo webhook_token se existisse. Assumindo api_key por simplificacao ou accessToken
                // Asaas envia o accessToken configurado no webhook.
                if (config.api_key && receivedToken !== config.api_key) {
                    console.error('Token de webhook inválido para esta escola.')
                    // Retornamos 200 para nao travar o Asaas (ele tenta infinito), mas ignoramos
                    return new Response(JSON.stringify({ message: 'Unauthorized webhook source' }), { headers: corsHeaders, status: 200 })
                }
            }
        }

        if (installment.status === 'paid') {
            console.log('Parcela já está paga.')
            return new Response(JSON.stringify({ message: 'Already paid' }), { headers: corsHeaders, status: 200 })
        }

        // Atualizar Status
        const updatePayload = {
            status: 'paid',
            paid_at: paymentDate,
            payment_method: billingType === 'PIX' ? 'pix' : 'boleto'
        }

        const { error: updateError } = await supabaseClient
            .from('installments')
            .update(updatePayload)
            .eq('id', installment.id)

        if (updateError) throw updateError

        console.log(`Parcela ${installment.id} atualizada para PAGO.`)

        // ==========================================
        // NOTIFICAÇÕES: Confirmação de Pagamento
        // ==========================================
        try {
            const enrollData = installment.enrollments;
            if (enrollData) {
                const studentName = enrollData.candidate_name || "Aluno";
                const parentPhone = enrollData.details?.parent_phone;
                const parentName = enrollData.details?.parent_name || "Responsável";
                const amountStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(installment.value);
                const desc = installment.metadata?.description || "Parcela";

                // 1. WhatsApp (Direct Send)
                if (parentPhone) {
                    try {
                        console.log(`Disparando WhatsApp de confirmação para ${parentPhone}`);
                        await supabaseClient.functions.invoke('send-whatsapp', {
                            body: {
                                number: parentPhone,
                                message: `Olá ${parentName}, confirmamos o recebimento do pagamento de *${studentName}* no valor de ${amountStr} (${desc}). Obrigado!`
                            }
                        });
                    } catch (waErr) {
                        console.error('Error sending WhatsApp:', waErr);
                    }
                }

                // 2. Push Notification
                if (enrollData.student_id) {
                    const { data: guardians } = await supabaseClient
                        .from('student_guardians')
                        .select('guardian_id')
                        .eq('student_id', enrollData.student_id);

                    if (guardians && guardians.length > 0) {
                        const uniqueUserIds = [...new Set(guardians.map((g: any) => g.guardian_id))];
                        for (const userId of uniqueUserIds) {
                            try {
                                await supabaseClient.functions.invoke('send-push', {
                                    body: {
                                        user_id: userId,
                                        title: "✅ Pagamento Confirmado",
                                        body: `O pagamento de ${studentName} foi recebido com sucesso!`,
                                        url: "/pais/financeiro"
                                    }
                                });
                            } catch (pushErr) {
                                console.error(`Error sending push to ${userId}:`, pushErr);
                            }
                        }
                    }
                }
            }
        } catch (notifErr) {
            console.error('Error in notification logic:', notifErr);
        }

        return new Response(JSON.stringify({ message: 'Success' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Webhook Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
