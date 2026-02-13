import { type FC, useState, useEffect } from 'react';
import { Card, Button } from '../components/ui';
import {
    Users, AlertTriangle, Search, Filter, CheckCircle,
    ArrowUpRight, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { useSystem } from '../contexts/SystemContext';


interface AttendanceStudent {
    student_id: string;
    student_name: string;
    class_name: string;
    school_year: number;
    total_records: number;
    present_count: number;
    absent_count: number;
    justified_count: number;
    attendance_rate: number;
    last_attendance_date: string | null;
}

export const AttendanceManagementView: FC = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { currentSchool } = useAuth();
    const { years, currentYear: activeSystemYear } = useSystem();
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<AttendanceStudent[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<AttendanceStudent[]>([]);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'warning' | 'good'>('all');
    const [selectedYear, setSelectedYear] = useState<number>(
        activeSystemYear ? parseInt(activeSystemYear.year) : new Date().getFullYear()
    );


    // Stats
    const [stats, setStats] = useState({
        total: 0,
        critical: 0,
        warning: 0,
        good: 0
    });

    const fetchAttendanceData = async () => {
        setLoading(true);
        if (!currentSchool) return;

        try {
            // 1. Fetch dashboard data
            const { data, error } = await supabase
                .from('attendance_dashboard_view')
                .select('*')
                .eq('school_year', selectedYear)
                .eq('school_id', currentSchool.id);

            if (error) throw error;

            if (!data || data.length === 0) {
                setStudents([]);
                calculateStats([]);
                return;
            }

            // 2. Fetch photos in a separate call to avoid PGRST201 join ambiguity on views
            const studentIds = data.map(s => s.student_id);
            const { data: photoData } = await supabase
                .from('students')
                .select('id, photo_url')
                .in('id', studentIds);

            const photoMap = new Map((photoData || []).map(p => [p.id, p.photo_url]));

            // 3. Merge photo_url from students
            const studentsWithPhotos = data.map((s: any) => ({
                ...s,
                photo_url: photoMap.get(s.student_id)
            }));

            setStudents(studentsWithPhotos);
            calculateStats(studentsWithPhotos);


        } catch (error) {
            console.error('Error fetching attendance dashboard:', error);
            addToast('error', 'Erro ao carregar dados de frequência');
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data: AttendanceStudent[]) => {
        const newStats = {
            total: data.length,
            critical: data.filter(s => s.attendance_rate < 75).length,
            warning: data.filter(s => s.attendance_rate >= 75 && s.attendance_rate < 85).length,
            good: data.filter(s => s.attendance_rate >= 85).length
        };

        setStats(newStats);
    };

    useEffect(() => {
        fetchAttendanceData();
    }, [selectedYear]);

    useEffect(() => {
        let result = students;

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(s =>
                s.student_name.toLowerCase().includes(term) ||
                s.class_name.toLowerCase().includes(term)
            );
        }

        // Status Filter
        if (statusFilter !== 'all') {
            result = result.filter(s => {
                if (statusFilter === 'critical') return s.attendance_rate < 75;
                if (statusFilter === 'warning') return s.attendance_rate >= 75 && s.attendance_rate < 85;
                if (statusFilter === 'good') return s.attendance_rate >= 85;
                return true;
            });
        }

        setFilteredStudents(result);
    }, [students, searchTerm, statusFilter]);

    const getRateColor = (rate: number) => {
        if (rate < 75) return 'text-red-600 bg-red-50';
        if (rate < 85) return 'text-yellow-600 bg-yellow-50';
        return 'text-green-600 bg-green-50';
    };

    const KpiCard = ({ label, value, icon: Icon, color, bg, subLabel, onClick }: any) => (
        <div
            onClick={onClick}
            className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${bg}`}>
                    <Icon className={`w-6 h-6 ${color}`} />
                </div>
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>
                {subLabel && <p className="text-xs text-gray-400 mt-1 font-medium">{subLabel}</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Gestão de Faltas</h1>
                    <p className="text-gray-500">Monitoramento de frequência e evasão escolar.</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-brand-500"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                        {years.map(y => (
                            <option key={y.id} value={y.year}>Ano Letivo {y.year}</option>
                        ))}
                    </select>
                    <Button variant="outline" onClick={fetchAttendanceData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Atualizar
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Monitorado"
                    value={stats.total}
                    icon={Users}
                    color="text-brand-600"
                    bg="bg-brand-50"
                />
                <KpiCard
                    label="Frequência Crítica"
                    value={stats.critical}
                    icon={AlertTriangle}
                    color="text-red-600"
                    bg="bg-red-50"
                    subLabel="< 75% Presença"
                    onClick={() => setStatusFilter('critical')}
                />
                <KpiCard
                    label="Atenção"
                    value={stats.warning}
                    icon={AlertTriangle}
                    color="text-yellow-600"
                    bg="bg-yellow-50"
                    subLabel="75% - 85% Presença"
                    onClick={() => setStatusFilter('warning')}
                />
                <KpiCard
                    label="Frequência Boa"
                    value={stats.good}
                    icon={CheckCircle}
                    color="text-green-600"
                    bg="bg-green-50"
                    subLabel="> 85% Presença"
                    onClick={() => setStatusFilter('good')}
                />
            </div>

            {/* Filters Section - Separated to match Project Identity */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar aluno ou turma..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                    <Filter className="w-4 h-4 text-gray-400 min-w-[16px]" />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => setStatusFilter('critical')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === 'critical' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                        >
                            Críticos
                        </button>
                        <button
                            onClick={() => setStatusFilter('warning')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === 'warning' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'}`}
                        >
                            Atenção
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Table */}
            <Card className="overflow-hidden border border-gray-200 shadow-sm">
                {/* Data Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Aluno</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Turma</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Frequência</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Faltas Total</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-center">Último Registro</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        Carregando dados...
                                    </td>
                                </tr>
                            ) : filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400">
                                        Nenhum aluno encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            ) : (
                                filteredStudents.map((student) => (
                                    <tr key={student.student_id} className="hover:bg-gray-50 group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {(student as any).photo_url ? (
                                                        <img
                                                            src={(student as any).photo_url}
                                                            alt={student.student_name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-brand-600">
                                                            {student.student_name.charAt(0)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="font-medium text-gray-900">{student.student_name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {student.class_name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-bold ${getRateColor(student.attendance_rate)}`}>
                                                {student.attendance_rate}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-sm text-gray-600">
                                                <span className="font-semibold text-red-600">{student.absent_count}</span>
                                                <span className="text-gray-400 mx-1">/</span>
                                                <span className="text-gray-400" title="Total de Registros">{student.total_records}</span>
                                            </div>
                                            {student.justified_count > 0 && (
                                                <div className="text-xs text-blue-600 mt-0.5">
                                                    {student.justified_count} justificadas
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                                            {student.last_attendance_date ?
                                                new Date(student.last_attendance_date).toLocaleDateString('pt-BR') :
                                                '-'
                                            }
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/alunos/${student.student_id}?tab=academic&year=${selectedYear}`)}
                                                className="text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                                            >
                                                Ver Detalhes <ArrowUpRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
