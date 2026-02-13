
import { type FC, useState, useEffect } from 'react';
import { Card, Button, Input, Modal } from '../components/ui';
import {
    Plus, Filter, Calendar,
    CheckCircle, AlertCircle, Loader2, Trash2, Edit2,
    Clock, Search
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';

// Types
interface Category {
    id: string;
    name: string;
}

interface Transaction {
    id: string;
    description: string;
    amount: number;
    category_id: string;
    category?: { name: string };
    due_date: string;
    payment_date?: string;
    status: 'pending' | 'paid' | 'cancelled';
    notes?: string;
}

export const AccountsPayableView: FC = () => {
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // Filters
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Transaction | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        category_id: '',
        due_date: new Date().toLocaleDateString('en-CA'),
        notes: ''
    });

    // Stats
    const stats = {
        total: expenses.reduce((acc, curr) => acc + Number(curr.amount), 0),
        paid: expenses.filter(e => e.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0),
        pending: expenses.filter(e => e.status === 'pending').reduce((acc, curr) => acc + Number(curr.amount), 0),
        overdue: expenses.filter(e => e.status === 'pending' && new Date(e.due_date) < new Date()).reduce((acc, curr) => acc + Number(curr.amount), 0)
    };

    useEffect(() => {
        fetchData();
        fetchCategories();
    }, [month, year, currentSchool]);

    const fetchCategories = async () => {
        if (!currentSchool) return;
        const { data } = await supabase
            .from('financial_categories')
            .select('*')
            .eq('type', 'expense')
            .eq('school_id', currentSchool.id)
            .order('name');
        if (data) setCategories(data);
    };

    const fetchData = async () => {
        if (!currentSchool) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Start/End of month
            // FIX: Removed spaces in template literal that caused "2025 -12-01" error
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toLocaleDateString('en-CA');

            const { data, error } = await supabase
                .from('financial_transactions')
                .select('*, category:financial_categories(name)')
                .eq('type', 'expense')
                .eq('school_id', currentSchool.id)
                .gte('due_date', startDate)
                .lte('due_date', endDate)
                .order('due_date', { ascending: true });

            if (error) throw error;
            setExpenses(data || []);

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao carregar despesas');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.description || !formData.amount || !formData.category_id) {
            addToast('error', 'Preencha os campos obrigatórios');
            return;
        }

        if (!currentSchool) return;

        setIsSaving(true);
        try {
            const payload = {
                description: formData.description,
                amount: parseFloat(formData.amount.replace(',', '.')), // Basic sanitization
                category_id: formData.category_id,
                due_date: formData.due_date,
                notes: formData.notes,
                type: 'expense',
                status: 'pending', // Default
                school_id: currentSchool.id
            };

            let error;
            if (editingExpense) {
                const { error: err } = await supabase
                    .from('financial_transactions')
                    .update(payload)
                    .eq('id', editingExpense.id);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('financial_transactions')
                    .insert(payload);
                error = err;
            }

            if (error) throw error;

            addToast('success', editingExpense ? 'Despesa atualizada!' : 'Despesa criada!');
            setIsModalOpen(false);
            setEditingExpense(null);
            resetForm();
            fetchData();

        } catch (error: any) {
            addToast('error', 'Erro ao salvar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleMarkAsPaid = async (expense: Transaction) => {
        const isConfirmed = await confirm({
            title: 'Confirmar Pagamento',
            message: `Confirmar pagamento de ${expense.description}?`,
            type: 'success',
            confirmText: 'Confirmar Pagamento'
        });

        if (!isConfirmed) return;

        const { error } = await supabase
            .from('financial_transactions')
            .update({
                status: 'paid',
                payment_date: new Date().toLocaleDateString('en-CA')
            })
            .eq('id', expense.id);

        if (error) addToast('error', 'Erro ao atualizar');
        else {
            addToast('success', 'Marcado como pago!');
            fetchData();
        }
    };

    const handleDelete = async (id: string) => {
        const isConfirmed = await confirm({
            title: 'Excluir Despesa',
            message: 'Tem certeza que deseja excluir esta despesa?',
            type: 'danger',
            confirmText: 'Excluir'
        });

        if (!isConfirmed) return;

        const { error } = await supabase
            .from('financial_transactions')
            .delete()
            .eq('id', id);

        if (error) addToast('error', 'Erro ao excluir');
        else {
            addToast('success', 'Despesa excluída');
            fetchData();
        }
    };

    const openModal = (expense?: Transaction) => {
        if (expense) {
            setEditingExpense(expense);
            setFormData({
                description: expense.description,
                amount: String(expense.amount),
                category_id: expense.category_id,
                due_date: expense.due_date,
                notes: expense.notes || ''
            });
        } else {
            setEditingExpense(null);
            resetForm();
        }
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({
            description: '',
            amount: '',
            category_id: categories.length > 0 ? categories[0].id : '',
            due_date: new Date().toLocaleDateString('en-CA'),
            notes: ''
        });
    };

    const filteredExpenses = expenses
        .filter(e => statusFilter === 'all' || e.status === statusFilter)
        .filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Contas a Pagar</h1>
                    <p className="text-gray-500 mt-1">Gerencie suas despesas e mantenha o fluxo de caixa saudável.</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center px-3 border-r border-gray-200">
                        <select
                            className="bg-transparent text-sm font-medium outline-none text-gray-700 cursor-pointer hover:text-brand-600 transition-colors"
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                        <span className="mx-2 text-gray-300">/</span>
                        <select
                            className="bg-transparent text-sm font-medium outline-none text-gray-700 cursor-pointer hover:text-brand-600 transition-colors"
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <Button onClick={() => openModal()} className="bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20">
                        <Plus className="w-4 h-4 mr-2" /> Nova Despesa
                    </Button>
                </div>
            </div>

            {/* Smart Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            TOTAL PREVISTO
                        </p>
                        <h3 className="text-2xl font-bold text-gray-900">
                            {stats.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            TOTAL PAGO
                        </p>
                        <h3 className="text-2xl font-bold text-green-600">
                            {stats.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                            PENDENTE
                        </p>
                        <h3 className="text-2xl font-bold text-yellow-600">
                            {stats.pending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                    <div className="relative">
                        <p className="text-sm font-semibold text-gray-500 mb-1 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            ATRASADO
                        </p>
                        <h3 className="text-2xl font-bold text-red-600">
                            {stats.overdue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </h3>
                        {stats.overdue > 0 && (
                            <p className="text-xs text-red-500 mt-1 font-medium flex items-center">
                                <AlertCircle className="w-3 h-3 mr-1" /> Atenção requerida
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Filters & Actions Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
                    {[
                        { id: 'all', label: 'Todas' },
                        { id: 'pending', label: 'Pendentes' },
                        { id: 'paid', label: 'Pagas' }
                    ].map((f: any) => (
                        <button
                            key={f.id}
                            onClick={() => setStatusFilter(f.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${statusFilter === f.id
                                ? 'bg-brand-50 text-brand-700 font-semibold ring-1 ring-brand-200'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar despesa..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <Card className="overflow-hidden border-0 shadow-lg ring-1 ring-gray-100">
                {loading ? (
                    <div className="p-20 flex flex-col items-center justify-center text-gray-400">
                        <Loader2 className="w-10 h-10 animate-spin mb-4 text-brand-500" />
                        <p>Carregando despesas...</p>
                    </div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center">
                        <div className="bg-gray-50 p-6 rounded-full mb-4">
                            <Filter className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Nenhuma despesa encontrada</h3>
                        <p className="text-gray-500 mt-1 max-w-md">
                            Não encontramos lançamentos para os filtros selecionados. Tente ajustar a busca ou adicione uma nova despesa.
                        </p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-500 uppercase text-xs tracking-wider">Vencimento</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 uppercase text-xs tracking-wider">Descrição</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 uppercase text-xs tracking-wider">Categoria</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 uppercase text-xs tracking-wider text-right">Valor</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 uppercase text-xs tracking-wider text-center">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 uppercase text-xs tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredExpenses.map(expense => {
                                const isOverdue = expense.status === 'pending' && new Date(expense.due_date) < new Date();
                                return (
                                    <tr key={expense.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-gray-600 font-medium">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                {new Date(expense.due_date).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">{expense.description}</div>
                                            {expense.notes && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{expense.notes}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                                {expense.category?.name || 'Geral'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-mono font-bold text-gray-700">
                                                {expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {expense.status === 'paid' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100/50 text-green-700 border border-green-200">
                                                    <CheckCircle className="w-3 h-3 mr-1" /> PAGO
                                                </span>
                                            ) : isOverdue ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100/50 text-red-700 border border-red-200">
                                                    <Clock className="w-3 h-3 mr-1" /> ATRASADO
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100/50 text-yellow-700 border border-yellow-200">
                                                    <Clock className="w-3 h-3 mr-1" /> PENDENTE
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {expense.status !== 'paid' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleMarkAsPaid(expense)}
                                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        title="Marcar como Pago"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => openModal(expense)} className="text-gray-500 hover:text-brand-600 hover:bg-brand-50">
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)} className="text-gray-400 hover:text-red-600 hover:bg-red-50">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </Card>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingExpense ? "Editar Despesa" : "Nova Despesa"}
            >
                <div className="space-y-5">
                    <Input
                        label="Descrição"
                        placeholder="Ex: Aluguel de Fevereiro"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Valor (R$)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">R$</span>
                                <Input
                                    type="number"
                                    className="pl-10"
                                    placeholder="0,00"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vencimento</label>
                            <Input
                                type="date"
                                value={formData.due_date}
                                onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Categoria</label>
                        <select
                            className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-shadow"
                            value={formData.category_id}
                            onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                        >
                            <option value="">Selecione uma categoria...</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <Input
                        label="Observações (Opcional)"
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Detalhes adicionais..."
                    />

                    <div className="flex justify-end pt-4 gap-3">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/30" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                            Salvar Lançamento
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
