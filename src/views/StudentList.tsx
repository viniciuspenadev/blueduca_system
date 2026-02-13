import { type FC, useState, useEffect } from 'react';
import { Button } from '../components/ui';
import { Search, ChevronRight, GraduationCap, AlertCircle, CheckCircle, Pencil, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSystem } from '../contexts/SystemContext';
import { usePlan } from '../hooks/usePlan';

// Status Badge Component
const StudentStatusBadge = ({ status }: { status: string }) => {
    const config: any = {
        active: { label: 'Ativo', bg: 'bg-green-100', text: 'text-green-700' },
        inactive: { label: 'Inativo', bg: 'bg-gray-100', text: 'text-gray-600' },
        suspended: { label: 'Suspenso', bg: 'bg-red-50', text: 'text-red-700' },
        graduated: { label: 'Formado', bg: 'bg-blue-50', text: 'text-blue-700' }
    };
    const s = config[status] || config.active;

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    );
};

// Financial Status Badge
const FinancialStatusBadge = ({ status, overdue }: { status: string, overdue: number }) => {
    if (status === 'overdue') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                <AlertCircle className="w-3 h-3" /> {overdue} Pendente{overdue > 1 ? 's' : ''}
            </span>
        );
    }
    if (status === 'pending') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
                A Vencer
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-100">
            <CheckCircle className="w-3 h-3" /> Em dia
        </span>
    );
}

// Attendance Progress Bar
const AttendanceBar = ({ rate }: { rate: number }) => {
    let color = "bg-green-500";
    if (rate < 90) color = "bg-yellow-500";
    if (rate < 75) color = "bg-red-500";

    return (
        <div className="w-full max-w-[120px]">
            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                <span>Freq.</span>
                <span className={`font-bold ${rate < 75 ? 'text-red-600' : 'text-gray-700'}`}>{rate}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }}></div>
            </div>
        </div>
    );
}



export const StudentListView: FC = () => {
    const navigate = useNavigate();
    const { currentSchool } = useAuth();
    const { years, currentYear: activeSystemYear } = useSystem();
    const { hasModule } = usePlan();
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Year (Dynamic Default)
    const currentYear = new Date().getFullYear();
    const defaultYear = activeSystemYear ? parseInt(activeSystemYear.year) : currentYear;
    const [yearFilter, setYearFilter] = useState<number>(defaultYear);

    // Other Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [classNameFilter, setClassNameFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState<string>('active');
    const [mockClasses, setMockClasses] = useState<string[]>([]);

    useEffect(() => {
        const fetchStudents = async () => {
            setLoading(true);
            setStudents([]); // Clear list to prevent year leaks
            try {
                if (!currentSchool) {
                    setLoading(false);
                    return;
                }

                // Query: Students enrolled in Classes for the selected Year
                // We need to fetch: Student + Class data + Attendance + Financial
                const { data: enrollmentData, error: enrollmentError } = await supabase
                    .from('class_enrollments')
                    .select(`
                        student_id,
                        students!inner(id, name, status, photo_url),
                        classes!inner(id, name, school_year)
                    `)
                    .eq('classes.school_id', currentSchool.id)
                    .eq('classes.school_year', yearFilter);

                if (enrollmentError) throw enrollmentError;

                if (!enrollmentData) {
                    setLoading(false);
                    return;
                }

                // Extract unique students (a student may be in multiple classes)
                const studentMap = new Map();
                enrollmentData.forEach((enrollment: any) => {
                    const student = enrollment.students;
                    const classData = enrollment.classes;
                    if (!studentMap.has(student.id)) {
                        studentMap.set(student.id, {
                            id: student.id,
                            name: student.name,
                            status: student.status,
                            photo_url: student.photo_url,
                            class_name: classData.name,
                            class_id: classData.id
                        });
                    }
                });

                const uniqueStudents = Array.from(studentMap.values());

                // Now fetch Attendance & Financial stats for these students
                // (We could optimize this with a single complex query, but let's keep it readable)
                const studentIds = uniqueStudents.map((s: any) => s.id);

                // Calculate date range for the selected year
                const startDate = `${yearFilter}-01-01`;
                const endDate = `${yearFilter}-12-31`;

                // Attendance Stats (SCOPED BY YEAR)
                const { data: attendanceData } = await supabase
                    .from('student_attendance')
                    .select('student_id, status, class_attendance_sheets!inner(date)')
                    .in('student_id', studentIds)
                    .gte('class_attendance_sheets.date', startDate)
                    .lte('class_attendance_sheets.date', endDate);

                const attendanceMap = new Map();
                attendanceData?.forEach((record: any) => {
                    if (!attendanceMap.has(record.student_id)) {
                        attendanceMap.set(record.student_id, { total: 0, present: 0, justified: 0 });
                    }
                    const stats = attendanceMap.get(record.student_id);
                    stats.total++;
                    if (record.status === 'present') stats.present++;
                    if (record.status === 'justified') stats.justified++;
                });

                // Financial Stats
                const { data: financialData } = await supabase
                    .from('installments')
                    .select('enrollment_id, status, enrollments!inner(student_id)')
                    .in('enrollments.student_id', studentIds);

                const financialMap = new Map();
                financialData?.forEach((record: any) => {
                    const studentId = record.enrollments.student_id;
                    if (!financialMap.has(studentId)) {
                        financialMap.set(studentId, { overdue: 0, pending: 0 });
                    }
                    const stats = financialMap.get(studentId);
                    if (record.status === 'overdue') stats.overdue++;
                    if (record.status === 'pending') stats.pending++;
                });

                // Merge stats into students
                const enrichedStudents = uniqueStudents.map((student: any) => {
                    const attendance = attendanceMap.get(student.id) || { total: 0, present: 0, justified: 0 };
                    const financial = financialMap.get(student.id) || { overdue: 0, pending: 0 };

                    return {
                        ...student,
                        attendance_rate: attendance.total > 0
                            ? Math.round(((attendance.present + attendance.justified) / attendance.total) * 100)
                            : 0,
                        overdue_count: financial.overdue,
                        financial_status: financial.overdue > 0 ? 'overdue' : (financial.pending > 0 ? 'pending' : 'paid')
                    };
                });

                // Sort alphabetically by name (client-side)
                enrichedStudents.sort((a, b) => a.name.localeCompare(b.name));

                setStudents(enrichedStudents);

                // Extract unique classes for filter
                const classes = Array.from(new Set(enrichedStudents.map((s: any) => s.class_name).filter(Boolean))) as string[];
                setMockClasses(classes);

            } catch (error) {
                console.error('Error fetching students:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStudents();
    }, [yearFilter]); // Re-fetch when Tab changes

    // Local Filter Logic (Search & Class)
    const filteredStudents = students.filter(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = classNameFilter === 'all' || student.class_name === classNameFilter;
        const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
        return matchesSearch && matchesClass && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Alunos</h1>
                    <p className="text-gray-500">Gestão de Matrículas por Ano Letivo</p>
                </div>
                <Button onClick={() => navigate('/matriculas/nova')} className="bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-600/20">
                    <GraduationCap className="w-4 h-4 mr-2" /> Nova Matrícula
                </Button>
            </div>

            {/* Year Tabs - Explicit Context */}
            <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 flex overflow-x-auto">
                {years.map(yearObj => {
                    const yearInt = parseInt(yearObj.year);
                    return (
                        <button
                            key={yearObj.id}
                            onClick={() => setYearFilter(yearInt)}
                            className={`
                                flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2
                                ${yearInt === yearFilter
                                    ? 'bg-brand-50 text-brand-700 shadow-sm border-brand-100'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }
                            `}
                        >
                            Ano Letivo {yearObj.year}
                            {yearObj.status === 'active' && <span className="w-2 h-2 rounded-full bg-green-500" title="Ano Ativo" />}
                        </button>
                    )
                })}
            </div>

            <div className="flex flex-col md:flex-row gap-3 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar por nome..."
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                        <select
                            className="pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-500 appearance-none min-w-[140px]"
                            value={classNameFilter}
                            onChange={(e) => setClassNameFilter(e.target.value)}
                        >
                            <option value="all">Todas as Turmas</option>
                            {mockClasses.map((cls) => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    <select
                        className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-500 min-w-[120px]"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Todos Status</option>
                        <option value="active">Ativos</option>
                        <option value="inactive">Inativos</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Aluno</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Turma ({yearFilter})</th>
                            {hasModule('academic') && <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Frequência</th>}
                            {hasModule('finance') && <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Financeiro</th>}
                            <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48" /></td>
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20" /></td>
                                    <td className="px-6 py-4" />
                                </tr>
                            ))
                        ) : filteredStudents.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-gray-400">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                            <GraduationCap className="w-8 h-8 opacity-20" />
                                        </div>
                                        <h3 className="text-gray-900 font-medium">Nenhum aluno encontrado em {yearFilter}</h3>
                                        <p className="text-sm mt-1 mb-4">Verifique se há matrículas ativas para este ano.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredStudents.map((student, idx) => (
                                <tr
                                    key={`${student.id}-${idx}`}
                                    className="hover:bg-gray-50/80 transition-all group"
                                >
                                    <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/alunos/${student.id}?year=${yearFilter}`)}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 relative group-hover:scale-105 transition-transform shadow-sm">
                                                {student.photo_url ? (
                                                    <img
                                                        src={student.photo_url}
                                                        alt="Aluno"
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const parent = e.currentTarget.parentElement;
                                                            if (parent) {
                                                                parent.classList.add('bg-brand-100', 'flex', 'items-center', 'justify-center');
                                                                parent.innerText = student.name.charAt(0);
                                                                parent.classList.add('text-brand-700', 'font-bold', 'text-sm');
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-brand-100 text-brand-700 font-bold text-sm">
                                                        {student.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors">
                                                    {student.name}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-400">ID: {student.id.slice(0, 8)}</span>
                                                    <StudentStatusBadge status={student.status || 'active'} />
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {student.class_name ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                                                <GraduationCap className="w-3 h-3" /> {student.class_name}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">Não enturmado</span>
                                        )}
                                    </td>
                                    {hasModule('academic') && (
                                        <td className="px-6 py-4">
                                            {/* Attendance is implicitly scoped by the VIEW + Year Filter */}
                                            <AttendanceBar rate={student.attendance_rate || 0} />
                                        </td>
                                    )}
                                    {hasModule('finance') && (
                                        <td className="px-6 py-4">
                                            <FinancialStatusBadge status={student.financial_status} overdue={student.overdue_count} />
                                        </td>
                                    )}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* WhatsApp button temporarily disabled - contact data not in current query */}
                                            <button
                                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                onClick={() => navigate(`/alunos/${student.id}?year=${yearFilter}`)}
                                                title="Ver Perfil"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                                onClick={() => navigate(`/alunos/${student.id}?year=${yearFilter}&tab=academic`)}
                                                title="Histórico Escolar"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
