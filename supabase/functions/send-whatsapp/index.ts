// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        // 1. Receber payload
        const body = await req.json()
        let record = body.record

        // Suporte para Envio Direto (Bypass database trigger logic)
        const isDirect = !!(body.number && body.message)
        let phone = isDirect ? body.number : null
        let directMessage = isDirect ? body.message : null

        // DEBUG: Logging payload to DB
        await supabaseClient.from('wpp_notification_logs').insert({
            notification_id: record?.id || null,
            channel: isDirect ? 'direct_whatsapp' : 'trigger',
            status: 'received',
            error_message: `Mode: ${isDirect ? 'Direct' : 'Trigger'}`,
            provider_response: body
        })

        if (!isDirect && (!record || !record.user_id || !record.message)) {
            throw new Error('Payload inválido. Esperado número/mensagem ou registro de notificação.')
        }

        console.log(isDirect ? `Processando envio direto para ${phone}` : `Processando notificação ${record.id} para User ${record.user_id}`)

        // 2. Buscar Configuração do Banco (app_settings)
        const { data: settingsData, error: settingsError } = await supabaseClient
            .from('app_settings')
            .select('key, value')
            .in('key', ['whatsapp_config', 'school_info'])

        if (settingsError || !settingsData || settingsData.length === 0) {
            console.error('Erro ao buscar configurações:', settingsError)
            return new Response(JSON.stringify({ error: 'Configuração não encontrada.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
        }

        // Parse Configs
        const whatsappConfigRaw = settingsData.find(s => s.key === 'whatsapp_config')?.value
        const schoolInfoRaw = settingsData.find(s => s.key === 'school_info')?.value

        let whatsappConfig = {}
        let schoolInfo = {}

        try {
            whatsappConfig = typeof whatsappConfigRaw === 'string' ? JSON.parse(whatsappConfigRaw) : whatsappConfigRaw
            schoolInfo = typeof schoolInfoRaw === 'string' ? JSON.parse(schoolInfoRaw) : schoolInfoRaw
        } catch (e) {
            console.error('Erro ao parsear JSON:', e)
        }

        const { url: evolutionUrl, apikey: evolutionKey, instance: instanceName, enabled_channels } = whatsappConfig || {}

        if (!evolutionUrl || !evolutionKey || !instanceName) {
            console.error('Configuração WhatsApp incompleta:', whatsappConfig)
            return new Response(JSON.stringify({ error: 'Configuração WhatsApp incompleta.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
        }

        // Verificar se Canal está Habilitado
        const notificationType = record.type || 'diary' // Default fallback
        if (enabled_channels && enabled_channels[notificationType] === false) {
            console.log(`Canal '${notificationType}' desabilitado. Cancelando envio.`)
            return new Response(JSON.stringify({ message: 'Canal desabilitado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }

        // 3. Buscar Telefone (Se não fornecido diretamente)
        if (!isDirect) {
            // Estratégia Overrride (Para testes manuais do Admin)
            if (record.data && record.data.override_phone) {
                console.log('Usando telefone de override (Teste Manual):', record.data.override_phone)
                phone = record.data.override_phone
            }

            // Estratégia A: Buscar diretamente nos metadados do Usuário (auth.users)
            if (!phone) {
                const { data: userData } = await supabaseClient.auth.admin.getUserById(record.user_id)
                if (userData?.user) {
                    const meta = userData.user.user_metadata || {}
                    phone = meta.phone || meta.mobile || meta.whatsapp || meta.celular
                }
            }

            // Estratégia B: Se não achou, buscar na Matrícula
            if (!phone && record.data && record.data.student_id) {
                const { data: studentData } = await supabaseClient
                    .from('students')
                    .select('financial_responsible')
                    .eq('id', record.data.student_id)
                    .single()

                if (studentData?.financial_responsible) {
                    const finResp = studentData.financial_responsible
                    phone = finResp.phone || finResp.mobile || finResp.celular || finResp.whatsapp
                }
            }
        }

        if (!phone) {
            console.error('Telefone não encontrado para o usuário:', record.user_id)

            // Log de erro no banco
            await supabaseClient.from('wpp_notification_logs').insert({
                notification_id: record.id,
                channel: 'whatsapp',
                status: 'failed',
                error_message: 'Telefone não encontrado para o usuário'
            })

            return new Response(JSON.stringify({ error: 'Telefone não encontrado.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
        }

        // Limpar telefone (apenas números)
        phone = phone.replace(/\D/g, '')
        // Adicionar 55 se não tiver (Assumindo BR)
        if (phone.length <= 11 && !phone.startsWith('55')) phone = '55' + phone

        // [LIMITS CHECK]
        // Get school_id from payload (if available) or user_id context
        // For direct calls, we expect schoolId in body
        const schoolId = body.schoolId || (record?.data?.school_id);

        if (schoolId) {
            const { data: usage } = await supabaseClient
                .from('school_usage_trackers')
                .select('messages_sent_count, limit_messages')
                .eq('school_id', schoolId)
                .single();

            if (usage && usage.limit_messages > 0 && usage.messages_sent_count >= usage.limit_messages) {
                console.error(`Limit Exceeded for School ${schoolId}`);
                await supabaseClient.from('wpp_notification_logs').insert({
                    notification_id: record?.id,
                    channel: 'whatsapp',
                    status: 'failed',
                    error_message: 'Monthly Limit Exceeded'
                });
                return new Response(JSON.stringify({ error: 'Limite mensal de mensagens atingido.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        console.log(`Enviando WhatsApp para ${phone} via instância ${instanceName}...`)

        // 4. Enviar para Evolution API
        // Clean URL trailing slash
        const cleanUrl = evolutionUrl.replace(/\/$/, '')

        const header = schoolInfo?.name || 'BlueEduca Informa'
        const messageText = isDirect ? directMessage : record.message
        const titleText = isDirect ? '' : `*${record.title}*\n`

        const payload = {
            number: phone,
            text: `📢 *${header}*\n\n${titleText}${messageText}`,
            delay: 1200,
            linkPreview: true
        }

        const response = await fetch(`${cleanUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionKey
            },
            body: JSON.stringify(payload)
        })

        let result
        try {
            result = await response.json()
        } catch (e) {
            result = { error: 'Invalid JSON response from Evolution', status: response.status }
        }

        console.log('Evolution API Response:', result)

        // Logar Sucesso/Falha
        const status = (response.ok && (result?.key?.id || result?.message?.key)) ? 'sent' : 'failed'

        await supabaseClient.from('wpp_notification_logs').insert({
            notification_id: record.id,
            status: status,
            provider_response: result,
            error_message: response.ok ? null : `HTTP ${response.status}`
        })

        if (status === 'sent' && body.schoolId) {
            // Increment Usage (Safe RPC)
            await supabaseClient.rpc('increment_school_message_usage', { school_id_param: body.schoolId });
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: response.status,
        })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
