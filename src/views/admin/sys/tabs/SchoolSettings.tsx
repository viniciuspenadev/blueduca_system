import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../services/supabase';
import { Button, Input } from '../../../../components/ui';
import {
    CreditCard,
    Zap,
    LayoutGrid,
    AlertTriangle,
    Loader2,
    Save
} from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';

interface Props {
    school: any;
}

export const SchoolSettings: React.FC<Props> = ({ school }) => {
    const { addToast } = useToast();
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [configModules, setConfigModules] = useState<Record<string, boolean>>(school.config_modules || {});
    const [configPlanId, setConfigPlanId] = useState<string>(school.plan_id || '');
    const [configPlanName, setConfigPlanName] = useState<string>(school.plan_tier || 'FREE');
    const [configLimits, setConfigLimits] = useState<Record<string, number>>(school.config_limits || {});
    const [isActive, setIsActive] = useState<boolean>(school.active);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        const { data } = await supabase.from('product_plans').select('*').order('price_monthly');
        if (data) setPlans(data);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('schools')
                .update({
                    config_modules: configModules,
                    config_limits: configLimits,
                    plan_tier: configPlanName, // Legacy field, keeping in sync
                    plan_id: configPlanId || null,
                    active: isActive
                })
                .eq('id', school.id);

            if (error) throw error;
            addToast('success', 'Configurações salvas com sucesso!');
        } catch (error: any) {
            console.error('Error saving settings:', error);
            addToast('error', 'Erro ao salvar configurações.');
        } finally {
            setLoading(false);
        }
    };

    const toggleModule = (moduleKey: string) => {
        const plan = plans.find(p => p.id === configPlanId);
        const isFromPlan = !!plan?.config_modules?.[moduleKey];
        const currentOverride = configModules[moduleKey];
        // Rules: 
        // 1. If overrides exist, toggle the override.
        // 2. If no override, and plan has it active, -> disable it (false override).
        // 3. If no override, and plan has it disabled, -> enable it (true override).

        // Simplified Logic: Just toggle current state, calculating effective first
        const effectiveState = currentOverride !== undefined ? currentOverride : isFromPlan;

        setConfigModules(prev => ({
            ...prev,
            [moduleKey]: !effectiveState
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                    <h2 className="text-lg font-bold text-gray-800">Preferências da Escola</h2>
                    <p className="text-sm text-gray-500">Ajuste o plano, funcionalidades e comportamento.</p>
                </div>
                <Button onClick={handleSave} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]">
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <span className="flex items-center gap-2"><Save size={18} /> Salvar</span>}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Plan & Limits */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Plan Selection */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <CreditCard size={16} className="text-brand-600" /> Plano Contratado
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o Plano Base</label>
                                <select
                                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                                    value={configPlanId}
                                    onChange={(e) => {
                                        const plan = plans.find(p => p.id === e.target.value);
                                        setConfigPlanId(e.target.value);
                                        if (plan) setConfigPlanName(plan.name);
                                    }}
                                >
                                    <option value="">-- Sem Plano --</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} - R$ {p.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-2">
                                    O plano define os limites padrão e módulos habilitados. Você pode sobrescrever abaixo.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Limits Overrides */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Zap size={16} className="text-amber-500" /> Ajuste de Limites (Overrides)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Máx. Alunos</label>
                                <Input
                                    type="number"
                                    value={configLimits.max_students || ''}
                                    onChange={(e) => setConfigLimits({ ...configLimits, max_students: parseInt(e.target.value) || 0 })}
                                    placeholder="Padrão"
                                    className="h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Máx. Admins</label>
                                <Input
                                    type="number"
                                    value={configLimits.max_users || ''}
                                    onChange={(e) => setConfigLimits({ ...configLimits, max_users: parseInt(e.target.value) || 0 })}
                                    placeholder="Padrão"
                                    className="h-10"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 mb-1 block">Mensagens/Mês</label>
                                <Input
                                    type="number"
                                    value={configLimits.max_messages_month || ''}
                                    onChange={(e) => setConfigLimits({ ...configLimits, max_messages_month: parseInt(e.target.value) || 0 })}
                                    placeholder="Padrão"
                                    className="h-10"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Modules Toggle */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <LayoutGrid size={16} className="text-indigo-600" /> Módulos Ativos
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                                { id: 'finance', label: 'Financeiro (Manual)' },
                                { id: 'finance_asaas', label: 'Financeiro Asaas' },
                                { id: 'communications', label: 'Comunicados (App)' },
                                { id: 'whatsapp', label: 'WhatsApp' },
                                { id: 'academic', label: 'Gestão Acadêmica' },
                                { id: 'crm', label: 'CRM & Captação' },
                                { id: 'menu', label: 'Cardápio Escolar' },
                                { id: 'library', label: 'Biblioteca' },
                                { id: 'inventory', label: 'Estoque/Almoxarifado' }
                            ].map((module) => {
                                const dbKey = module.id;

                                const plan = plans.find(p => p.id === configPlanId);
                                const isFromPlan = !!plan?.config_modules?.[dbKey];
                                const isOverridden = configModules[dbKey] !== undefined;
                                const isActive = isOverridden ? configModules[dbKey] : isFromPlan;

                                return (
                                    <label key={module.id} className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-all ${isActive ? 'bg-emerald-50 border-emerald-200' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                                    checked={isActive}
                                                    onChange={() => toggleModule(dbKey)}
                                                />
                                                <span className={`ml-3 text-sm font-medium ${isActive ? 'text-emerald-700' : 'text-gray-700'}`}>{module.label}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {isFromPlan && (
                                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Plan</span>
                                                )}
                                                {isOverridden && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Force</span>
                                                )}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Danger Zone */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-red-50 p-6 rounded-xl border border-red-100 shadow-sm">
                        <h3 className="text-sm font-bold text-red-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <AlertTriangle size={16} /> Zona de Perigo
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <h4 className="text-sm font-bold text-red-800 mb-1">Status da Escola</h4>
                                <p className="text-xs text-red-600 mb-3">
                                    {isActive
                                        ? 'A escola está ativa e acessível. Ao suspender, nenhum usuário (incluindo admins) conseguirá fazer login.'
                                        : 'A escola está suspensa. O acesso está bloqueado.'}
                                </p>
                                <button
                                    onClick={() => setIsActive(!isActive)}
                                    className={`w-full py-2 px-4 rounded-lg text-sm font-bold transition-colors border ${isActive
                                        ? 'bg-white border-red-200 text-red-600 hover:bg-red-100'
                                        : 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                                        }`}
                                >
                                    {isActive ? 'Suspender Acesso' : 'Reativar Escola'}
                                </button>
                            </div>

                            <hr className="border-red-200" />

                            <div>
                                <h4 className="text-sm font-bold text-red-800 mb-1">Apagar Escola</h4>
                                <p className="text-xs text-red-600 mb-3">
                                    Ação irreversível. Isso apagará todos os alunos, diários e dados financeiros permanentemente.
                                </p>
                                <button
                                    onClick={() => alert('Para segurança, use a tela de listagem para exclusão definitiva.')}
                                    className="w-full py-2 px-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-bold transition-colors border border-red-200"
                                >
                                    Excluir Definitivamente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
