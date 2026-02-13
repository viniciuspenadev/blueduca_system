import { type FC, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Card, Button } from '../../components/ui';
import { Save, Loader2, Lock, Key, Info } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

export interface FinanceConfig {
    enable_new_bill: boolean;
    enable_payment_confirmation: boolean;
    enable_due_reminder: boolean;
    days_before_due: number;
    enable_overdue_warning: boolean;
    days_after_due: number;
    cron_time: string; // HH:MM
}

export interface GatewayConfig {
    active: boolean; // Operational Status
    provider: 'asaas' | 'manual';
    environment: 'sandbox' | 'production';
    api_key: string;
    wallet_id?: string;
}

interface FinancialSettingsTabProps {
    isProvisioned?: boolean;
    isAsaasProvisioned?: boolean;
    hasWhatsapp?: boolean;
    showGateway?: boolean;
}

export const FinancialSettingsTab: FC<FinancialSettingsTabProps> = ({
    isProvisioned = false,
    isAsaasProvisioned = false,
    showGateway = true
}) => {
    const { addToast } = useToast();
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Default Configs
    const [notificationConfig, setNotificationConfig] = useState<FinanceConfig>({
        enable_new_bill: true,
        enable_payment_confirmation: true,
        enable_due_reminder: false,
        days_before_due: 1,
        enable_overdue_warning: false,
        days_after_due: 3,
        cron_time: '09:00'
    });




    const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig>({
        active: false,
        provider: 'manual',
        environment: 'sandbox',
        api_key: ''
    });

    useEffect(() => {
        fetchAllConfigs();
    }, [currentSchool]);

    const fetchAllConfigs = async () => {
        if (!currentSchool) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('key, value')
                .eq('school_id', currentSchool.id)
                .in('key', ['finance_notification_config', 'finance_gateway_config']);

            if (error) throw error;

            data?.forEach(item => {
                let val = item.value;
                if (typeof val === 'string') {
                    try { val = JSON.parse(val); } catch (e) { /* ignore */ }
                }

                if (item.key === 'finance_notification_config') {
                    setNotificationConfig(prev => ({ ...prev, ...val }));
                }
                if (item.key === 'finance_gateway_config') {
                    setGatewayConfig(prev => ({
                        ...prev,
                        ...val,
                        active: val.active ?? prev.active // Ensure active persistence
                    }));
                }
            });

        } catch (error) {
            console.error('Error fetching configs:', error);
            addToast('error', 'Erro ao carregar configurações');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (newGatewayConfig?: GatewayConfig) => {
        const gatewayToSave = newGatewayConfig || gatewayConfig;
        setSaving(true);
        try {
            if (!currentSchool) return;

            // Upsert Notification Config
            const { error: error1 } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'finance_notification_config',
                    value: notificationConfig,
                    description: 'Configurações de Notificações Financeiras',
                    updated_at: new Date().toISOString(),
                    school_id: currentSchool.id
                }, { onConflict: 'key,school_id' });

            if (error1) throw error1;

            // Upsert Gateway Config
            const { error: error2 } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'finance_gateway_config',
                    value: gatewayToSave,
                    description: 'Configuração do Gateway de Pagamento (Asaas)',
                    updated_at: new Date().toISOString(),
                    school_id: currentSchool.id
                }, { onConflict: 'key,school_id' });

            if (error2) throw error2;

            if (!newGatewayConfig) addToast('success', 'Todas as configurações foram salvas!');
        } catch (error: any) {
            console.error('Error saving:', error);
            addToast('error', 'Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleOperational = () => {
        const newGateway = { ...gatewayConfig, active: !gatewayConfig.active };
        setGatewayConfig(newGateway);
        handleSave(newGateway);
    };

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" /></div>;

    // ------------------------------------------------------------------
    // RENDER: NOT PROVISIONED (HIRE STATE)
    // ------------------------------------------------------------------
    if (!isProvisioned) {
        return (
            <div className="space-y-6 animate-fade-in pb-20">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Configurações Financeiras</h2>
                        <p className="text-sm text-gray-500">Gerencie automação, notificações e integração bancária.</p>
                    </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center max-w-3xl mx-auto mt-8">
                    <div className="w-16 h-16 bg-gray-200 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">Módulo Não Contratado</h2>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                        Automatize a emissão de boletos, envie lembretes de vencimento e reduza a inadimplência com nossa integração financeira.
                    </p>
                    <Button className="bg-brand-600 text-white shadow-lg hover:bg-brand-700">
                        Fale com um Consultor
                    </Button>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // RENDER: PROVISIONED (OPERATIONAL STATE)
    // ------------------------------------------------------------------

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* --- ASAAS CONNECTION CARD --- */}
                {showGateway && (
                    <Card className="lg:col-span-2 overflow-hidden border-none shadow-md bg-white">
                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x border border-gray-100 rounded-2xl overflow-hidden">

                            {/* Status Section */}
                            <div className={`p-8 md:w-1/3 flex flex-col items-center justify-center text-center space-y-4 transition-colors ${!isAsaasProvisioned ? 'bg-gray-50' : (gatewayConfig.active ? 'bg-blue-50/30' : 'bg-amber-50/20')}`}>
                                {/* Mock Logo Asaas */}
                                <div className="flex items-center gap-1.5 mb-2">
                                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs italic shadow-lg shadow-blue-200">A</div>
                                    <span className="text-xl font-black text-gray-900 tracking-tighter">asaas</span>
                                </div>

                                {!isAsaasProvisioned ? (
                                    <div className="space-y-3">
                                        <div className="px-3 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold rounded-full uppercase tracking-wider mx-auto w-fit">
                                            Indisponível
                                        </div>
                                        <p className="text-sm text-gray-500 max-w-[180px]">Automatize cobranças via Pix e Boleto.</p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="bg-brand-600 text-white hover:bg-brand-700"
                                        >
                                            Contratar Upgrade
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4 w-full">
                                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest inline-block ${gatewayConfig.active ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {gatewayConfig.active ? 'Conectado' : 'Pausado'}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Button
                                                type="button"
                                                onClick={toggleOperational}
                                                variant={gatewayConfig.active ? 'outline' : 'primary'}
                                                className={`w-full ${gatewayConfig.active ? 'hover:bg-amber-50 hover:text-amber-700 border-amber-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                            >
                                                {gatewayConfig.active ? 'Pausar Integração' : 'Ativar Integração'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Config Section */}
                            <div className={`p-8 md:w-2/3 space-y-6 ${!isAsaasProvisioned ? 'opacity-40 pointer-events-none grayscale select-none' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-bold text-gray-900">Configurações do Gateway</h3>
                                        <p className="text-sm text-gray-500 italic">Identidade da sua conta Asaas</p>
                                    </div>
                                    {isAsaasProvisioned && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-gray-400">Ambiente:</span>
                                            <div className="flex p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setGatewayConfig({ ...gatewayConfig, environment: 'sandbox' })}
                                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${gatewayConfig.environment === 'sandbox' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 opacity-60'}`}
                                                >
                                                    TESTE
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setGatewayConfig({ ...gatewayConfig, environment: 'production' })}
                                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${gatewayConfig.environment === 'production' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 opacity-60'}`}
                                                >
                                                    PROD
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">API KEY {gatewayConfig.environment === 'sandbox' ? '(SANDBOX)' : '(PRODUÇÃO)'}</label>
                                        <div className="relative">
                                            <input
                                                disabled={!gatewayConfig.active}
                                                type="password"
                                                className="w-full pl-10 pr-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 font-mono text-gray-600 transition-all focus:bg-white"
                                                placeholder={`$aact_${gatewayConfig.environment === 'sandbox' ? 'test' : 'prod'}...`}
                                                value={gatewayConfig.api_key}
                                                onChange={e => setGatewayConfig({ ...gatewayConfig, api_key: e.target.value })}
                                            />
                                            <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                                        </div>
                                        <p className="mt-2 text-[11px] text-gray-400 flex items-center gap-1">
                                            <Info className="w-3 h-3" />
                                            Pegue sua chave no painel do Asaas em Configurações &gt; Integrações.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}

                <div className="mt-8 flex justify-end lg:col-span-2 border-t border-gray-100 pt-8">
                    <Button
                        type="button"
                        onClick={() => handleSave()}
                        disabled={saving}
                        className="bg-brand-600 text-white shadow-xl hover:bg-brand-700 px-10 h-12 text-base font-bold"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                        Salvar Configurações
                    </Button>
                </div>
            </div>
        </div>
    );
};
