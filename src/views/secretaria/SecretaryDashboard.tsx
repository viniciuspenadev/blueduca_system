import { type FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock,
    CheckCircle,
    AlertCircle,
    Search,
    MessageCircle,
    ChevronRight,
    FileText,
    RefreshCw
} from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { useSystem } from '../../contexts/SystemContext';

// --- VISUAL COMPONENTS ---

// 1. KPI Card Component (The Lighthouse)
const KpiCard = ({ label, value, subtext, type = 'neutral', icon: Icon }: any) => {
    // Explicitly typed record to avoid implicit 'any' error
    const styles: Record<string, string> = {
        neutral: 'bg-white border-gray-100 text-gray-900',
        blue: 'bg-blue-50 border-blue-100 text-blue-900',
        yellow: 'bg-amber-50 border-amber-100 text-amber-900',
        red: 'bg-red-50 border-red-100 text-red-900',
        green: 'bg-emerald-50 border-emerald-100 text-emerald-900'
    };

    const iconColors: Record<string, string> = {
        neutral: 'text-gray-400 bg-gray-50',
        blue: 'text-blue-600 bg-blue-100',
        yellow: 'text-amber-600 bg-amber-100',
        red: 'text-red-600 bg-red-100',
        green: 'text-emerald-600 bg-emerald-100'
    };

    return (
        <div className={`p-4 lg:p-5 rounded-xl lg:rounded-2xl border transition-all hover:shadow-md ${styles[type] || styles.neutral}`}>
            <div className="flex justify-between items-start mb-2 lg:mb-3">
                <div className={`p-2 lg:p-2.5 rounded-xl ${iconColors[type] || iconColors.neutral}`}>
                    <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
                {type === 'red' && <span className="animate-pulse w-2 h-2 bg-red-500 rounded-full"></span>}
            </div>
            <div>
                <h3 className="text-2xl lg:text-3xl font-bold tracking-tight mb-0.5 lg:mb-1">{value}</h3>
                <p className="text-[13px] lg:text-sm font-medium opacity-80">{label}</p>
                {subtext && <p className="text-[10px] lg:text-xs mt-1.5 lg:mt-2 opacity-60 font-medium">{subtext}</p>}
            </div>
        </div>
    );
};

// 2. Status Badge with "Pill" design
const StatusPill = ({ status, text }: { status: 'success' | 'warning' | 'error' | 'neutral', text: string }) => {
    const config = {
        success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        warning: 'bg-amber-50 text-amber-700 border-amber-200',
        error: 'bg-red-50 text-red-700 border-red-200',
        neutral: 'bg-gray-100 text-gray-600 border-gray-200'
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${config[status]}`}>
            {status === 'success' && <CheckCircle className="w-3 h-3 mr-1.5" />}
            {status === 'warning' && <Clock className="w-3 h-3 mr-1.5" />}
            {status === 'error' && <AlertCircle className="w-3 h-3 mr-1.5" />}
            {text}
        </span>
    );
};

// 3. Progress Bar
const ProgressBar = ({ current, total }: { current: number, total: number }) => {
    const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
    const color = percentage === 100 ? 'bg-emerald-500' : percentage > 50 ? 'bg-blue-500' : 'bg-amber-500';

    return (
        <div className="flex flex-col gap-1 w-24">
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            <span className="text-[10px] text-gray-400 font-mono text-right">{current}/{total} Docs</span>
        </div>
    );
};

export const SecretaryDashboard: FC = () => {
    const navigate = useNavigate();
    const { currentSchool } = useAuth();
    const { currentYear } = useSystem();

    // State
    const [loading, setLoading] = useState(true);
    const [enrollments, setEnrollments] = useState<any[]>([]);

    // Pagination State
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const PAGE_SIZE = 20;

    const [stats, setStats] = useState({
        total: 0,
        pendingReview: 0, // Uploaded, waiting approval
        missingDocs: 0,   // Not uploaded yet
        completed: 0
    });

    useEffect(() => {
        // Reset on school/year change
        setPage(0);
        setHasMore(true);
        setEnrollments([]); // Clear list
        setEnrollments([]); // Clear list
        setSearchQuery('');
        setStatusFilter('all');
        fetchDashboardData(0, false, 'all');
    }, [currentSchool, currentYear]);

    const fetchDashboardData = async (pageIndex = 0, isLoadMore = false, currentStatusFilter = statusFilter) => {
        if (!currentSchool) return;

        setLoading(true);
        try {
            // 1. Fetch School Doc Templates
            let schoolDocIds: string[] = [];

            // Optimization: Only fetch settings on first load or if cache empty
            // For now, keep it to ensure freshness, but could be optimized.
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('school_id', currentSchool.id)
                .eq('key', 'enrollment_docs_template')
                .maybeSingle();

            if (settingsData?.value) {
                let val = settingsData.value;
                let attempts = 0;
                while (typeof val === 'string' && attempts < 3) {
                    try {
                        val = JSON.parse(val);
                    } catch (e) { break; }
                    attempts++;
                }
                if (Array.isArray(val)) {
                    schoolDocIds = val.map((d: any) => d.id);
                }
            }

            // 2. Fetch Enrollments with Pagination
            // Get active year ID if available, otherwise fallback
            let yearFilter = currentYear?.year ? parseInt(currentYear.year) : new Date().getFullYear();

            const from = pageIndex * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let query = supabase
                .from('enrollments')
                .select('*, student:students(name, photo_url), class_enrollments(classes(name))')
                .eq('school_id', currentSchool.id)
                .eq('academic_year', yearFilter)
                .order('created_at', { ascending: false })
                .range(from, to);


            if (searchQuery && searchQuery.trim().length > 0) {
                const q = searchQuery.trim();
                query = query.or(`candidate_name.ilike.%${q}%,parent_email.ilike.%${q}%`);
            }

            if (currentStatusFilter !== 'all') {
                query = query.eq('status', currentStatusFilter);
            }

            const { data: enrollmentData, error } = await query;

            if (error) throw error;

            if (enrollmentData) {
                // Check if we have more
                if (enrollmentData.length < PAGE_SIZE) {
                    setHasMore(false);
                } else {
                    setHasMore(true);
                }

                // Process Data for Dashboard
                const processed = enrollmentData.map(e => {
                    const docs = e.details?.documents || {};
                    const uploadedDocs = Object.values(docs).filter((d: any) => d.status === 'uploaded');
                    const approvedDocs = Object.values(docs).filter((d: any) => d.status === 'approved');

                    const docKeys = Object.keys(docs);
                    const adHocKeys = docKeys.filter(k => docs[k].is_adhoc);
                    const totalExpectedCount = schoolDocIds.length + adHocKeys.length;

                    const pendingReviewCount = uploadedDocs.length;
                    const approvedCount = approvedDocs.length;

                    let missingCount = 0;
                    schoolDocIds.forEach(id => {
                        const d = docs[id];
                        if (!d || d.status === 'pending' || d.status === 'rejected') missingCount++;
                    });
                    adHocKeys.forEach(id => {
                        const d = docs[id];
                        if (!d || d.status === 'pending' || d.status === 'rejected') missingCount++;
                    });

                    const className = e.class_enrollments?.[0]?.classes?.name;

                    return {
                        ...e,
                        uploadCount: pendingReviewCount,
                        missingCount: missingCount,
                        totalDocs: totalExpectedCount,
                        approvedDocs: approvedCount,
                        displayStatus: e.status,
                        resolvedGrade: className
                    };
                });

                if (isLoadMore) {
                    setEnrollments(prev => [...prev, ...processed]);
                } else {
                    setEnrollments(processed);
                }

                // Stats: Only calculate on initial load to allow "totals" to make sense for the first batch
                if (pageIndex === 0) {
                    const total = processed.length; // Note: This is page count, not total. Ideally separate count query.
                    const pendingReview = processed.reduce((acc, curr) => acc + curr.uploadCount, 0);
                    const missingDocsTotal = processed.reduce((acc, curr) => acc + curr.missingCount, 0);
                    const completed = processed.filter(e => e.status === 'approved').length;

                    setStats({
                        total,
                        pendingReview,
                        missingDocs: missingDocsTotal,
                        completed
                    });
                }
            }

        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Status Helper
    const getStatusConfig = (enrollment: any) => {
        // Custom logic for dashboard pills - Prioritize WARNINGS/ERRORS for Secretary View
        if (enrollment.uploadCount > 0) return { type: 'warning', label: 'Docs em Análise' };
        if (enrollment.missingCount > 0) return { type: 'error', label: 'Docs Faltantes' };

        if (enrollment.status === 'approved') return { type: 'success', label: 'Matriculado' };
        return { type: 'neutral', label: 'Aguardando' };
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20 font-sans text-gray-900 animate-fade-in">
            {/* 1. Header Area with Global Actions */}
            <div className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 lg:py-6 mb-4 lg:mb-8">
                <div className="max-w-full mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2 lg:px-4">
                    <div>
                        <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-gray-900">Centro de Controle</h1>
                        <p className="text-xs lg:text-sm text-gray-500 mt-0.5 lg:mt-1">Visão geral das matrículas de {currentYear?.year || '...'}</p>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="text-gray-600 border-gray-200 hover:bg-gray-50 bg-white" onClick={() => fetchDashboardData(0, false)}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                        <Button className="bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/20">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Cobrar Pendentes
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-full mx-auto px-4 lg:px-6 xl:px-8 space-y-8">

                {/* 2. KPI Cards (The Lighthouse) */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <KpiCard
                        label="Total de Matrículas"
                        value={stats.total}
                        type="blue"
                        icon={FileText}
                        subtext="Ano Letivo Atual"
                    />
                    <KpiCard
                        label="Aguardando Análise"
                        value={stats.pendingReview}
                        type="yellow"
                        icon={Clock}
                        subtext="Docs enviados p/ pai"
                    />
                    <KpiCard
                        label="Docs Não Enviados"
                        value={stats.missingDocs}
                        type="red"
                        icon={AlertCircle}
                        subtext="Pendentes de envio"
                    />
                    <KpiCard
                        label="Matrículas Finalizadas"
                        value={stats.completed}
                        type="green"
                        icon={CheckCircle}
                        subtext={`${stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% do total`}
                    />
                </div>

                {/* 3. Dynamic List (The Workflow) */}
                <Card className="border border-gray-100 shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-gray-50 flex items-center gap-4 bg-white">
                        <div className="relative flex-1 max-w-md">
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 cursor-pointer hover:text-brand-600"
                                onClick={() => {
                                    setPage(0);
                                    setEnrollments([]);
                                    fetchDashboardData(0, false);
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Buscar por aluno, responsável ou CPF..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setPage(0);
                                        setEnrollments([]);
                                        fetchDashboardData(0, false);
                                    }
                                }}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 outline-none transition-all"
                            />
                        </div>
                        <div className="flex gap-2">
                            {/* Filters could go here */}
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Aluno / Série</th>
                                <th className="px-6 py-4">Responsável</th>
                                <th className="px-6 py-4">Status Docs</th>
                                <th className="px-6 py-4">Progresso Envios</th>
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Carregando dados...</td></tr>
                            ) : enrollments.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhuma matrícula encontrada.</td></tr>
                            ) : (
                                enrollments.map((item) => {
                                    const statusCfg = getStatusConfig(item);
                                    // Resolve Name (Priority: Joined Student -> Candidate Name -> Details)
                                    const name = item.student?.name || item.candidate_name || item.details?.student?.full_name || 'Desconhecido';
                                    const parent = item.parent_name || item.details?.responsible?.full_name || item.parent_email || '-';

                                    // Resolve Grade
                                    const grade = item.resolvedGrade || item.grade_level || item.details?.grade_level || item.details?.series || 'Série n/a';

                                    // Progress: (Uploaded + Approved) / Total
                                    // Note: item.uploadCount is 'pending review', item.approvedDocs is 'approved'
                                    // Total filled = uploadCount + approvedDocs
                                    const filled = item.uploadCount + item.approvedDocs;

                                    return (
                                        <tr
                                            key={item.id}
                                            className="group hover:bg-gray-50/80 transition-all cursor-pointer"
                                            onClick={() => navigate(`/secretaria/aluno/${item.id}`)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-sm uppercase overflow-hidden border border-brand-100 flex-shrink-0">
                                                        {item.student?.photo_url ? (
                                                            <img
                                                                src={item.student.photo_url}
                                                                alt={name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs text-gray-500">{grade}</span>
                                                            {item.uploadCount > 0 && (
                                                                <span className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                                                    {item.uploadCount} Pendentes
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-gray-700">{parent}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusPill status={statusCfg.type as any} text={statusCfg.label} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <ProgressBar current={filled} total={item.totalDocs} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-gray-100">
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>

                    <div className="p-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
                        <span>Total: {stats.total} matrículas (Listados: {enrollments.length})</span>
                        {hasMore && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-brand-600 border-brand-200 hover:bg-brand-50"
                                onClick={() => {
                                    const nextPage = page + 1;
                                    setPage(nextPage);
                                    fetchDashboardData(nextPage, true);
                                }}
                                disabled={loading}
                            >
                                {loading ? 'Carregando...' : 'Carregar Mais'}
                            </Button>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
