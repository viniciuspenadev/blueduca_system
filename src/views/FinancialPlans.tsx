
import { type FC, useState, useEffect } from 'react';
import { useSystem } from '../contexts/SystemContext';
import { Button, Card, Input } from '../components/ui';
import {
    Plus,
    Edit2,
    Trash2,
    Package,
    GraduationCap,
    Shirt
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';

export const FinancialPlansView: FC = () => {
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const { currentSchool } = useAuth();
    const { availableYears, currentYear } = useSystem();
    const [plans, setPlans] = useState<any[]>([]);
    // const [loading, setLoading] = useState(true); // removed unused loading
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        type: 'tuition', // tuition, material, uniform, service
        total_value: 0,
        installments_count: 12,
        academic_year: currentYear ? parseInt(currentYear.year) : new Date().getFullYear(),
        active: true
    });

    const fetchPlans = async () => {
        if (!currentSchool) return;
        const { data, error } = await supabase
            .from('financial_plans')
            .select('*')
            .eq('school_id', currentSchool.id)
            .order('title');

        if (error) {
            console.error(error);
            // Fallback for demo if table doesn't have new columns yet
            // addToast('error', 'Erro ao carregar planos');
        }
        if (data) setPlans(data);
    };

    useEffect(() => {
        fetchPlans();
    }, [currentSchool]);

    const handleOpenModal = (plan?: any) => {
        if (plan) {
            setEditingId(plan.id);
            setFormData({
                title: plan.title,
                type: plan.type || 'tuition',
                total_value: plan.total_value,
                installments_count: plan.installments_count,
                academic_year: plan.academic_year || (currentYear ? parseInt(currentYear.year) : 2026),
                active: plan.active !== false
            });
        } else {
            setEditingId(null);
            setFormData({
                title: '',
                type: 'tuition',
                total_value: 0,
                installments_count: 12,
                academic_year: currentYear ? parseInt(currentYear.year) : new Date().getFullYear(),
                active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('financial_plans')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
                addToast('success', 'Plano atualizado!');
            } else {
                const { error } = await supabase
                    .from('financial_plans')
                    .insert([{ ...formData, school_id: currentSchool?.id }]);
                if (error) throw error;
                addToast('success', 'Plano criado!');
            }
            setIsModalOpen(false);
            fetchPlans();
        } catch (error: any) {
            addToast('error', 'Erro ao salvar: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Excluir Plano',
            message: 'Tem certeza que deseja excluir este plano financeiro?',
            type: 'danger',
            confirmText: 'Excluir'
        });

        if (!isConfirmed) return;
        try {
            const { error } = await supabase.from('financial_plans').delete().eq('id', id);
            if (error) throw error;
            addToast('success', 'Plano removido');
            fetchPlans();
        } catch (error: any) {
            addToast('error', 'Erro ao excluir');
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'tuition': return <GraduationCap className="w-5 h-5 text-brand-600" />;
            case 'material': return <Package className="w-5 h-5 text-amber-600" />;
            case 'uniform': return <Shirt className="w-5 h-5 text-blue-600" />;
            default: return <Package className="w-5 h-5 text-gray-600" />;
        }
    };

    const getTypeLabel = (type: string) => {
        const map: any = {
            tuition: 'Mensalidade/Anuidade',
            material: 'Material Didático',
            uniform: 'Uniforme',
            service: 'Serviço Extra'
        };
        return map[type] || type;
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Planos & Preços</h1>
                    <p className="text-gray-500 text-sm">Gerencie anuidades, kits de material e taxas.</p>
                </div>
                <Button className="bg-brand-600 hover:bg-brand-700" onClick={() => handleOpenModal()}>
                    <Plus className="w-4 h-4 mr-2" /> Novo Plano
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => (
                    <Card key={plan.id} className="p-4 hover:shadow-md transition-shadow border-gray-100 group">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-brand-50 transition-colors">
                                    {getIcon(plan.type)}
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                                        {plan.academic_year || 2026}
                                    </span>
                                    <h3 className="font-bold text-gray-800 line-clamp-1" title={plan.title}>
                                        {plan.title}
                                    </h3>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" onClick={() => handleOpenModal(plan)}>
                                    <Edit2 className="w-4 h-4 text-gray-500" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(plan.id)}>
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-end">
                            <div>
                                <p className="text-xs text-gray-500 mb-0.5">Valor Total</p>
                                <p className="text-lg font-bold text-gray-900">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.total_value)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500 mb-0.5">Parcelamento</p>
                                <p className="text-sm font-medium text-gray-700">
                                    {plan.installments_count}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.total_value / (plan.installments_count || 1))}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3">
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                {getTypeLabel(plan.type)}
                            </span>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl animate-scale-in">
                        <h2 className="text-xl font-bold mb-4">{editingId ? 'Editar Plano' : 'Novo Plano'}</h2>

                        <div className="space-y-4">
                            <Input
                                label="Título do Plano"
                                placeholder="Ex: Anuidade 2026 - Fundamental I"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="tuition">Mensalidade</option>
                                        <option value="material">Material Didático</option>
                                        <option value="uniform">Uniforme</option>
                                        <option value="service">Serviço/Taxa</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ano Letivo</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                                        value={formData.academic_year}
                                        onChange={e => setFormData({ ...formData, academic_year: Number(e.target.value) })}
                                    >
                                        {availableYears.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Valor Total (R$)"
                                    type="number"
                                    value={formData.total_value}
                                    onChange={e => setFormData({ ...formData, total_value: Number(e.target.value) })}
                                />
                                <Input
                                    label="Parcelas"
                                    type="number"
                                    value={formData.installments_count}
                                    onChange={e => setFormData({ ...formData, installments_count: Number(e.target.value) })}
                                />
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 flex justify-between">
                                <span>Valor da Parcela:</span>
                                <strong>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((formData.total_value || 0) / (formData.installments_count || 1))}
                                </strong>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                                <Button className="flex-1 bg-brand-600 hover:bg-brand-700" onClick={handleSave}>Salvar</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
