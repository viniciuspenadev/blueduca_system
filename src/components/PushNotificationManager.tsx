import { type FC, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Bell, Loader2 } from 'lucide-react';

// VAPID Public Key - deve ser configurado como variável de ambiente
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const PushNotificationManager: FC = () => {
    const { user, currentSchool } = useAuth();
    const { addToast } = useToast();
    const [permission, setPermission] = useState<PermissionState>('default');
    const [loading, setLoading] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);

    useEffect(() => {
        checkPushSupport();
        checkExistingSubscription();
    }, [user]);

    const checkPushSupport = () => {
        if (!('serviceWorker' in navigator)) {
            setPermission('unsupported');
            return false;
        }
        if (!('PushManager' in window)) {
            setPermission('unsupported');
            return false;
        }
        if ('Notification' in window) {
            setPermission(Notification.permission as PermissionState);
        }
        return true;
    };

    const checkExistingSubscription = async () => {
        if (!user || !currentSchool) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Verificar se está salva no banco (filtrando por user + school)
                const { data } = await supabase
                    .from('user_push_subscriptions')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('school_id', currentSchool.id)
                    .maybeSingle();

                setIsSubscribed(!!data);
            } else {
                setIsSubscribed(false);
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
        }
    };

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribeToPush = async () => {
        if (!user) {
            addToast('error', 'Você precisa estar logado.');
            return;
        }

        if (!currentSchool) {
            addToast('error', 'Nenhuma escola selecionada.');
            return;
        }

        if (!VAPID_PUBLIC_KEY) {
            console.error('VAPID_PUBLIC_KEY não configurada!');
            addToast('error', 'Configuração de notificações inválida. Contate o suporte.');
            return;
        }

        setLoading(true);

        try {
            // Request permission
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult as PermissionState);

            if (permissionResult !== 'granted') {
                addToast('error', 'Permissão para notificações negada.');
                return;
            }

            // Get Service Worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            // Save subscription to database with school_id
            const { error } = await supabase.from('user_push_subscriptions').insert({
                user_id: user.id,
                school_id: currentSchool.id,
                subscription: subscription.toJSON(),
                user_agent: navigator.userAgent,
            });

            if (error) {
                // Check if it's a unique constraint error (subscription already exists)
                if (error.code === '23505') {
                    console.log('Subscription already exists, updating...');
                    // Optionally update the existing record
                    setIsSubscribed(true);
                    addToast('info', 'Notificações já estavam ativadas neste dispositivo.');
                } else {
                    throw error;
                }
            } else {
                setIsSubscribed(true);
                addToast('success', '✅ Notificações ativadas com sucesso!');
            }
        } catch (error: any) {
            console.error('Error subscribing to push:', error);
            addToast('error', 'Erro ao ativar notificações: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Don't render if user is not logged in or browser doesn't support push
    if (!user || permission === 'unsupported') {
        return null;
    }

    // Auto-prompt: Show a gentle banner if permission is default and user is not subscribed
    if (permission === 'default' && !isSubscribed && !loading) {
        return (
            <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 flex items-start gap-3">
                    <div className="p-2 bg-brand-50 rounded-xl">
                        <Bell className="w-5 h-5 text-brand-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-900 text-sm mb-1">
                            Ative as Notificações 🔔
                        </h3>
                        <p className="text-xs text-gray-600 mb-3">
                            Receba atualizações importantes da escola em tempo real, mesmo com o app fechado.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={subscribeToPush}
                                disabled={loading}
                                className="flex-1 bg-brand-600 text-white text-xs font-bold py-2 px-3 rounded-lg hover:bg-brand-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                ) : (
                                    'Ativar Agora'
                                )}
                            </button>
                            <button
                                onClick={() => setPermission('denied')}
                                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2"
                            >
                                Agora não
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Silent management - already subscribed or denied
    return null;
};
