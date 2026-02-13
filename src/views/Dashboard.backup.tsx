
import { type FC, useState, useEffect } from 'react';
import { Button, Card } from '../components/ui';
import {
    Users,
    FileText,
    TrendingUp,
    Calendar as CalendarIcon,
    ArrowRight
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

export const DashboardView: FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalStudents: 0,
        pendingEnrollments: 0,
        completedEnrollments: 0,
        breakdown: { pending2025: 0, pending2026: 0 }
    });

    useEffect(() => {
        const fetchStats = async () => {
            // Parallel fetching for speed
            const [
                { count: studentsCount },
                { count: pendingCount2025 },
                { count: pendingCount2026 },
                { count: completedCount }
            ] = await Promise.all([
                supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'draft').eq('academic_year', 2025),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'draft').eq('academic_year', 2026),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'approved')
            ]);

            setStats({
                totalStudents: studentsCount || 0,
                pendingEnrollments: (pendingCount2025 || 0) + (pendingCount2026 || 0),
                completedEnrollments: completedCount || 0,
                // Additional explicit breakdown can be added to UI cards if desired
                breakdown: {
                    pending2025: pendingCount2025 || 0,
                    pending2026: pendingCount2026 || 0
                }
            });
            setLoading(false);
        };

        fetchStats();
    }, []);

    const cards = [
        {
            label: 'Alunos Ativos',
            value: stats.totalStudents,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            path: '/alunos'
        },
        {
            label: 'Matrículas Pendentes',
            value: stats.pendingEnrollments,
            icon: FileText,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50',
            path: '/matriculas'
        },
        {
            label: 'Matrículas Aprovadas',
            value: stats.completedEnrollments,
            icon: TrendingUp,
            color: 'text-green-600',
            bg: 'bg-green-50',
            path: '/matriculas'
        }
    ];

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                <p className="text-gray-500">Visão geral da sua escola hoje.</p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {cards.map((card, idx) => (
                    <div
                        key={idx}
                        onClick={() => navigate(card.path)}
                        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className={`p-3 rounded-xl ${card.bg}`}>
                                <card.icon className={`w-6 h-6 ${card.color}`} />
                            </div>
                            <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-1 rounded-full group-hover:bg-gray-100 transition-colors">
                                Ver todos
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
                            <h3 className="text-3xl font-bold text-gray-900">
                                {loading ? '-' : card.value}
                            </h3>
                            {card.label === 'Matrículas Pendentes' && stats.breakdown.pending2026 > 0 && (
                                <p className="text-xs text-brand-600 mt-1 font-medium bg-brand-50 inline-block px-2 py-0.5 rounded">
                                    {stats.breakdown.pending2026} para 2026
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions / Activity Feed Placeholder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Card className="p-5">
                    <div className="flex justify-between items-center mb-5">
                        <h3 className="text-lg font-bold text-gray-900">Ações Rápidas</h3>
                    </div>
                    <div className="space-y-3">
                        <Button
                            className="w-full justify-start h-12 text-gray-700 bg-gray-50 hover:bg-brand-50 hover:text-brand-700 border border-gray-100"
                            variant="ghost"
                            onClick={() => navigate('/matriculas/nova')}
                        >
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 shadow-sm text-brand-600">
                                <FileText className="w-4 h-4" />
                            </div>
                            Nova Matrícula
                            <ArrowRight className="w-4 h-4 ml-auto opacity-30" />
                        </Button>
                        <Button
                            className="w-full justify-start h-12 text-gray-700 bg-gray-50 hover:bg-brand-50 hover:text-brand-700 border border-gray-100"
                            variant="ghost"
                            onClick={() => navigate('/agenda')}
                        >
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 shadow-sm text-brand-600">
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                            Agendar Evento
                            <ArrowRight className="w-4 h-4 ml-auto opacity-30" />
                        </Button>
                    </div>
                </Card>

                <Card className="p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
                    <h3 className="text-lg font-bold text-gray-900 mb-4 relative z-10">Agenda de Hoje</h3>
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 relative z-10">
                        <CalendarIcon className="w-12 h-12 mb-3 opacity-20" />
                        <p>Nenhum evento agendado</p>
                        <Button variant="ghost" className="text-brand-600 mt-2 hover:bg-brand-50" onClick={() => navigate('/agenda')}>
                            Ver calendário completo
                        </Button>
                    </div>
                </Card>
            </div>
        </div>
    );
};
