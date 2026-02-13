import { type FC, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Card, Button } from '../components/ui';
import {
    Search,
    User,
    ChevronRight,
    Calendar,
    AlertTriangle,
    CheckCircle,
    DollarSign
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// -- Types --
interface StudentFinancialSummary {
    student_id: string;
    student_name: string;
    guardian_name: string;
    class_name: string;
    total_due: number;     // Total aberto (vencido + a vencer)
    total_overdue: number; // Só vencido
    last_payment_date: string | null;
    photo_url?: string;
}

interface Installment {
    id: string;
    description: string;
    due_date: string;
    value: number;
    status: 'pending' | 'paid' | 'cancelled';
    installment_number: number;
    is_published: boolean;
    metadata?: {
        description?: string;
        category?: string;
    };
}

export const FinancialStudentHub: FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { currentSchool } = useAuth();

    // -- State --
    const [loadingList, setLoadingList] = useState(true);
    const [students, setStudents] = useState<StudentFinancialSummary[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Selection
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'ok'>('all');
    const [studentDetails, setStudentDetails] = useState<any>(null); // Full student object
    const [studentInstallments, setStudentInstallments] = useState<Installment[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // -- Effects --
    useEffect(() => {
        fetchStudentSummaries();
    }, [currentSchool]);

    useEffect(() => {
        if (selectedStudentId) {
            fetchStudentDetails(selectedStudentId);
        }
    }, [selectedStudentId]);

    // -- Data Fetching --
    const fetchStudentSummaries = async () => {
        if (!currentSchool) {
            setLoadingList(false);
            return;
        }
        setLoadingList(true);
        try {
            const { data: installments, error } = await supabase
                .from('installments')
                .select(`
                    value,
                    due_date,
                    status,
                    enrollment:enrollments!inner (
                        student_id,
                        candidate_name,
                        details,
                        academic_year,
                        student:students(photo_url)
                    )
                `)
                .eq('enrollment.school_id', currentSchool.id)
                .eq('enrollment.academic_year', new Date().getFullYear().toString()) // Optimization: Filter by current year
                .neq('status', 'cancelled');

            if (error) throw error;

            // Aggregation map
            const studentMap = new Map<string, StudentFinancialSummary>();

            installments?.forEach((inst: any) => {
                const enrollment = inst.enrollment;
                if (!enrollment) return;

                const studentId = enrollment.student_id;
                const studentName = enrollment.candidate_name || 'Desconhecido';
                const guardianName = enrollment.details?.parent_name || enrollment.details?.responsible_name || 'N/A';
                const className = enrollment.details?.class_name || 'Turma N/A';

                if (!studentMap.has(studentId)) {
                    studentMap.set(studentId, {
                        student_id: studentId,
                        student_name: studentName,
                        guardian_name: guardianName,
                        class_name: className,
                        total_due: 0,
                        total_overdue: 0,
                        last_payment_date: null,
                        photo_url: enrollment.student?.photo_url
                    });
                }

                const entry = studentMap.get(studentId)!;
                const val = Number(inst.value || 0);
                const isOverdue = new Date(inst.due_date) < new Date() && inst.status === 'pending';

                if (inst.status === 'pending') {
                    entry.total_due += val;
                    if (isOverdue) entry.total_overdue += val;
                }
            });

            setStudents(Array.from(studentMap.values()));

        } catch (error) {
            console.error('Error fetching summaries:', error);
            addToast('error', 'Erro ao carregar lista de alunos.');
        } finally {
            setLoadingList(false);
        }
    };

    const fetchStudentDetails = async (studentId: string) => {
        if (!currentSchool) return;
        setLoadingDetails(true);
        try {
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('id, candidate_name, details, student:students(photo_url)')
                .eq('student_id', studentId)
                .eq('school_id', currentSchool.id);

            if (!enrollments?.length) throw new Error("Aluno sem matrícula");

            const enrollmentIds = enrollments.map(e => e.id);
            setStudentDetails(enrollments[0]);

            const { data: relatedInstallments, error: instError } = await supabase
                .from('installments')
                .select('*')
                .in('enrollment_id', enrollmentIds)
                .order('due_date', { ascending: true });

            if (instError) throw instError;

            setStudentInstallments(relatedInstallments || []);

        } catch (error) {
            console.error('Error details:', error);
            addToast('error', 'Erro ao carregar detalhes.');
        } finally {
            setLoadingDetails(false);
        }
    };

    // -- Computed --
    const totalOverdueValue = students.reduce((acc, s) => acc + s.total_overdue, 0);
    const overdueCount = students.filter(s => s.total_overdue > 0).length;

    const filteredStudents = students.filter(s => {
        const matchesSearch = s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.guardian_name.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all'
            ? true
            : filterStatus === 'pending'
                ? s.total_overdue > 0
                : s.total_overdue === 0;

        return matchesSearch && matchesStatus;
    });

    // -- Render --
    return (
        <div className="h-[calc(100vh-120px)] flex flex-col md:flex-row gap-6 animate-fade-in relative min-h-0">

            {/* Left Panel: Student List */}
            <Card noPadding className={`flex-1 flex flex-col h-full overflow-hidden min-h-0 ${selectedStudentId ? 'hidden md:flex' : 'flex'}`}>
                {/* Visual Management Header (KPIs) - Now as a flex child of Card's content wrapper */}
                <div className="flex-shrink-0 grid grid-cols-2 gap-2 p-2 bg-gray-50 border-b border-gray-100">
                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Inadimplência Total</span>
                        <span className="text-sm font-bold text-red-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalOverdueValue)}
                        </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Alunos Pendentes</span>
                        <div className="flex items-end gap-1">
                            <span className="text-sm font-bold text-gray-800">{overdueCount}</span>
                            <span className="text-[10px] text-gray-400 mb-0.5">/ {students.length}</span>
                        </div>
                    </div>
                </div>

                {/* Search & Filter - Flex child */}
                <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-800">Matric/Mensalidade</h2>
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterStatus === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setFilterStatus('pending')}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filterStatus === 'pending' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-red-600'}`}
                            >
                                Pendentes
                            </button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="Buscar aluno ou responsável..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/30">
                    {loadingList ? (
                        <div className="text-center p-8 text-gray-400">Carregando...</div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center p-8 text-gray-400">Nenhum aluno encontrado.</div>
                    ) : (
                        filteredStudents.map(student => (
                            <div
                                key={student.student_id}
                                onClick={() => setSelectedStudentId(student.student_id)}
                                className={`
                                    p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md
                                    flex items-center justify-between group
                                    ${selectedStudentId === student.student_id
                                        ? 'bg-brand-50 border-brand-200 ring-1 ring-brand-200 shadow-sm'
                                        : 'bg-white border-gray-100 hover:border-gray-200'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden
                                        ${student.total_overdue > 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-gray-50 text-gray-600 border border-gray-100'}
                                    `}>
                                        {student.photo_url ? (
                                            <img src={student.photo_url} className="w-full h-full object-cover" alt={student.student_name} />
                                        ) : (
                                            student.student_name.substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-gray-800 group-hover:text-brand-700 transition-colors">
                                                {student.student_name}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {/* History Dots (Fake Data for MVP visual, ideally computed from actual history if available in summary) */}
                                            {/* Using random generation based on student ID char to be deterministic visually but fake */}
                                            <div className="flex gap-0.5">
                                                {[1, 2, 3].map(i => {
                                                    // Simple heuristic: if overdue, show some red dots. if clean, green.
                                                    const isRed = student.total_overdue > 0 && i === 3; // Latest is red
                                                    const color = isRed ? 'bg-red-400' : 'bg-emerald-300';
                                                    return <div key={i} className={`w-1.5 h-1.5 rounded-full ${color}`} />
                                                })}
                                            </div>
                                            <span className="text-[10px] text-gray-400 leading-none">•</span>
                                            <p className="text-xs text-gray-500 leading-none">
                                                {student.guardian_name.split(' ')[0]}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    {student.total_overdue > 0 ? (
                                        <div className="flex flex-col items-end">
                                            <p className="text-sm font-bold text-red-600">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(student.total_overdue)}
                                            </p>
                                            <span className="text-[10px] font-medium text-red-400">PENDENTE</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            <p className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                EM DIA
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {/* Right Panel: Details */}
            <div className={`flex-[2] flex flex-col h-full overflow-hidden min-h-0 ${!selectedStudentId ? 'hidden md:flex' : 'flex'}`}>
                {selectedStudentId ? (
                    <Card noPadding className="h-full flex flex-col relative overflow-hidden">

                        {/* Mobile Back Button */}
                        <div className="md:hidden p-2 border-b">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedStudentId(null)}>
                                ← Voltar para lista
                            </Button>
                        </div>

                        {loadingDetails ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full"></div>
                            </div>
                        ) : (
                            <>
                                {/* Detail Header */}
                                <div className="p-6 bg-brand-700 text-white shadow-md relative overflow-hidden">
                                    {/* Decorative subtle pattern or gradient overlay */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>

                                    <div className="flex justify-between items-start relative z-10 gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 overflow-hidden shadow-xl flex-shrink-0">
                                                {studentDetails?.student?.photo_url ? (
                                                    <img src={studentDetails.student.photo_url} className="w-full h-full object-cover" alt={studentDetails.candidate_name} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-bold text-xl uppercase text-white">
                                                        {studentDetails?.candidate_name?.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h1 className="text-2xl font-bold text-white tracking-tight">{studentDetails?.candidate_name}</h1>
                                                <p className="text-blue-100 mt-1 flex items-center gap-2 font-medium">
                                                    <User className="w-4 h-4 opacity-80" /> Responsável: {studentDetails?.details?.parent_name || studentDetails?.details?.responsible_name || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Matrícula</p>
                                            <p className="font-mono text-white/90">{studentDetails?.id?.slice(0, 8)}</p>
                                        </div>
                                    </div>

                                    {/* Mini Stats in Header - Improved Contrast */}
                                    <div className="grid grid-cols-3 gap-4 mt-6 relative z-10">
                                        <div className="bg-white p-3 rounded-xl shadow-lg shadow-black/5">
                                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-1">Aberto Total</span>
                                            <span className="text-xl font-bold text-gray-800">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                                    studentInstallments.filter(i => i.status === 'pending').reduce((acc, c) => acc + c.value, 0)
                                                )}
                                            </span>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl shadow-lg shadow-black/5 border-l-4 border-l-red-500">
                                            <span className="text-xs text-red-500 font-bold uppercase tracking-wider block mb-1">Vencido</span>
                                            <span className="text-xl font-bold text-red-600">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                                    studentInstallments.filter(i => i.status === 'pending' && new Date(i.due_date) < new Date()).reduce((acc, c) => acc + c.value, 0)
                                                )}
                                            </span>
                                        </div>
                                        <div className="bg-white p-3 rounded-xl shadow-lg shadow-black/5 border-l-4 border-l-emerald-500">
                                            <span className="text-xs text-emerald-500 font-bold uppercase tracking-wider block mb-1">Pago</span>
                                            <span className="text-xl font-bold text-emerald-600">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                                    studentInstallments.filter(i => i.status === 'paid').reduce((acc, c) => acc + c.value, 0)
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Timeline / List */}
                                <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Histórico Financeiro</h3>

                                    <div className="space-y-3">
                                        {studentInstallments.map(inst => {
                                            const isOverdue = new Date(inst.due_date) < new Date() && inst.status === 'pending';
                                            const statusColor = inst.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                : isOverdue ? 'bg-red-100 text-red-700 border-red-200'
                                                    : 'bg-white text-gray-700 border-gray-200';

                                            return (
                                                <div
                                                    key={inst.id}
                                                    onClick={() => navigate(`/financeiro/cobranca/${inst.id}`)}
                                                    className={`
                                                        group flex items-center justify-between p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all cursor-pointer
                                                        ${isOverdue ? 'border-l-4 border-l-red-500' : inst.status === 'paid' ? 'border-l-4 border-l-emerald-500' : ''}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusColor}`}>
                                                            {inst.status === 'paid' ? <CheckCircle className="w-5 h-5" /> : isOverdue ? <AlertTriangle className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900">
                                                                {inst.metadata?.description || `${inst.metadata?.category || 'Mensalidade'} ${inst.installment_number}ª`}
                                                            </p>
                                                            <p className="text-xs text-gray-500">Vencimento: {new Date(inst.due_date).toLocaleDateString('pt-BR')}</p>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="font-bold text-gray-900 font-mono">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.value)}
                                                        </p>
                                                        <span className="text-[10px] font-bold uppercase text-gray-400 group-hover:text-brand-600 transition-colors flex items-center justify-end gap-1">
                                                            Ver Detalhes <ChevronRight className="w-3 h-3" />
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        {studentInstallments.length === 0 && (
                                            <div className="text-center py-12 text-gray-400">
                                                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <DollarSign className="w-8 h-8 text-gray-300" />
                                                </div>
                                                <p>Nenhum registro financeiro encontrado.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </Card>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/30 rounded-2xl border border-dashed border-gray-200">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                            <User className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">Selecione um Aluno</h3>
                        <p className="text-sm max-w-xs text-center mt-2">Clique em um aluno na lista ao lado para ver o histórico financeiro completo.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
