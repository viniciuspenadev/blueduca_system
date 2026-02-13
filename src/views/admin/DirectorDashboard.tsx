import { type FC, useState, useEffect } from 'react';
import {
    DollarSign,
    Users,
    TrendingUp,
    CheckCircle2,
    Clock,
    AlertCircle,
    MessageSquare,
    Zap,
    RefreshCw
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    Label,
    Legend
} from 'recharts';
import { Card } from '../../components/ui';
import { supabase } from '../../services/supabase';
import { SchoolOnboardingProgress } from '../../components/SchoolOnboardingProgress';

export const DirectorDashboard: FC = () => {
    const [timeRange, setTimeRange] = useState('month');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    const DEFAULT_DASHBOARD_DATA = {
        financial: { generated: 0, paid: 0, pending: 0, overdue: 0, conversion_rate: 0 },
        evolution: [],
        engagement: { reading_rate: 0, active_parents: 0, total_messages: 0 },
        engagement_daily: [],
        last_updated: new Date().toISOString()
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const { data: rpcData, error } = await supabase.rpc('get_my_dashboard_stats');
            if (error) throw error;
            setData(rpcData || DEFAULT_DASHBOARD_DATA);
        } catch (err) {
            console.error('Erro ao carregar dashboard:', err);
            setData(DEFAULT_DASHBOARD_DATA);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
            </div>
        );
    }

    // Ensure data exists (fallback to default if somehow null)
    const activeData = data || DEFAULT_DASHBOARD_DATA;
    const { financial, evolution, engagement, engagement_daily } = activeData;

    // Adaptar dados para o formato anterior

    // Se não tiver dados reais calculados, calcular as porcentagens aqui para a UI
    const total = financial.generated || 1;
    const paymentUI = [
        { name: 'Pago', value: Math.round((financial.paid / total) * 100), color: '#10b981' },
        { name: 'Pendente', value: Math.round((financial.pending / total) * 100), color: '#f59e0b' },
        { name: 'Atrasado', value: Math.round((financial.overdue / total) * 100), color: '#ef4444' },
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header / Intro */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">Resumo da Diretoria</h1>
                    <p className="text-xs lg:text-sm text-slate-500">Visão estratégica baseada em dados reais.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={fetchDashboardData}
                        className="p-2 text-slate-400 hover:text-brand-600 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200"
                        title="Atualizar Dados"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                        <button
                            onClick={() => setTimeRange('week')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'week' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            7 DIAS
                        </button>
                        <button
                            onClick={() => setTimeRange('month')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'month' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            ESTE MÊS
                        </button>
                        <button
                            onClick={() => setTimeRange('year')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${timeRange === 'year' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            ESTE ANO
                        </button>
                    </div>
                </div>
            </div>

            {/* Onboarding Guide (Modal) */}
            <SchoolOnboardingProgress />


            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-4 lg:p-6 relative overflow-hidden group hover:shadow-xl transition-all border-none bg-gradient-to-br from-white to-brand-50">
                    <div className="flex justify-between items-start mb-3 lg:mb-4">
                        <div className="p-2 bg-brand-100 rounded-lg text-brand-600">
                            <DollarSign size={18} className="lg:w-5 lg:h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] lg:text-sm font-medium text-slate-500 uppercase tracking-wider">Receita Gerada</p>
                        <h2 className="text-xl lg:text-2xl font-bold text-slate-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financial.generated)}
                        </h2>
                        <p className="text-[10px] lg:text-xs text-slate-400 mt-1">Total acumulado</p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <DollarSign size={100} />
                    </div>
                </Card>

                <Card className="p-4 lg:p-6 relative overflow-hidden group hover:shadow-xl transition-all border-none bg-gradient-to-br from-white to-emerald-50">
                    <div className="flex justify-between items-start mb-3 lg:mb-4">
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                            <CheckCircle2 size={18} className="lg:w-5 lg:h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] lg:text-sm font-medium text-slate-500 uppercase tracking-wider">Receita Paga</p>
                        <h2 className="text-xl lg:text-2xl font-bold text-slate-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financial.paid)}
                        </h2>
                        <p className="text-[10px] lg:text-xs text-slate-400 mt-1">Conversão de {financial.conversion_rate}%</p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CheckCircle2 size={100} />
                    </div>
                </Card>

                <Card className="p-4 lg:p-6 relative overflow-hidden group hover:shadow-xl transition-all border-none bg-gradient-to-br from-white to-amber-50">
                    <div className="flex justify-between items-start mb-3 lg:mb-4">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                            <Clock size={18} className="lg:w-5 lg:h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] lg:text-sm font-medium text-slate-500 uppercase tracking-wider">Pendente</p>
                        <h2 className="text-xl lg:text-2xl font-bold text-slate-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financial.pending)}
                        </h2>
                        <p className="text-[10px] lg:text-xs text-slate-400 mt-1">Aguardando vencimento</p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Clock size={100} />
                    </div>
                </Card>

                <Card className="p-4 lg:p-6 relative overflow-hidden group hover:shadow-xl transition-all border-none bg-gradient-to-br from-white to-red-50">
                    <div className="flex justify-between items-start mb-3 lg:mb-4">
                        <div className="p-2 bg-red-100 rounded-lg text-red-600">
                            <AlertCircle size={18} className="lg:w-5 lg:h-5" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] lg:text-sm font-medium text-slate-500 uppercase tracking-wider">Atrasado</p>
                        <h2 className="text-xl lg:text-2xl font-bold text-slate-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financial.overdue)}
                        </h2>
                        <p className="text-[10px] lg:text-xs text-slate-400 mt-1">Ações de cobrança necessárias</p>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <AlertCircle size={100} />
                    </div>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 p-4 lg:p-6 overflow-hidden border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-6 lg:mb-8">
                        <div>
                            <h3 className="text-base lg:text-lg font-bold text-slate-800">Evolução Financeira</h3>
                            <p className="text-[10px] lg:text-xs text-slate-400">Últimos meses de faturamento</p>
                        </div>
                        <TrendingUp className="text-slate-300 lg:w-5 lg:h-5" size={18} />
                    </div>
                    <div className="h-[220px] lg:h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolution}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickFormatter={(value) => `R$ ${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [`R$ ${value.toLocaleString()}`, '']}
                                />
                                <Legend
                                    verticalAlign="top"
                                    align="right"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{value}</span>}
                                />
                                <Area
                                    name="Previsto"
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                />
                                <Area
                                    name="Realizado"
                                    type="monotone"
                                    dataKey="paid"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorPaid)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-4 lg:p-6 flex flex-col border-none shadow-sm bg-white hover:shadow-md transition-shadow h-full">
                    <h3 className="text-base lg:text-lg font-bold text-slate-800 mb-4 lg:mb-6">Status dos Recebíveis</h3>
                    <div className="h-[200px] lg:h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                <Pie
                                    data={paymentUI}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={85}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {paymentUI.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                    <Label
                                        value={`${financial.conversion_rate}%`}
                                        position="center"
                                        fill="#1e293b"
                                        style={{ fontSize: '26px', fontWeight: '900' }}
                                    />
                                    <Label
                                        value="Recebido"
                                        position="center"
                                        dy={22}
                                        fill="#64748b"
                                        style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                    />
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between w-full mt-6 lg:mt-8 px-2">
                        {paymentUI.map((item) => (
                            <div key={item.name} className="flex flex-col items-center text-center">
                                <span className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1 lg:gap-1.5">
                                    <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                    {item.name}
                                </span>
                                <span className="text-base lg:text-lg font-black text-slate-800 leading-none">{item.value}%</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Engagement Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4 lg:p-6">
                    <div className="flex justify-between items-center mb-4 lg:mb-6">
                        <div>
                            <h3 className="text-base lg:text-lg font-bold text-slate-800">Acessos Diários</h3>
                            <p className="text-xs lg:text-sm text-slate-500">Usuários ativos na plataforma</p>
                        </div>
                        <Users className="text-slate-300 lg:w-5 lg:h-5" size={18} />
                    </div>
                    <div className="h-[220px] lg:h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={engagement_daily}>
                                <defs>
                                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [value, 'Usuários Ativos']}
                                    labelStyle={{ color: '#64748b', marginBottom: '0.25rem' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="active"
                                    stroke="#0ea5e9"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorActive)"
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <div className="space-y-6">
                    <Card className="p-4 lg:p-6">
                        <div className="flex justify-between items-center mb-3 lg:mb-4">
                            <h3 className="text-base lg:text-lg font-bold text-slate-800">Alcance de Comunicação</h3>
                            <MessageSquare className="text-brand-500 lg:w-5 lg:h-5" size={18} />
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-slate-600">Taxa de Leitura Global</span>
                                    <span className="text-sm font-bold text-brand-700">{engagement.reading_rate}%</span>
                                </div>
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-brand-500 rounded-full shadow-sm shadow-brand-500/20 transition-all duration-1000"
                                        style={{ width: `${engagement.reading_rate}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 lg:gap-4">
                                <div className="p-3 lg:p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Users size={12} className="text-slate-400 lg:w-3.5 lg:h-3.5" />
                                        <span className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase">Pais Ativos (7d)</span>
                                    </div>
                                    <p className="text-lg lg:text-xl font-bold text-slate-900">{engagement.active_parents}</p>
                                </div>
                                <div className="p-3 lg:p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-2 mb-1">
                                        <MessageSquare size={12} className="text-orange-400 lg:w-3.5 lg:h-3.5" />
                                        <span className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase">Total Mensagens</span>
                                    </div>
                                    <p className="text-lg lg:text-xl font-bold text-slate-900">{engagement.total_messages}</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-4 lg:p-6 bg-brand-900 text-white border-none shadow-xl shadow-brand-900/20">
                        <h3 className="text-base lg:text-lg font-bold mb-3 lg:mb-4 flex items-center gap-2">
                            <Zap className="text-brand-300 lg:w-4.5 lg:h-4.5" size={16} />
                            Insights do Diretor
                        </h3>
                        <div className="space-y-3">
                            {financial.overdue > 0 && (
                                <div className="flex items-center gap-3 text-sm p-3 bg-white/10 rounded-xl border border-white/10 hover:bg-white/15 transition-colors cursor-pointer">
                                    <div className="w-8 h-8 bg-brand-400/20 rounded-full flex items-center justify-center text-brand-300">
                                        <DollarSign size={16} />
                                    </div>
                                    <p className="flex-1">Você tem **{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financial.overdue)}** em atraso. Iniciar régua de cobrança?</p>
                                </div>
                            )}
                            <div className="flex items-center gap-3 text-sm p-3 bg-white/10 rounded-xl border border-white/10 hover:bg-white/15 transition-colors cursor-pointer">
                                <div className="w-8 h-8 bg-green-400/20 rounded-full flex items-center justify-center text-green-300">
                                    <RefreshCw size={16} />
                                </div>
                                <p className="flex-1">Dados atualizados em: **{new Date(activeData.last_updated).toLocaleString('pt-BR')}**</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
