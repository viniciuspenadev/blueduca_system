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

        // MANUAL AUTH CHECK (Required for --no-verify-jwt CORS fix)
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization Header' }), { status: 401, headers: corsHeaders })
        }
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid User Token' }), { status: 401, headers: corsHeaders })
        }

        const { action, installment_id, payload } = await req.json()

        // 1. Buscar Installment (Para saber de qual escola é)
        const { data: inst, error: instError } = await supabaseClient
            .from('installments')
            .select('*, school_id') // Garantir que school_id venha
            .eq('id', installment_id)
            .single()

        if (instError || !inst) throw new Error('Cobrança não encontrada.')

        // 2. Validar e Buscar Gateway Config DA ESCOLA
        const { data: settingsData, error: settingsError } = await supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'finance_gateway_config')
            .eq('school_id', inst.school_id) // FILTRO CRUCIAL
            .single()

        if (settingsError || !settingsData?.value) throw new Error('Gateway não configurado para esta escola.')

        const config = typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value
        if (config.provider !== 'asaas' || !config.api_key) throw new Error('Asaas não configurado corretamente.')

        const ASAAS_URL = config.environment === 'production'
            ? 'https://api.asaas.com/api/v3'
            : 'https://sandbox.asaas.com/api/v3'

        const ASAAS_HEADERS = {
            'Content-Type': 'application/json',
            'access_token': config.api_key
        }

        // ==========================================
        // ACTION: CANCEL
        // ==========================================
        if (action === 'cancel') {
            if (inst.gateway_integration_id) {
                // Cancelar no Asaas
                const res = await fetch(`${ASAAS_URL}/payments/${inst.gateway_integration_id}`, {
                    method: 'DELETE',
                    headers: ASAAS_HEADERS
                })
                const data = await res.json()
                if (!res.ok) throw new Error(`Erro Asaas: ${data.errors?.[0]?.description || JSON.stringify(data)}`)
            }

            // Cancelar Localmente
            const { error: updError } = await supabaseClient
                .from('installments')
                .update({
                    status: 'cancelled',
                    is_published: false // Hide from parents
                })
                .eq('id', installment_id)

            if (updError) throw updError

            return new Response(JSON.stringify({ success: true, message: 'Cobrança cancelada.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // ==========================================
        // ACTION: UPDATE_VALUE (Negotiation)
        // ==========================================
        if (action === 'update_value') {
            const { newValue, due_date, discount_value, surcharge_value, negotiation_notes, negotiation_type } = payload

            if (inst.gateway_integration_id) {
                // Atualizar no Asaas
                const updatePayload = {
                    value: newValue,
                    dueDate: due_date || inst.due_date
                }

                const res = await fetch(`${ASAAS_URL}/payments/${inst.gateway_integration_id}`, {
                    method: 'POST', // Asaas uses POST for specific updates or PUT for full update. Usually POST /payments/{id} works for updates.
                    headers: ASAAS_HEADERS,
                    body: JSON.stringify(updatePayload)
                })

                const data = await res.json()
                if (!res.ok) throw new Error(`Erro Asaas: ${data.errors?.[0]?.description || JSON.stringify(data)}`)
            }

            // Atualizar Localmente
            const { error: updError } = await supabaseClient
                .from('installments')
                .update({
                    value: newValue,
                    discount_value,
                    surcharge_value,
                    negotiation_notes,
                    negotiation_type,
                    negotiation_date: new Date().toISOString(),
                    due_date: due_date || inst.due_date
                })
                .eq('id', installment_id)

            if (updError) throw updError

            return new Response(JSON.stringify({ success: true, message: 'Valor atualizado.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        throw new Error('Ação inválida.')

    } catch (error) {
        console.error('Fatal Error:', error)
        const errorBody = {
            error: error.message || String(error),
            details: error instanceof Error ? error.stack : undefined
        }
        return new Response(JSON.stringify(errorBody), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
