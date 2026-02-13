import { createClient } from '@supabase/supabase-js';

// Types for the dunning logic
interface DunningStep {
    id: string;
    school_id: string;
    day_offset: number;
    template_key: string;
    custom_message: string;
    use_custom_message: boolean;
    active: boolean;
    event_type?: 'DUE_DATE' | 'CREATION';
}

/**
 * Main Dunning Engine Logic (Backend Reference)
 * This logic should be adapted for a Supabase Edge Function.
 */
export async function processDunning(supabaseUrl: string, serviceRoleKey: string) {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    console.log('Starting Dunning Process at', new Date().toISOString());

    // 1. Fetch active schools with dunning module active in their config
    const { data: schools } = await supabase
        .from('schools')
        .select('id, name, active, config_modules')
        .eq('active', true);

    if (!schools) return;

    for (const school of schools) {
        // Check module via config_modules JSONB
        if (!school.config_modules?.dunning) continue;

        // Check if dunning is operational for this school (global toggle)
        const { data: activeSetting } = await supabase
            .from('app_settings')
            .select('value')
            .eq('school_id', school.id)
            .eq('key', 'finance_dunning_active')
            .maybeSingle();

        if (activeSetting?.value !== true) continue;

        console.log(`Processing school: ${school.name}`);

        // Fetch scheduled steps (DUE_DATE) for this school
        const { data: steps } = await supabase
            .from('dunning_steps')
            .select('*')
            .eq('school_id', school.id)
            .eq('event_type', 'DUE_DATE')
            .eq('active', true);

        if (!steps || steps.length === 0) continue;

        for (const step of steps) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - step.day_offset);
            const dateString = targetDate.toISOString().split('T')[0];

            // Fetch pending installments for this date
            const { data: installments } = await supabase
                .from('installments')
                .select(`
          id, value, due_date, billing_url,
          enrollments (
            candidate_name,
            details,
            student_guardians (
              guardian_profile:profiles (name, email)
            )
          )
        `)
                .eq('school_id', school.id)
                .eq('status', 'pending')
                .eq('due_date', dateString);

            if (!installments || installments.length === 0) continue;

            for (const inst of installments) {
                // Check log to avoid duplicates
                const { data: existingLog } = await supabase
                    .from('dunning_logs')
                    .select('id')
                    .eq('installment_id', inst.id)
                    .eq('step_id', step.id)
                    .maybeSingle();

                if (existingLog) continue;

                await triggerWhatsAppSend(supabase, school.id, inst, step);
            }
        }
    }
}

/**
 * Trigger dunning immediately for a specific event (like CREATION)
 * Supports aggregation if multiple installmentIds are provided (to avoid spam)
 */
export async function triggerImmediateDunning(supabase: any, schoolId: string, installmentIds: string | string[], eventType: 'CREATION') {
    const ids = Array.isArray(installmentIds) ? installmentIds : [installmentIds];

    // 0. Check if dunning is operational
    const { data: activeSetting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('school_id', schoolId)
        .eq('key', 'finance_dunning_active')
        .maybeSingle();

    if (activeSetting?.value !== 'true' && activeSetting?.value !== true) return;

    // 1. Fetch active steps for this event
    const { data: steps } = await supabase
        .from('dunning_steps')
        .select('*')
        .eq('school_id', schoolId)
        .eq('event_type', eventType)
        .eq('active', true);

    if (!steps || steps.length === 0) return;

    // 2. Fetch installments details
    const { data: installments } = await supabase
        .from('installments')
        .select(`
            id, value, due_date, billing_url, enrollment_id,
            enrollments!installments_enrollment_id_fkey (
                candidate_name,
                details
            )
        `)
        .in('id', ids);

    if (!installments || installments.length === 0) return;

    // 3. Group by student (in case of multiple installments creation)
    const groups: Record<string, any[]> = {};
    for (const inst of installments) {
        if (!groups[inst.enrollment_id]) groups[inst.enrollment_id] = [];
        groups[inst.enrollment_id].push(inst);
    }

    // 4. Send aggregated message for each student group
    const isBulk = ids.length > 5;
    for (const enrollmentId in groups) {
        const studentGroup = groups[enrollmentId];
        for (const step of steps) {
            // Pass useQueue = isBulk
            await triggerWhatsAppSend(supabase, schoolId, studentGroup, step, isBulk);
        }
    }
}

async function triggerWhatsAppSend(supabase: any, schoolId: string, instGroup: any | any[], step: DunningStep, useQueue: boolean = true) {
    const group = Array.isArray(instGroup) ? instGroup : [instGroup];
    if (group.length === 0) return;

    const first = group[0];

    const { data: waConfigData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('school_id', schoolId)
        .eq('key', 'whatsapp_config')
        .maybeSingle();

    if (!waConfigData?.value) return;
    const waConfig = typeof waConfigData.value === 'string' ? JSON.parse(waConfigData.value) : waConfigData.value;
    if (!waConfig?.active) return;

    const student = first.enrollments?.candidate_name || 'Aluno';
    const details = first.enrollments?.details || {};
    const guardian = details.parent_name || 'Responsável';
    const phone = details.parent_phone;

    if (!phone) return;

    // Aggregation Logic (Required for both paths)
    const totalValue = group.reduce((sum: number, i: any) => sum + i.value, 0);
    const count = group.length;
    const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue);
    const dueDate = new Date(first.due_date + 'T12:00:00').toLocaleDateString('pt-BR');
    const link = first.billing_url || 'Link no app';

    if (useQueue) {
        // --- PATH A: QUEUE (Bulk / Scalable) ---
        const priority = step.event_type === 'CREATION' ? 2 : 1;
        const payload = {
            type: 'dunning',
            school_id: schoolId,
            student_id: first.enrollment_id,
            phone: phone,
            params: {
                student_name: student,
                parent_name: guardian,
                amount: amount,
                due_date: dueDate,
                link: link,
                count: count
            },
            template_key: step.template_key,
            step_id: step.id,
            installment_ids: group.map((i: any) => i.id)
        };

        const { error: sendError } = await supabase.from('notification_queue').insert({
            school_id: schoolId,
            payload: payload,
            status: 'PENDING',
            priority: priority
        });

        if (sendError) console.error('Error enqueuing dunning:', sendError);
        return;
    }

    // --- PATH B: DIRECT SEND (Manual Trigger / Instant) ---
    const { data: dbTemplate } = await supabase
        .from('wpp_notification_templates')
        .select('*')
        .eq('key', step.template_key)
        .maybeSingle();

    let message = '';
    if (step.use_custom_message && step.custom_message) {
        message = step.custom_message;
    } else if (dbTemplate?.message_template) {
        message = dbTemplate.message_template;
    } else {
        // Fallback default message
        message = `Olá {{responsavel}}, boleto de {{aluno}} vencendo em {{vencimento}}.`;
    }

    if (dbTemplate?.title_template) {
        message = `*${dbTemplate.title_template}*\n\n${message}`;
    }

    message = message
        .replace(/{{aluno}}/g, student)
        .replace(/{{responsavel}}/g, guardian)
        .replace(/{{valor}}/g, amount)
        .replace(/{{vencimento}}/g, dueDate)
        .replace(/{{link_boleto}}/g, link)
        .replace(/{{quantidade}}/g, count.toString())
        .replace(/{{student_name}}/g, student)
        .replace(/{{parent_name}}/g, guardian)
        .replace(/{{amount}}/g, amount)
        .replace(/{{due_date}}/g, dueDate)
        .replace(/{{link}}/g, link);

    const { error: sendError } = await supabase.functions.invoke('send-whatsapp', {
        body: { schoolId, number: phone, message }
    });

    if (sendError) {
        console.error('Direct send error:', sendError);
        return;
    }

    // Since we sent directly, we must log manually (Worker won't do it)
    const logs = group.map((i: any) => ({
        school_id: schoolId,
        installment_id: i.id,
        step_id: step.id,
        status: 'SUCCESS',
        metadata: { message, aggregated_count: count }
    }));

    await supabase.from('dunning_logs').insert(logs);
}
