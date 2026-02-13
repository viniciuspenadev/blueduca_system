import { type FC, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card } from '../components/ui';
import { Plus, Search, Filter, Calendar, ChevronRight, RefreshCw, FileText, Users, School } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { AssignClassModal } from '../components/AssignClassModal';
import { useToast } from '../contexts/ToastContext';

const StatusBadge = ({ status }: { status: string }) => {
    const config: any = {
        draft: { label: 'Rascunho', bg: 'bg-gray-100', text: 'text-gray-600' },
        sent: { label: 'Em Análise', bg: 'bg-yellow-50', text: 'text-yellow-700' }, // Added sent
        pending: { label: 'Em Análise', bg: 'bg-yellow-50', text: 'text-yellow-700' },
        awaiting_parent: { label: 'Aguardando Pais', bg: 'bg-blue-50', text: 'text-blue-700' },
        approved: { label: 'Matriculado', bg: 'bg-green-100', text: 'text-green-700' },
        rejected: { label: 'Recusado', bg: 'bg-red-50', text: 'text-red-700' },
        cancelled: { label: 'Cancelado', bg: 'bg-gray-100', text: 'text-gray-400' }
    };
    const s = config[status] || config.draft;

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
};

import { useSystem } from '../contexts/SystemContext';

export const EnrollmentListView: FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { currentSchool } = useAuth();
    const { years, currentYear: activeSystemYear } = useSystem();
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter Context
    const currentYear = new Date().getFullYear();
    const defaultYear = activeSystemYear ? parseInt(activeSystemYear.year) : (new Date().getMonth() > 8 ? currentYear + 1 : currentYear);
    const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Assign Class Modal State
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState<{ id: string, name: string } | null>(null);

    // Stats State
    const [stats, setStats] = useState({
        total: 0,
        renewals: 0,
        newStudents: 0,
        pendingAction: 0
    });

    const fetchData = async () => {
        setLoading(true);

        // Base Query for List
        let query = supabase
            .from('enrollments')
            .select('*, student:students(name, photo_url)')
            .eq('school_id', currentSchool?.id)
            .eq('academic_year', selectedYear)
            .order('created_at', { ascending: false });

        // Apply Status Filter
        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) {
            console.error(error);
        } else if (data) {

            // Calculate KPI Stats (Optimized client-side for UX)
            const renewals = data.filter(e => e.details?.enrollment_type === 'renewal').length;
            const newStudents = data.length - renewals;
            const pending = data.filter(e => e.status === 'pending' || e.status === 'draft').length;

            // Check for Future Enrollments (Next Year)
            let enhancedData = data;
            if (selectedYear < Math.max(...[2025, 2026, 2027])) {
                const studentIds = data.map(e => e.student_id).filter(Boolean);
                if (studentIds.length > 0) {
                    const { data: futureData } = await supabase
                        .from('enrollments')
                        .select('id, student_id, status, academic_year')
                        .eq('academic_year', selectedYear + 1)
                        .in('student_id', studentIds);

                    enhancedData = data.map(e => {
                        if (!e.student_id) return e;
                        const future = futureData?.find(f => f.student_id === e.student_id);
                        return {
                            ...e,
                            future_status: future ? future.status : 'none',
                            NextYearEnrollmentId: future ? future.id : null
                        };
                    });
                }
            }
            setEnrollments(enhancedData);
            setStats({ total: data.length, renewals, newStudents, pendingAction: pending });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [selectedYear, statusFilter]);

    const handleOpenAssignModal = (e: React.MouseEvent, enrollment: any) => {
        e.stopPropagation(); // Prevent row click
        if (enrollment.status !== 'approved' || !enrollment.student_id) {
            addToast('info', 'Apenas matrículas aprovadas podem ser enturmadas.');
            return;
        }

        setAssignTarget({
            id: enrollment.student_id,
            name: enrollment.student?.name || enrollment.candidate_name
        });
        setAssignModalOpen(true);
    };

    // KPI Card Component
    const KpiCard = ({ label, value, icon: Icon, bg, subLabel }: any) => (
        <div className="bg-white p-4 lg:p-5 rounded-xl lg:rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex justify-between items-start mb-3 lg:mb-4">
                <div className={`p-2 lg:p-3 rounded-xl ${bg}`}>
                    <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
            </div>
            <div>
                <p className="text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>
                {subLabel && <p className="text-[10px] lg:text-xs text-gray-400 mt-1 font-medium">{subLabel}</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Gestão de Matrículas</h1>
                    <p className="text-xs lg:text-sm text-gray-500">Painel de controle de admissões e renovações.</p>
                </div>
                <Button onClick={() => navigate('/matriculas/nova')} className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/20 h-9 text-sm px-4">
                    <Plus className="w-4 h-4 mr-2" /> Nova Matrícula
                </Button>
            </div>

            {/* Context Tabs (Year Selection) */}
            <div className="border-b border-gray-100">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {years.map((yearObj) => {
                        const yearInt = parseInt(yearObj.year);
                        return (
                            <button
                                key={yearObj.id}
                                onClick={() => setSelectedYear(yearInt)}
                                className={`
                                whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-all
                                ${selectedYear === yearInt
                                        ? 'border-brand-600 text-brand-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                                    }
                            `}
                            >
                                <Calendar className="w-4 h-4" />
                                Ano Letivo {yearObj.year}
                                {selectedYear === yearInt && (
                                    <span className="bg-brand-50 text-brand-600 py-0.5 px-2 rounded-md text-[10px] font-bold ml-1.5 border border-brand-100">
                                        {loading ? '...' : stats.total}
                                    </span>
                                )}
                                {yearObj.status === 'active' && (
                                    <span className="w-2 h-2 rounded-full bg-green-500 ml-1" title="Ano Ativo" />
                                )}
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Total de Matrículas"
                    value={loading ? '-' : stats.total}
                    icon={FileText}
                    bg="bg-gray-50"
                />
                <KpiCard
                    label="Renovações"
                    value={loading ? '-' : stats.renewals}
                    subLabel={`${loading ? 0 : Math.round((stats.renewals / (stats.total || 1)) * 100)}% do total`}
                    icon={RefreshCw}
                    bg="bg-blue-50"
                />
                <KpiCard
                    label="Novos Alunos"
                    value={loading ? '-' : stats.newStudents}
                    icon={Users}
                    bg="bg-green-50"
                />
                <KpiCard
                    label="Pendentes / Ação"
                    value={loading ? '-' : stats.pendingAction}
                    icon={Filter}
                    bg="bg-amber-50"
                />
            </div>

            {/* Filters & Search Row */}
            <div className="flex flex-col md:flex-row gap-3 pt-2">
                <Card className="flex-1 p-0.5 border border-gray-200 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-all rounded-lg overflow-hidden">
                    <div className="relative flex items-center h-1">
                        <Search className="absolute left-3 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por candidato, nome do aluno ou responsável..."
                            className="w-full pl-9 pr-4 py-1.5 bg-transparent outline-none text-sm h-full"
                        />
                    </div>
                </Card>

                <div className="flex gap-2 min-w-[200px]">
                    <select
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 h-10"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todos os Status</option>
                        <option value="draft">Rascunho</option>
                        <option value="pending">Em Análise</option>
                        <option value="approved">Matriculado</option>
                        <option value="cancelled">Cancelado</option>
                    </select>
                </div>
            </div>

            {/* Main List Table */}
            <div className="bg-white rounded-xl lg:rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Aluno / Candidato</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Responsável</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Data</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-40" /></td>
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-24" /></td>
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                                    <td className="px-6 py-4" />
                                </tr>
                            ))
                        ) : enrollments.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-gray-400">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <Filter className="w-8 h-8 opacity-20" />
                                        </div>
                                        <h3 className="text-gray-900 font-medium">Nenhuma matrícula para {selectedYear}</h3>
                                        <p className="text-sm mt-1 mb-4">Nenhum registro encontrado com os filtros atuais.</p>
                                        {statusFilter !== 'all' && (
                                            <Button variant="outline" size="sm" onClick={() => setStatusFilter('all')}>
                                                Limpar Filtros
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            enrollments.map((enrollment) => {
                                const isRenewal = enrollment.details?.enrollment_type === 'renewal';
                                const canAssignClass = enrollment.status === 'approved' && enrollment.student_id;

                                return (
                                    <tr
                                        key={enrollment.id}
                                        onClick={() => navigate(`/matriculas/${enrollment.id}`)}
                                        className="hover:bg-gray-50/80 transition-all cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {/* Student Photo Avatar */}
                                                <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative group-hover:scale-105 transition-transform shadow-sm">
                                                    {enrollment.student?.photo_url ? (
                                                        <img
                                                            src={enrollment.student.photo_url}
                                                            alt="Aluno"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                                (e.target as HTMLImageElement).parentElement!.classList.add('bg-gray-100');
                                                            }}
                                                        />
                                                    ) : (enrollment.details?.documents?.photo?.status === 'uploaded' || enrollment.details?.documents?.photo?.status === 'approved') && enrollment.details?.documents?.photo?.file_path ? (
                                                        <img
                                                            src={supabase.storage.from('documents').getPublicUrl(enrollment.details.documents.photo.file_path).data.publicUrl}
                                                            alt="Candidato"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                                (e.target as HTMLImageElement).parentElement!.classList.add('bg-gray-100');
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                            <Users className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                                                        {enrollment.student?.name || enrollment.candidate_name || 'Novo Candidato'}
                                                    </span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-400 font-mono">{enrollment.id.slice(0, 8)}</span>
                                                        {isRenewal && (
                                                            <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-blue-100 flex items-center gap-1">
                                                                <RefreshCw className="w-3 h-3" /> Renovação
                                                            </span>
                                                        )}
                                                        {!isRenewal && (
                                                            <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-green-100">
                                                                Novo Aluno
                                                            </span>
                                                        )}

                                                        {/* Pending Docs Indicator */}
                                                        {(() => {
                                                            const docCount = enrollment.details?.documents
                                                                ? Object.values(enrollment.details.documents).filter((d: any) => d.status === 'uploaded').length
                                                                : 0;

                                                            if (docCount === 0) return null;

                                                            return (
                                                                <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-yellow-200 flex items-center gap-1 animate-pulse">
                                                                    <FileText className="w-3 h-3" />
                                                                    {docCount} {docCount === 1 ? 'Doc Pendente' : 'Docs Pendentes'}
                                                                </span>
                                                            );
                                                        })()}

                                                        {/* Future Status Indicators */}
                                                        {enrollment.future_status === 'approved' && (
                                                            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-emerald-100 flex items-center gap-1">
                                                                ✓ Matriculado {selectedYear + 1}
                                                            </span>
                                                        )}
                                                        {enrollment.future_status === 'draft' && (
                                                            <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-amber-100">
                                                                ⚠ Aguardando {selectedYear + 1}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-gray-700">
                                                    {enrollment.parent_name || enrollment.details?.parent_name || enrollment.parent_email}
                                                </span>
                                                {(enrollment.parent_name || enrollment.details?.parent_name) && (
                                                    <span className="text-xs text-gray-400">{enrollment.parent_email}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={enrollment.status} />
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                {new Date(enrollment.created_at).toLocaleDateString('pt-BR')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                {canAssignClass && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-gray-400 hover:text-brand-600 hover:bg-brand-50"
                                                        title="Enturmar Aluno"
                                                        onClick={(e) => handleOpenAssignModal(e, enrollment)}
                                                    >
                                                        <School className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" className="text-gray-300 group-hover:text-brand-500" onClick={() => navigate(`/matriculas/${enrollment.id}`)}>
                                                    <ChevronRight className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {assignTarget && (
                <AssignClassModal
                    isOpen={assignModalOpen}
                    onClose={() => setAssignModalOpen(false)}
                    studentId={assignTarget.id}
                    studentName={assignTarget.name}
                    academicYear={selectedYear}
                    onSuccess={() => {
                        // Optional: Refresh list or just toast
                        fetchData();
                    }}
                />
            )}
        </div>
    );
};
