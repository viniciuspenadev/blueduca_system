
import { supabase } from './supabase';

export type NotificationChannel = 'whatsapp' | 'email' | 'both';

interface SendOptions {
    schoolId: string;
    recipientPhone?: string;
    recipientEmail?: string;
    templateKey: string;
    variables: Record<string, string>;
    channel?: NotificationChannel;
}

export const NotificationHub = {
    /**
     * Envia uma notificação centralizada.
     * Busca os templates no banco de dados e processa as variáveis.
     */
    async send({
        schoolId,
        recipientPhone,
        recipientEmail,
        templateKey,
        variables,
        channel = 'whatsapp' // Padrão atual
    }: SendOptions) {
        console.log(`[NotificationHub] Iniciando envio para ${templateKey} via ${channel}`);

        try {
            // 1. Buscar Template
            const { data: template, error: templateError } = await supabase
                .from('wpp_notification_templates')
                .select('*')
                .eq('key', templateKey)
                .single();

            if (templateError || !template) {
                console.error('[NotificationHub] Template não encontrado:', templateKey);
                return { success: false, error: 'Template not found' };
            }

            // 2. Processar Mensagem (Substituir Variáveis)
            let message = template.message_template;
            Object.entries(variables).forEach(([key, val]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                message = message.replace(regex, val);
            });

            const title = template.title_template;

            // 3. Roteamento de Canais
            const results = [];

            // WHATSAPP
            if ((channel === 'whatsapp' || channel === 'both') && recipientPhone) {
                results.push(this.sendWhatsApp(schoolId, recipientPhone, message, title));
            }

            // EMAIL (Placeholder para expansão futura)
            if ((channel === 'email' || channel === 'both') && recipientEmail) {
                results.push(this.sendEmail(schoolId, recipientEmail, title, message));
            }

            const output = await Promise.all(results);
            return { success: true, results: output };

        } catch (error: any) {
            console.error('[NotificationHub] Erro crítico:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Lógica específica para WhatsApp (Evolution API via Supabase Functions ou API direta)
     */
    async sendWhatsApp(schoolId: string, phone: string, message: string, title?: string) {
        // Limpar número: apenas dígitos
        const cleanPhone = phone.replace(/\D/g, '');

        // Formatar para o Evolution format (com @s.whatsapp.net se necessário, ou apenas número)
        // Aqui assumimos que a Edge Function do Supabase cuidará da autenticação com a Evolution API
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
            body: {
                schoolId,
                number: cleanPhone,
                message: title ? `*${title}*\n\n${message}` : message
            }
        });

        if (error) {
            console.error('[NotificationHub] Erro WhatsApp:', error);
            return { channel: 'whatsapp', success: false, error };
        }

        return { channel: 'whatsapp', success: true, data };
    },

    /**
     * Lógica específica para E-mail (Resend, SendGrid, etc via Supabase Functions)
     */
    async sendEmail(schoolId: string, email: string, subject: string, body: string) {
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                schoolId,
                to: email,
                subject,
                content: body
            }
        });

        if (error) {
            console.error('[NotificationHub] Erro E-mail:', error);
            return { channel: 'email', success: false, error };
        }

        return { channel: 'email', success: true, data };
    }
};
