import { type FC, useState, useEffect } from 'react';
import { Button, Card } from '../components/ui';
import {
    Search,
    CheckCircle,
    AlertCircle,
    Download,
    Eye,
    EyeOff,
    TrendingUp,
    Clock,
    QrCode,
    ArrowUpRight,
    ArrowDownRight,
    Calendar,
    CreditCard,
    Loader2,
    Wallet,
    Plus
} from 'lucide-react';
import { NewChargeModal } from '../components/modals/NewChargeModal';
import { supabase } from '../services/supabase';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';
import { triggerImmediateDunning } from '../services/dunning-engine';
import { usePlan } from '../hooks/usePlan';

import { parseLocalDate, formatCurrency } from '../utils/core_formatters';

// ... imports remain the same

export const FinancialReceivablesView: FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const { currentSchool } = useAuth();
    const { hasModule } = usePlan();
    const [loading, setLoading] = useState(true);
    const [installments, setInstallments] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalCount, setTotalCount] = useState(0);

    // Stats State
    const [stats, setStats] = useState({
        expected: 0,
        received: 0,
        overdue: 0,
        discounts: 0,
        overdueCount: 0
    });

    // Gateway State
    const [gatewayConfig, setGatewayConfig] = useState<any>(null);
    const [generatingPaymentId, setGeneratingPaymentId] = useState<string | null>(null);
    const [isNewChargeModalOpen, setIsNewChargeModalOpen] = useState(false);

    // Advanced Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [periodFilter, setPeriodFilter] = useState('this_month'); // Default to current month
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchGatewayConfig();
    }, [currentSchool]);

    const fetchGatewayConfig = async () => {
        if (!currentSchool) return;
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'finance_gateway_config')
            .eq('school_id', currentSchool.id)
            .single();

        if (data?.value) {
            // Check if stringified or object (Supabase returns JSONB as object usually, but let's be safe)
            const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            setGatewayConfig(config);
        }
    };

    const fetchInstallments = async () => {
        setLoading(true);
        try {
            if (!currentSchool) return;

            // Calculate Range
            const from = (currentPage - 1) * pageSize;
            const to = from + pageSize - 1;

            let query = supabase
                .from('installments')
                .select(`
                    *,
                    enrollment:enrollments!inner (
                        id,
                        candidate_name,
                        student_id,
                        details,
                        school_id,
                        student:students(photo_url)
                    )
                `, { count: 'exact' });

            query = query.eq('enrollment.school_id', currentSchool.id);

            // Apply Status Filter
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            // Apply Search Term (Server-side)
            if (searchTerm) {
                const term = `%${searchTerm}%`;
                // Search in Invoice Number, Candidate Name, and Parent CPF (JSONB)
                query = query.or(`invoice_number.ilike.${term},enrollment.candidate_name.ilike.${term},enrollment.details->>parent_cpf.ilike.${term}`);
            }

            // Apply Date Filter based on periodFilter
            const now = new Date();
            const formatYMD = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            let startDateStr: string | null = null;
            let endDateStr: string | null = null;

            if (periodFilter === 'today') {
                const todayStr = formatYMD(now);
                startDateStr = todayStr;
                endDateStr = todayStr;
            } else if (periodFilter === 'this_month') {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                startDateStr = formatYMD(start);
                endDateStr = formatYMD(end);
            } else if (periodFilter === 'last_month') {
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0);
                startDateStr = formatYMD(start);
                endDateStr = formatYMD(end);
            } else if (periodFilter === 'this_year') {
                startDateStr = `${now.getFullYear()}-01-01`;
                endDateStr = `${now.getFullYear()}-12-31`;
            }

            if (startDateStr && endDateStr) {
                query = query.gte('due_date', startDateStr).lte('due_date', endDateStr);
            }

            // Pagination & Order
            const { data, error, count } = await query
                .order('due_date', { ascending: true })
                .range(from, to);

            if (error) throw error;

            setInstallments(data || []);
            setTotalCount(count || 0);

        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao carregar mensalidades');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            if (!currentSchool) return;

            let query = supabase
                .from('installments')
                .select(`
                    value,
                    status,
                    due_date,
                    discount_value,
                    enrollment:enrollments!inner (
                        candidate_name,
                        school_id,
                        details
                    )
                `);

            query = query.eq('enrollment.school_id', currentSchool.id);

            // Apply same filters as fetchInstallments
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            if (searchTerm) {
                const term = `%${searchTerm}%`;
                query = query.or(`invoice_number.ilike.${term},enrollment.candidate_name.ilike.${term},enrollment.details->>parent_cpf.ilike.${term}`);
            }

            const now = new Date();
            const formatYMD = (date: Date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            let startDateStr: string | null = null;
            let endDateStr: string | null = null;

            if (periodFilter === 'today') {
                const todayStr = formatYMD(now);
                startDateStr = todayStr;
                endDateStr = todayStr;
            } else if (periodFilter === 'this_month') {
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                startDateStr = formatYMD(start);
                endDateStr = formatYMD(end);
            } else if (periodFilter === 'last_month') {
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0);
                startDateStr = formatYMD(start);
                endDateStr = formatYMD(end);
            } else if (periodFilter === 'this_year') {
                startDateStr = `${now.getFullYear()}-01-01`;
                endDateStr = `${now.getFullYear()}-12-31`;
            }

            if (startDateStr && endDateStr) {
                query = query.gte('due_date', startDateStr).lte('due_date', endDateStr);
            }

            const { data, error } = await query;
            if (error) throw error;

            const newStats = (data || []).reduce((acc: any, curr: any) => {
                if (curr.status === 'cancelled') return acc;

                const val = Number(curr.value || 0);
                const discount = Number(curr.discount_value || 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDate = parseLocalDate(curr.due_date);
                const isOverdue = curr.status === 'pending' && dueDate < today;

                acc.expected += val;
                if (curr.status === 'paid') acc.received += val;
                if (isOverdue) {
                    acc.overdue += val;
                    acc.overdueCount++;
                }
                acc.discounts += discount;
                return acc;
            }, { expected: 0, received: 0, overdue: 0, discounts: 0, overdueCount: 0 });

            setStats(newStats);

        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(installments.map(i => i.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleGeneratePayment = async (installment: any) => {
        // Prevent click propogation if called from row

        if (!gatewayConfig || gatewayConfig.provider !== 'asaas') {
            addToast('info', 'Configure o Gateway Asaas nas configurações para usar este recurso.');
            return;
        }

        const isConfirmed = await confirm({
            title: 'Gerar Cobrança (Pix/Boleto)',
            message: `Deseja gerar uma cobrança no Asaas para ${installment.enrollment?.candidate_name}? O responsável receberá o link por e-mail/WhatsApp se configurado.`,
            confirmText: 'Gerar Cobrança'
        });

        if (!isConfirmed) return;

        setGeneratingPaymentId(installment.id);
        try {
            // CALL EDGE FUNCTION (STUB)
            // const { data, error } = await supabase.functions.invoke('send-payment-link', {
            //     body: { installmentId: installment.id }
            // });

            // For now, simulate functionality or wait for backend implementation
            console.log('Generating payment for:', installment.id);

            // Simulate success for UI testing (remove this when backend is ready)
            // await new Promise(r => setTimeout(r, 1500));
            // addToast('success', 'Cobrança gerada com sucesso! (Simulação)');

            // REAL IMPLEMENTATION:
            const { error } = await supabase.functions.invoke('send-payment-link', {
                body: { installment_ids: [installment.id] }
            });

            if (error) throw error;

            addToast('success', 'Cobrança gerada com sucesso!');

            // DUNNING TRIGGER: If dunning module is active, trigger "CREATION" events immediately
            if (hasModule('dunning') && currentSchool) {
                console.log('Triggering Dunning for CREATION event...');
                triggerImmediateDunning(supabase, currentSchool.id, installment.id, 'CREATION')
                    .catch(e => console.error('Error triggering dunning:', e));
            }

            fetchInstallments();
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro ao gerar cobrança: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setGeneratingPaymentId(null);
        }
    };

    const handleBulkAction = async (action: 'publish' | 'hide' | 'mark_paid' | 'generate_boleto') => {
        // ... (Existing implementation for publish/hide/mark_paid)
        if (action === 'generate_boleto') {
            if (!gatewayConfig || gatewayConfig.provider !== 'asaas') {
                addToast('info', 'Configure o Gateway Asaas para usar este recurso.');
                return;
            }
            const isConfirmed = await confirm({
                title: 'Gerar Cobranças em Massa',
                message: `Deseja gerar Pix/Boleto para ${selectedIds.length} mensalidades selecionadas?`,
                confirmText: 'Gerar Todas'
            });
            if (!isConfirmed) return;

            setIsBulkActionLoading(true);
            try {
                const { error } = await supabase.functions.invoke('send-payment-link', {
                    body: { installment_ids: selectedIds }
                });
                if (error) throw error;
                addToast('success', 'Processo de geração iniciado!');

                // DUNNING TRIGGER (Bulk): For each generated charge
                if (hasModule('dunning') && currentSchool) {
                    triggerImmediateDunning(supabase, currentSchool.id, selectedIds, 'CREATION')
                        .catch(e => console.error('Error in bulk dunning trigger:', e));
                }

                fetchInstallments();
                setSelectedIds([]);
            } catch (err: any) {
                addToast('error', 'Erro ao gerar: ' + err.message);
            } finally {
                setIsBulkActionLoading(false);
            }
            return;
        }

        // Existing logic for local updates
        const isConfirmed = await confirm({
            title: 'Ação em Massa',
            message: `Tem certeza que deseja aplicar esta ação em ${selectedIds.length} itens?`,
            type: 'warning',
            confirmText: 'Confirmar'
        });

        if (!isConfirmed) return;

        setIsBulkActionLoading(true);
        try {
            let updates: any = {};

            if (action === 'publish') updates = { is_published: true };
            if (action === 'hide') updates = { is_published: false };
            if (action === 'mark_paid') {
                updates = {
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    payment_method: 'bulk_manual' // Marker for bulk updates
                };
            }

            const { error } = await supabase
                .from('installments')
                .update(updates)
                .in('id', selectedIds);

            if (error) throw error;

            addToast('success', 'Ação em massa concluída com sucesso!');
            setSelectedIds([]);
            fetchInstallments();
        } catch (error: any) {
            console.error(error);
            addToast('error', 'Erro na ação em massa: ' + error.message);
        } finally {
            setIsBulkActionLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, periodFilter, searchTerm, pageSize]);

    useEffect(() => {
        fetchInstallments();
    }, [statusFilter, periodFilter, searchTerm, pageSize, currentPage]);

    useEffect(() => {
        fetchStats();
    }, [statusFilter, periodFilter, searchTerm]);


    const getStatusBadge = (status: string, dueDateStr: string) => {
        if (status === 'cancelled') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                    <EyeOff className="w-3.5 h-3.5" /> Cancelado
                </span>
            );
        }

        const dueDate = parseLocalDate(dueDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const isOverdue = status === 'pending' && dueDate < today;

        if (status === 'paid') {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="w-3.5 h-3.5" /> Pago
                </span>
            );
        }
        if (isOverdue) {
            return (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                    <AlertCircle className="w-3.5 h-3.5" /> Atrasado
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                <Clock className="w-3.5 h-3.5" /> Pendente
            </span>
        );
    };

    // Shared KpiCard Component (100% Match with Financial Dashboard)
    const KpiCard = ({ label, value, icon: Icon, color, bg, subLabel, trend }: any) => (
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-3">
                <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
                {trend && (
                    <span className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
                <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {typeof value === 'number'
                        ? formatCurrency(value)
                        : value}
                </h3>
                {subLabel && <p className="text-xs text-gray-400 mt-1 font-medium">{subLabel}</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Mensalidades</h1>
                    <p className="text-gray-500 mt-1">Gestão completa de cobranças e recebimentos.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" className="bg-white">
                        <Download className="w-4 h-4 mr-2" /> Exportar Relatório
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/financeiro/planos')} className="bg-white">
                        <Wallet className="w-4 h-4 mr-2" />
                        Planos & Preços
                    </Button>
                    <Button className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/20" onClick={() => setIsNewChargeModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Lançamento
                    </Button>
                </div>
            </div>

            {/* KPI Cards (100% Consistent with Financial Dashboard) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Receita Prevista"
                    value={stats.expected}
                    icon={Calendar}
                    color="text-gray-600"
                    bg="bg-gray-50"
                    subLabel="Total no período"
                />
                <KpiCard
                    label="Recebido"
                    value={stats.received}
                    icon={TrendingUp}
                    color="text-green-600"
                    bg="bg-green-50"
                    trend={12.5}
                />
                <KpiCard
                    label="Inadimplência"
                    value={stats.overdue}
                    icon={AlertCircle}
                    color="text-red-600"
                    bg="bg-red-50"
                    subLabel={`${stats.overdueCount} parcelas atrasadas`}
                    trend={-2.4}
                />
                <KpiCard
                    label="Descontos"
                    value={stats.discounts}
                    icon={ArrowDownRight}
                    color="text-orange-600"
                    bg="bg-orange-50"
                    subLabel="Total concedido"
                />
            </div>

            {/* Main Content Card */}
            <Card className="border border-gray-200 shadow-sm overflow-hidden">
                {/* Filters Toolbar */}
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col xl:flex-row gap-4 justify-between items-end xl:items-center">

                    <div className="flex-1 w-full xl:max-w-md relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium"
                            placeholder="Buscar por aluno, matrícula..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap gap-3 w-full xl:w-auto">
                        <select
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 font-medium text-gray-600 cursor-pointer hover:border-brand-300"
                            value={periodFilter}
                            onChange={(e) => setPeriodFilter(e.target.value)}
                        >
                            <option value="all">Todo o Período</option>
                            <option value="today">Hoje</option>
                            <option value="this_month">Este Mês</option>
                            <option value="last_month">Mês Anterior</option>
                            <option value="this_year">Este Ano</option>
                        </select>

                        <div className="h-6 w-px bg-gray-300 hidden md:block mx-1"></div>

                        <div className="flex bg-gray-200 p-1 rounded-lg overflow-x-auto max-w-full">
                            {['all', 'paid', 'pending', 'overdue', 'cancelled'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`
                                        px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize whitespace-nowrap
                                        ${statusFilter === status
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }
                                    `}
                                >
                                    {status === 'all' ? 'Todos' :
                                        status === 'paid' ? 'Pagos' :
                                            status === 'pending' ? 'Pendentes' :
                                                status === 'overdue' ? 'Atrasados' :
                                                    'Cancelados'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/80 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 w-4">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                        checked={installments.length > 0 && selectedIds.length === installments.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Vencimento</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Aluno</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Fatura</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">Ref.</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Valor</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Gateway</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4 w-4"><div className="h-4 w-4 bg-gray-200 rounded" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                                        <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded w-24" /></td>
                                    </tr>
                                ))
                            ) : installments.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                <Search className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <p className="text-lg font-medium text-gray-900">Nenhuma mensalidade encontrada</p>
                                            <p className="text-sm">Tente ajustar os filtros de data ou status.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                installments.map((inst) => (
                                    <tr
                                        key={inst.id}
                                        onClick={() => navigate(`/financeiro/cobranca/${inst.id}`)}
                                        className="hover:bg-blue-50/50 border-t border-gray-100 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                                checked={selectedIds.includes(inst.id)}
                                                onChange={() => toggleSelection(inst.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {parseLocalDate(inst.due_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                                </span>
                                                <span className="text-xs text-gray-400 font-medium">
                                                    {parseLocalDate(inst.due_date).getFullYear()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs uppercase overflow-hidden border border-brand-200 flex-shrink-0">
                                                    {inst.enrollment?.student?.photo_url ? (
                                                        <img src={inst.enrollment.student.photo_url} className="w-full h-full object-cover" alt={inst.enrollment.candidate_name} />
                                                    ) : (
                                                        inst.enrollment?.candidate_name?.substring(0, 2) || 'AL'
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900">{inst.enrollment?.candidate_name}</span>
                                                    <span className="text-xs text-gray-400">Matrícula #{inst.enrollment_id?.slice(0, 6)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-brand-600 font-mono">
                                            {inst.invoice_number || '---'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={inst.metadata?.description || `${inst.installment_number}ª Parcela`}>
                                            {inst.metadata?.description || `${inst.installment_number}ª Parcela`}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 font-mono">
                                            {formatCurrency(inst.value)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(inst.status, inst.due_date)}
                                        </td>
                                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                            {/* GATEWAY LOGIC */}
                                            {inst.billing_url ? (
                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={inst.billing_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1.5 rounded-md border border-brand-100 hover:bg-brand-100 transition-colors"
                                                    >
                                                        <QrCode className="w-3.5 h-3.5" />
                                                        Boleto/Pix
                                                    </a>
                                                </div>
                                            ) : gatewayConfig?.provider === 'asaas' && inst.status === 'pending' ? (
                                                <Button
                                                    size="sm"
                                                    disabled={generatingPaymentId === inst.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleGeneratePayment(inst);
                                                    }}
                                                    className="h-7 text-xs bg-gray-900 hover:bg-gray-800 text-white"
                                                >
                                                    {generatingPaymentId === inst.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                                    ) : (
                                                        <CreditCard className="w-3 h-3 mr-1.5" />
                                                    )}
                                                    Gerar
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Itens por página:</span>
                            <select
                                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                            >
                                {[25, 50, 75, 100, 200, 300].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                        <span className="text-sm text-gray-500 font-medium">
                            {totalCount > 0 ? (
                                <>
                                    Mostrando <span className="font-bold text-gray-900">{(currentPage - 1) * pageSize + 1}</span> a <span className="font-bold text-gray-900">{Math.min(currentPage * pageSize, totalCount)}</span> de <span className="font-bold text-gray-900">{totalCount}</span>
                                </>
                            ) : (
                                'Sem registros'
                            )}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1 || loading}
                            onClick={() => setCurrentPage(prev => prev - 1)}
                            className="bg-white"
                        >
                            Anterior
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, Math.ceil(totalCount / pageSize)) }).map((_, i) => {
                                const totalPages = Math.ceil(totalCount / pageSize);
                                let pageNum = i + 1;

                                // Logic to show pages around current page if total pages > 5
                                if (totalPages > 5) {
                                    if (currentPage > 3) {
                                        pageNum = currentPage - 2 + i;
                                    }
                                    if (pageNum > totalPages) {
                                        pageNum = totalPages - (4 - i);
                                    }
                                }

                                if (pageNum > totalPages || pageNum < 1) return null;

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === pageNum
                                            ? 'bg-brand-600 text-white shadow-md shadow-brand-200'
                                            : 'text-gray-500 hover:bg-white hover:text-brand-600'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="bg-white"
                        >
                            Próximo
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 flex items-center gap-6 z-50 animate-slide-up">
                    <div className="flex items-center gap-2 border-r border-gray-200 pr-6">
                        <span className="bg-brand-100 text-brand-700 font-bold px-2 py-0.5 rounded text-sm">
                            {selectedIds.length}
                        </span>
                        <span className="text-sm font-medium text-gray-600">selecionados</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Gateway Bulk Action */}
                        {gatewayConfig?.provider === 'asaas' && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBulkAction('generate_boleto')}
                                disabled={isBulkActionLoading}
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 mr-2"
                            >
                                <QrCode className="w-4 h-4 mr-2 text-brand-600" /> Gerar Boletos
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkAction('publish')}
                            disabled={isBulkActionLoading}
                        >
                            <Eye className="w-4 h-4 mr-2" /> Publicar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkAction('hide')}
                            disabled={isBulkActionLoading}
                        >
                            <EyeOff className="w-4 h-4 mr-2" /> Ocultar
                        </Button>
                        <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
                            onClick={() => handleBulkAction('mark_paid')}
                            disabled={isBulkActionLoading}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Pago
                        </Button>
                    </div>

                    <button
                        onClick={() => setSelectedIds([])}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                </div>
            )}
            {/* New Charge Modal */}
            <NewChargeModal
                isOpen={isNewChargeModalOpen}
                onClose={() => setIsNewChargeModalOpen(false)}
                onSuccess={() => {
                    fetchInstallments();
                }}
            />
        </div>
    );
};
