import { type FC, useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import { Card, Button, Input } from '../../../components/ui';
import { Bell, Send, Loader2, Smartphone, AlertTriangle } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

export const SysPushManager: FC = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total_subs: 0, unique_users: 0 });
    const [sending, setSending] = useState(false);

    const [broadcast, setBroadcast] = useState({
        title: '',
        body: '',
        url: '/'
    });

    const [subStatus, setSubStatus] = useState<string>('Verificando...');

    useEffect(() => {
        fetchStats();
        checkSub();
    }, []);

    const fetchStats = async () => {
        try {
            const { count: total } = await supabase
                .from('user_push_subscriptions')
                .select('*', { count: 'exact', head: true });

            setStats({
                total_subs: total || 0,
                unique_users: 0 // Placeholder
            });
        } catch (error) {
            console.error('Error fetching push stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkSub = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setSubStatus('Sem sessão'); return; }

        const { data, error } = await supabase
            .from('user_push_subscriptions')
            .select('id')
            .eq('user_id', session.user.id);

        if (error) {
            setSubStatus('Erro ao verificar: ' + error.message);
        } else if (data && data.length > 0) {
            setSubStatus(`✅ Inscrito (Encontrados: ${data.length})`);
        } else {
            setSubStatus('❌ NÃO Inscrito');
        }
    };

    const testConnectivity = async () => {
        try {
            console.log('Testing connectivity to send-push...');
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // USE BACKEND STRATEGY to bypass RLS issues on frontend
            console.log('Using strategy: latest_active');

            const payload = {
                strategy: 'latest_active', // <--- NEW STRATEGY
                title: 'Teste de Sistema',
                body: `Teste de entrega (Strategy: Latest Active). Se recebeu, o sistema está OK.`,
                url: '/sys/test'
            };

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const text = await response.text();
            console.log('Raw Response:', response.status, text);

            if (response.ok) {
                // Try parsing JSON if possible
                try {
                    const json = JSON.parse(text);
                    if (json.sent && json.sent > 0) {
                        addToast('success', `✅ SUCESSO! Push enviado pelo servidor.`);
                    } else if (text.includes('No subscriptions found')) {
                        addToast('info', `⚠️ Conectado, mas 0 enviados (msg: ${json.message})`);
                    } else {
                        addToast('success', `Status ${response.status}: ${text}`);
                    }
                } catch {
                    addToast('success', `Resposta: ${text}`);
                }
            } else {
                addToast('error', `Falha: ${response.status} - ${text}`);
            }

        } catch (e: any) {
            console.error('Connectivity Test Error:', e);
            addToast('error', 'Erro de conexão: ' + e.message);
        }
    };

    const handleSendBroadcast = async () => {
        if (!broadcast.title || !broadcast.body) {
            addToast('error', 'Título e Mensagem são obrigatórios.');
            return;
        }

        setSending(true);
        try {
            // Get current session explicitly
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('No active session found. Please login again.');
            }

            console.log('Sending broadcast via server-side strategy...');

            const { error, data } = await supabase.functions.invoke('send-push', {
                body: {
                    strategy: 'broadcast_all', // <--- SERVER SIDE BROADCAST
                    title: broadcast.title,
                    body: broadcast.body,
                    url: broadcast.url
                },
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (error) throw error;

            console.log('Broadcast response:', data);

            // Adjust success message based on response if available, or just generic success
            const sentCount = data?.sent || 'vários';

            addToast('success', `Disparo iniciado para ${sentCount} usuários!`);
            setBroadcast({ title: '', body: '', url: '/' });

        } catch (error: any) {
            console.error('Error broadcasting:', error);
            addToast('error', 'Erro no disparo: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-brand-600" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-gray-500" />
                        Gerenciador de Push Notifications
                    </h2>
                    <p className="text-sm text-gray-500 font-mono mt-1 ml-7">Status Local: {subStatus}</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={checkSub}
                        className="bg-white border text-gray-600 hover:bg-gray-50 text-xs"
                    >
                        Atualizar Status
                    </Button>
                    <Button
                        onClick={testConnectivity}
                        className="bg-gray-800 text-white text-xs"
                    >
                        Testar Conectividade
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-4 bg-white border border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-50 rounded-xl text-brand-600">
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Dispositivos Inscritos</p>
                            <h3 className="text-2xl font-bold text-gray-900">{stats.total_subs}</h3>
                        </div>
                    </div>
                </Card>
                <div className="flex items-center p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-blue-600 mr-3" />
                    <p className="text-sm text-blue-800">
                        O PWA precisa estar instalado no celular do usuário para receber notificações. Incentive os pais a instalarem o app.
                    </p>
                </div>
            </div>

            {/* Manual Broadcast Form */}
            <Card className="p-6 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Send className="w-4 h-4 text-gray-500" />
                    Disparo Manual (Broadcast)
                </h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                        <Input
                            placeholder="Ex: Aviso Importante"
                            value={broadcast.title}
                            onChange={e => setBroadcast({ ...broadcast, title: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mensagem</label>
                        <textarea
                            className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-y min-h-[100px]"
                            placeholder="Ex: Não haverá aula amanhã devido..."
                            value={broadcast.body}
                            onChange={e => setBroadcast({ ...broadcast, body: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link de Destino (Opcional)</label>
                        <Input
                            placeholder="Ex: /agenda ou /financeiro"
                            value={broadcast.url}
                            onChange={e => setBroadcast({ ...broadcast, url: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleSendBroadcast}
                            disabled={sending || stats.total_subs === 0}
                            className="bg-brand-600 text-white"
                        >
                            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                            Enviar Agora
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
