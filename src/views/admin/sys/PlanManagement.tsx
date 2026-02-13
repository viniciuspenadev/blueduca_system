import { type FC, useState, useEffect } from 'react';
import { supabase } from '../../../services/supabase';
import { Button, Card, Input } from '../../../components/ui';
import {
    CreditCard,
    Plus,
    Save,
    X,
    Check,
    Shield,
    Users,
    LayoutGrid,
    Zap,
    Loader2
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';

interface ProductPlan {
    id: string;
    name: string;
    description: string;
    is_public: boolean;
    config_modules: {
        finance: boolean;
        finance_asaas: boolean;
        academic: boolean;
        communications: boolean;
        crm: boolean;
        menu: boolean;
        library: boolean;
        inventory: boolean;
        dunning: boolean;
    };
    config_limits: {
        max_students: number;
        max_users: number;
        max_messages_month: number;
    };
    price_monthly: number;
}

export const PlanManagement: FC = () => {
    const [plans, setPlans] = useState<ProductPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlan, setSelectedPlan] = useState<ProductPlan | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            const { data, error } = await supabase
                .from('product_plans')
                .select('*')
                .order('price_monthly', { ascending: true });

            if (error) throw error;
            setPlans(data || []);
        } catch (error: any) {
            addToast('error', 'Erro ao carregar planos: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleModule = (module: keyof ProductPlan['config_modules']) => {
        if (!selectedPlan) return;
        setSelectedPlan({
            ...selectedPlan,
            config_modules: {
                ...selectedPlan.config_modules,
                [module]: !selectedPlan.config_modules[module]
            }
        });
    };

    const handleLimitChange = (limit: keyof ProductPlan['config_limits'], value: string) => {
        if (!selectedPlan) return;
        setSelectedPlan({
            ...selectedPlan,
            config_limits: {
                ...selectedPlan.config_limits,
                [limit]: parseInt(value) || 0
            }
        });
    };

    const handleSave = async () => {
        if (!selectedPlan) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('product_plans')
                .update({
                    name: selectedPlan.name,
                    description: selectedPlan.description,
                    config_modules: selectedPlan.config_modules,
                    config_limits: selectedPlan.config_limits,
                    price_monthly: selectedPlan.price_monthly,
                    is_public: selectedPlan.is_public
                })
                .eq('id', selectedPlan.id);

            if (error) throw error;
            addToast('success', 'Plano atualizado com sucesso!');
            fetchPlans();
            setSelectedPlan(null);
        } catch (error: any) {
            addToast('error', 'Erro ao salvar plano: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Planos & Preços</h1>
                    <p className="text-slate-500">Gerencie os moldes contratuais e limites de cada plano.</p>
                </div>
                <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Plano
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map(plan => (
                    <Card key={plan.id} className={`relative overflow-hidden border-2 transition-all cursor-pointer hover:shadow-md ${selectedPlan?.id === plan.id ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'}`} onClick={() => setSelectedPlan(plan)}>
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
                                <CreditCard className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-2xl font-black text-slate-900 mb-4">
                                {plan.price_monthly === 0 ? 'Grátis' : `R$ ${plan.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                <span className="text-xs font-normal text-slate-500 ml-1">/mês</span>
                            </p>

                            <div className="space-y-2 mb-6">
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Até {plan.config_limits.max_students} alunos</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Shield className="w-3.5 h-3.5" />
                                    <span>{Object.values(plan.config_modules).filter(Boolean).length} módulos ativos</span>
                                </div>
                            </div>

                            <Button variant="ghost" className="w-full text-xs text-emerald-600 hover:bg-emerald-50">
                                Editar Configurações
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {selectedPlan && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl bg-white shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Editando: {selectedPlan.name}</h2>
                                <p className="text-sm text-slate-500">Ajuste os módulos e limites deste "molde" de plano.</p>
                            </div>
                            <button onClick={() => setSelectedPlan(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Nome do Plano</label>
                                    <Input
                                        value={selectedPlan.name}
                                        onChange={(e) => setSelectedPlan({ ...selectedPlan, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Preço Mensal (R$)</label>
                                    <Input
                                        type="number"
                                        value={selectedPlan.price_monthly}
                                        onChange={(e) => setSelectedPlan({ ...selectedPlan, price_monthly: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            {/* Módulos Habilitados */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4 text-emerald-500" />
                                    Módulos Habilitados
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Object.entries(selectedPlan.config_modules).map(([key, value]) => {
                                        const labels: any = {
                                            finance: 'Financeiro (Manual)',
                                            finance_asaas: 'Financeiro Asaas',
                                            academic: 'Acadêmico',
                                            communications: 'Comunicação',
                                            crm: 'CRM',
                                            menu: 'Cardápio',
                                            library: 'Biblioteca',
                                            inventory: 'Estoque',
                                            dunning: 'Régua de Cobrança'
                                        };
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => handleToggleModule(key as any)}
                                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}
                                            >
                                                <span className="text-xs font-semibold uppercase">{labels[key] || key}</span>
                                                {value ? <Check size={14} className="text-emerald-500" /> : <div className="w-3.5 h-3.5" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Limites do Plano */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-amber-500" />
                                    Limites Operacionais
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-500">Máx. Alunos</label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm"
                                            value={selectedPlan.config_limits.max_students}
                                            onChange={(e) => handleLimitChange('max_students', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-500">Máx. Admins</label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm"
                                            value={selectedPlan.config_limits.max_users}
                                            onChange={(e) => handleLimitChange('max_users', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-slate-500">SMS/Mural Mês</label>
                                        <Input
                                            type="number"
                                            className="h-9 text-sm"
                                            value={selectedPlan.config_limits.max_messages_month}
                                            onChange={(e) => handleLimitChange('max_messages_month', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <Button variant="ghost" onClick={() => setSelectedPlan(null)} disabled={isSaving}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                className="bg-slate-900 hover:bg-black text-white px-8"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Salvar Configurações do Molde
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
