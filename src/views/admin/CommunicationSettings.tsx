import { type FC, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { Button, Card, Input } from '../../components/ui';
import { Save, MessageSquare, Wifi, Loader2, Lock } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { NotificationTemplatesTab } from './NotificationTemplatesTab';

interface CommunicationSettingsProps {
    embedded?: boolean;
    isProvisioned?: boolean; // Controls if the school HAS this module (Super Admin)
}

export const CommunicationSettings: FC<CommunicationSettingsProps> = ({
    embedded = false,
    isProvisioned = false
}) => {
    const { currentSchool } = useAuth();
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'connected' | 'disconnected' | 'error'>('idle');

    // Tab State
    const [activeTab, setActiveTab] = useState<'connection' | 'templates' | 'push'>('connection');

    // Config State (Operational)
    const [config, setConfig] = useState({
        active: false, // Core 'Operational' Toggle
        url: '',
        apikey: '',
        instance: '',
        enabled_channels: {
            finance: true,
            diary: false, // Changed default to false to be safe
            occurrence: true
        }
    });

    useEffect(() => {
        if (currentSchool) {
            fetchConfig();
        }
    }, [currentSchool]);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'whatsapp_config')
                .eq('school_id', currentSchool?.id)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;

            if (data?.value) {
                let incoming = data.value;
                if (typeof incoming === 'string') {
                    try { incoming = JSON.parse(incoming); } catch (e) { console.error(e); }
                }

                setConfig(prev => ({
                    ...prev,
                    active: incoming.active ?? prev.active,
                    url: incoming.url || prev.url,
                    apikey: incoming.apikey || prev.apikey,
                    instance: incoming.instance || prev.instance,
                    enabled_channels: {
                        finance: incoming.enabled_channels?.finance ?? prev.enabled_channels.finance,
                        diary: incoming.enabled_channels?.diary ?? prev.enabled_channels.diary,
                        occurrence: incoming.enabled_channels?.occurrence ?? prev.enabled_channels.occurrence
                    }
                }));
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            addToast('error', 'Erro ao carregar configurações');
        }
    };

    const handleSave = async (newConfig?: any) => {
        const configToSave = newConfig || config;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'whatsapp_config',
                    value: configToSave,
                    description: 'Configurações de conexão Evolution API',
                    school_id: currentSchool?.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key,school_id' });

            if (error) throw error;
            if (!newConfig) addToast('success', 'Configurações salvas!'); // Don't toast on toggle
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao salvar: ' + (error as any).message);
        } finally {
            setSaving(false);
        }
    };

    const toggleOperational = () => {
        const newConfig = { ...config, active: !config.active };
        setConfig(newConfig);
        handleSave(newConfig);
    };



    const testConnection = async () => {
        if (!config.url || !config.instance || !config.apikey) {
            addToast('error', 'Preencha URL, Instância e API Key primeiro');
            return;
        }

        setConnectionStatus('checking');
        try {
            const cleanUrl = config.url.replace(/\/$/, '');
            const targetUrl = `${cleanUrl}/instance/connectionState/${config.instance}`;

            const response = await fetch(targetUrl, {
                headers: {
                    'apikey': config.apikey
                }
            });

            const data = await response.json();

            if (response.ok && (data.instance?.state === 'open' || data.state === 'open')) {
                setConnectionStatus('connected');
                addToast('success', 'Conectado à Evolution API!');
            } else if (response.status === 404) {
                // Tentar endpoint alternativo (/instance/fetchInstances) para verificar se a API responde
                console.log('[Connection Test] 404 Received. Trying fetchChecks...');
                const fetchCheck = await fetch(`${cleanUrl}/instance/fetchInstances`, { headers: { 'apikey': config.apikey } });

                if (fetchCheck.ok) {
                    setConnectionStatus('disconnected');
                    addToast('error', `Instância "${config.instance}" não encontrada nesta API.`);
                } else {
                    console.log('[Connection Test] Fetch check failed:', fetchCheck.status);
                    throw new Error('Endpoint não encontrado');
                }
            } else {
                setConnectionStatus('disconnected');
                addToast('info', 'Instância existe, mas não está conectada (QR Code pendente).');
            }
        } catch (error: any) {
            console.error('Error testing connection:', error);
            setConnectionStatus('error');
            addToast('error', 'Falha ao conectar: Verifique a URL e a API Key.');
        }
    };


    // ------------------------------------------------------------------
    // RENDER: NOT PROVISIONED (HIRE STATE)
    // ------------------------------------------------------------------
    if (!isProvisioned) {
        return (
            <div className={`space-y-6 animate-fade-in ${embedded ? '' : 'pb-20'}`}>
                {!embedded && <h1 className="text-3xl font-bold text-gray-900">Configurações de Comunicação</h1>}

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center max-w-3xl mx-auto mt-8">
                    <div className="w-16 h-16 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Módulo Não Contratado</h2>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                        A integração com WhatsApp permite envio automático de boletos, diário escolar e avisos importantes diretamente no celular dos pais.
                    </p>
                    <Button className="bg-brand-600 text-white shadow-lg hover:bg-brand-700">
                        Fale com um Consultor
                    </Button>
                </div>
            </div>
        )
    }

    // ------------------------------------------------------------------
    // RENDER: PROVISIONED (OPERATIONAL STATE)
    // ------------------------------------------------------------------
    const moduleEnabled = config.active; // Operational state

    return (
        <div className={`space-y-6 animate-fade-in ${embedded ? '' : 'pb-20'}`}>
            {!embedded && (
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações de Comunicação</h1>
                    <p className="text-gray-500">Gerencie integrações, canais e personalize as mensagens enviadas.</p>
                </div>
            )}

            {/* Operational Toggle Header */}
            <div className={`
                p-4 rounded-xl border flex items-center justify-between transition-colors mb-6
                ${moduleEnabled ? 'bg-green-50/50 border-green-100' : 'bg-gray-50 border-gray-200'}
            `}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${moduleEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className={`font-semibold ${moduleEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                            {moduleEnabled ? 'Integração Ativa' : 'Integração Pausada'}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {moduleEnabled
                                ? 'Automações rodando normalmente.'
                                : 'Envios suspensos temporariamente.'}
                        </p>
                    </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={moduleEnabled}
                        onChange={toggleOperational}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
            </div>

            {/* Content - Operational Status controls opacity/disable */}
            <div className={`transition-opacity duration-300 ${!moduleEnabled ? 'opacity-60 pointer-events-none' : ''}`}>

                {/* Tabs Navigation */}
                <div className="flex border-b border-gray-200 gap-2 overflow-x-auto mb-6">
                    <button onClick={() => setActiveTab('templates')} disabled={!moduleEnabled} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'templates' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        Modelos de Texto
                    </button>
                </div>

                {/* Tab Content: Connection & Rules */}
                {activeTab === 'connection' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="p-6 border border-gray-200 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-gray-600" /> Conexão WhatsApp (Evolution API)</h2>
                                    <div className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase tracking-wider">Instância Privada</div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">URL da API</label>
                                        <Input disabled={!moduleEnabled} placeholder="https://evolution.seudominio.com" value={config.url} onChange={e => setConfig({ ...config, url: e.target.value })} className="bg-white" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Global API Key</label>
                                            <Input disabled={!moduleEnabled} type="password" value={config.apikey} onChange={e => setConfig({ ...config, apikey: e.target.value })} className="bg-white" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Instância</label>
                                            <Input disabled={!moduleEnabled} value={config.instance} onChange={e => setConfig({ ...config, instance: e.target.value })} className="bg-white" />
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                                    <Button type="button" variant="outline" onClick={testConnection} disabled={connectionStatus === 'checking' || !moduleEnabled} className="text-sm bg-white hover:bg-gray-50">
                                        {connectionStatus === 'checking' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />} Testar Conexão
                                    </Button>
                                    <Button onClick={() => handleSave()} disabled={saving || !moduleEnabled} className="bg-gray-900 hover:bg-gray-800 text-white shadow-none">
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Tab Content: Templates */}
                {activeTab === 'templates' && <NotificationTemplatesTab />}
            </div>
        </div>
    );
};
