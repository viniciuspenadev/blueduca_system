import { type FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, Smartphone, AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Card, Button } from '../../components/ui';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export const ParentPushSettings: FC = () => {
    const { user, currentSchool } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const [permission, setPermission] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [testingSend, setTestingSend] = useState(false);

    useEffect(() => {
        checkStatus();
    }, [user]);

    const checkStatus = async () => {
        setLoading(true);

        // Check browser support
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setPermission('unsupported');
            setLoading(false);
            return;
        }

        // Check permission
        if ('Notification' in window) {
            setPermission(Notification.permission as any);
        }

        // Check if subscribed
        if (user && currentSchool) {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();

                if (subscription) {
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
        }

        setLoading(false);
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

    const enableNotifications = async () => {
        if (!user || !VAPID_PUBLIC_KEY) {
            addToast('error', 'Configuração inválida.');
            return;
        }

        if (!currentSchool) {
            addToast('error', 'Nenhuma escola selecionada.');
            return;
        }

        setActionLoading(true);

        try {
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult as any);

            if (permissionResult !== 'granted') {
                addToast('error', 'Permissão negada.');
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            const { error } = await supabase.from('user_push_subscriptions').insert({
                user_id: user.id,
                school_id: currentSchool.id,
                subscription: subscription.toJSON(),
                user_agent: navigator.userAgent,
            });

            if (error && error.code !== '23505') throw error;

            setIsSubscribed(true);
            addToast('success', '✅ Notificações ativadas!');
        } catch (error: any) {
            console.error('Error enabling notifications:', error);
            addToast('error', 'Erro ao ativar: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const disableNotifications = async () => {
        if (!user) return;

        setActionLoading(true);

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();
            }

            const { error } = await supabase
                .from('user_push_subscriptions')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;

            setIsSubscribed(false);
            addToast('success', 'Notificações desativadas.');
        } catch (error: any) {
            console.error('Error disabling:', error);
            addToast('error', 'Erro ao desativar: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const sendTestNotification = async () => {
        if (!user) return;

        setTestingSend(true);

        try {
            const { error } = await supabase.functions.invoke('send-push', {
                body: {
                    user_id: user.id,
                    title: '🔔 Teste de Notificação',
                    body: 'Se você recebeu isso, está tudo funcionando!',
                    url: '/pais/home',
                },
            });

            if (error) throw error;

            addToast('success', 'Notificação de teste enviada!');
        } catch (error: any) {
            console.error('Error sending test:', error);
            addToast('error', 'Erro no envio: ' + error.message);
        } finally {
            setTestingSend(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate('/pais/menu')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Notificações Push</h1>
                    <p className="text-sm text-gray-500">Receba atualizações em tempo real</p>
                </div>
            </div>

            {/* Status Card */}
            <Card className="p-6 border-2">
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl ${isSubscribed ? 'bg-green-50' : 'bg-gray-50'}`}>
                        {isSubscribed ? (
                            <Bell className="w-6 h-6 text-green-600" />
                        ) : (
                            <BellOff className="w-6 h-6 text-gray-400" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                            {permission === 'unsupported' && 'Não Suportado'}
                            {permission === 'denied' && 'Permissão Negada'}
                            {permission === 'granted' && isSubscribed && 'Ativo'}
                            {permission === 'granted' && !isSubscribed && 'Inativo'}
                            {permission === 'default' && 'Não Configurado'}
                        </h3>
                        <p className="text-sm text-gray-600">
                            {permission === 'unsupported' && 'Seu navegador não suporta notificações push.'}
                            {permission === 'denied' && 'Você bloqueou as notificações. Altere nas configurações do navegador.'}
                            {permission === 'granted' && isSubscribed && 'Você está recebendo notificações neste dispositivo.'}
                            {permission === 'granted' && !isSubscribed && 'Ative para receber notificações.'}
                            {permission === 'default' && 'Configure para receber atualizações importantes.'}
                        </p>
                    </div>
                    {isSubscribed && <CheckCircle2 className="w-6 h-6 text-green-500" />}
                </div>

                {permission !== 'unsupported' && permission !== 'denied' && (
                    <div className="mt-6 flex gap-3">
                        {!isSubscribed ? (
                            <Button
                                onClick={enableNotifications}
                                disabled={actionLoading}
                                className="flex-1 bg-brand-600 text-white"
                            >
                                {actionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Bell className="w-4 h-4 mr-2" />
                                )}
                                Ativar Notificações
                            </Button>
                        ) : (
                            <Button
                                onClick={disableNotifications}
                                disabled={actionLoading}
                                className="flex-1 bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                                {actionLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <BellOff className="w-4 h-4 mr-2" />
                                )}
                                Desativar
                            </Button>
                        )}

                        {isSubscribed && (
                            <Button
                                onClick={sendTestNotification}
                                disabled={testingSend}
                                className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                                {testingSend ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </Card>

            {/* Info Cards */}
            <Card className="p-5 bg-blue-50 border-blue-200">
                <div className="flex gap-3">
                    <Smartphone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-blue-900 mb-1">Como funciona?</h4>
                        <p className="text-sm text-blue-800">
                            Mesmo com o app fechado, você receberá notificações sobre comunicados,
                            diário, eventos e atualizações importantes da escola.
                        </p>
                    </div>
                </div>
            </Card>

            {permission === 'denied' && (
                <Card className="p-5 bg-orange-50 border-orange-200">
                    <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-orange-900 mb-1">Permissão Bloqueada</h4>
                            <p className="text-sm text-orange-800 mb-2">
                                Para reativar, acesse as configurações do seu navegador e permita notificações
                                para este site.
                            </p>
                            <p className="text-xs text-orange-700 font-mono bg-orange-100 px-2 py-1 rounded">
                                Configurações → Site Settings → Notifications
                            </p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};
