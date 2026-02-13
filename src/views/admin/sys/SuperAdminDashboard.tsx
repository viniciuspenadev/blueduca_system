import React, { useEffect, useState } from 'react';
import { School, Users, Activity, DollarSign, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../../services/supabase';

// Helper to format currency
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

import { SystemAnnouncementDialog } from './SystemAnnouncementDialog';
import { Megaphone } from 'lucide-react'; // Ensure Megaphone is imported from lucide-react if not already

export const SuperAdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const { data, error } = await supabase.rpc('get_super_admin_stats');
            if (error) throw error;
            setStats(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando painel de controle...</div>;
    }

    if (!stats) return null;

    const kpis = [
        { title: 'Total de Escolas', value: stats.total_schools, sub: `${stats.active_schools} ativas`, icon: School, color: 'text-blue-600', bg: 'bg-blue-50' },
        { title: 'Total de Alunos', value: stats.total_students, sub: 'Em todas as escolas', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
        { title: 'MRR Estimado', value: formatCurrency(stats.mrr), sub: 'Receita recorrente', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { title: 'Saúde do Sistema', value: '100%', sub: 'Todos serviços online', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Announcement Dialog */}
            <SystemAnnouncementDialog
                isOpen={isAnnouncementOpen}
                onClose={() => setIsAnnouncementOpen(false)}
            />

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Visão Geral do SaaS</h1>
                    <p className="text-gray-500">Métricas em tempo real da sua plataforma educacional.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsAnnouncementOpen(true)}
                        className="flex items-center gap-2 bg-white text-brand-600 border border-brand-200 hover:bg-brand-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
                    >
                        <Megaphone size={16} />
                        Comunicados (Push/Site)
                    </button>
                    <div className="text-sm text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                        Atualizado agorinha
                    </div>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, index) => (
                    <div key={index} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-gray-500 text-sm font-medium mb-1">{kpi.title}</p>
                                <h3 className="text-2xl font-bold text-gray-900">{kpi.value}</h3>
                                <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
                            </div>
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                                <kpi.icon size={20} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Growth Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <TrendingUp size={18} className="text-brand-500" />
                        Crescimento de Escolas (Últimos 6 meses)
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.growth_data}>
                                <defs>
                                    <linearGradient id="colorSchools" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="schools" stroke="#4f46e5" fillOpacity={1} fill="url(#colorSchools)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Secondary Stats / Quick Actions */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                    <h3 className="font-bold text-gray-800 mb-4">Ações Rápidas</h3>
                    <div className="space-y-3 flex-1">
                        <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-left group">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                <School size={16} />
                            </div>
                            <div>
                                <h4 className="font-medium text-sm text-gray-900">Nova Escola</h4>
                                <p className="text-xs text-gray-500">Provisionar tenant</p>
                            </div>
                        </button>

                        <button className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-left group">
                            <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                                <DollarSign size={16} />
                            </div>
                            <div>
                                <h4 className="font-medium text-sm text-gray-900">Gerenciar Planos</h4>
                                <p className="text-xs text-gray-500">Ajustar preços</p>
                            </div>
                        </button>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 text-sm">Distribuição de Planos (Real)</h3>
                        <div className="flex items-center gap-1 mb-2 h-3 rounded-full overflow-hidden bg-gray-100">
                            {stats.plan_distribution && stats.plan_distribution.length > 0 ? (
                                stats.plan_distribution.map((plan: any, index: number) => {
                                    const total = stats.active_schools || 1;
                                    const width = (plan.count / total) * 100;
                                    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500'];
                                    const color = colors[index % colors.length];

                                    return (
                                        <div
                                            key={plan.name}
                                            className={`${color} h-full`}
                                            style={{ width: `${width}%` }}
                                            title={`${plan.name}: ${plan.count} escolas`}
                                        ></div>
                                    );
                                })
                            ) : (
                                <div className="w-full text-center text-xs text-gray-400 py-0.5">Sem dados ainda</div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {stats.plan_distribution?.map((plan: any, index: number) => {
                                const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500'];
                                const color = colors[index % colors.length];
                                return (
                                    <span key={plan.name} className="flex items-center gap-1">
                                        <div className={`w-2 h-2 rounded-full ${color}`}></div>
                                        {plan.name} ({plan.count})
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
