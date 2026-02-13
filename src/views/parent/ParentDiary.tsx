import { type FC, useState, useEffect, useCallback } from 'react';
import { BookOpen, Utensils, Moon, Droplets, Smile, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DiaryCard, DiarySkeleton } from './DiaryCard';
import { useStudent } from '../../contexts/StudentContext';
import { useAppSettings } from '../../hooks/useAppSettings';
import { BottomSheet } from '../../components/ui';

interface DailyReport {
    id: string;
    date: string;
    homework?: string;
    activities?: string;
    observations?: string;
    attendance_status?: 'present' | 'absent' | 'late' | 'justified';
    routine_data?: {
        meals?: {
            lunch?: string;
            snack?: string;
            breakfast?: string;
        };
        sleep?: {
            nap?: string;
            duration?: string;
        };
        hygiene?: {
            status?: string;
            diapers?: number;
        };
        mood?: string;
    };
    student_id?: string;
    teacher?: {
        name: string;
    };
}

type PeriodType = 'today' | 'week' | 'month';

let cachedDiaryData: Record<string, DailyReport[]> = {};

export const ParentDiary: FC = () => {
    const { selectedStudent } = useStudent();
    const { value: releaseTime } = useAppSettings('diary_release_time', '17:00');
    const [period, setPeriod] = useState<PeriodType>('week');
    const cacheKey = `${selectedStudent?.id}_${period}`;
    const [reports, setReports] = useState<DailyReport[]>(cachedDiaryData[cacheKey] || []);
    const [loading, setLoading] = useState(!cachedDiaryData[cacheKey]);
    const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

    useEffect(() => {
        if (!selectedStudent) return;
        fetchReports();
    }, [period, selectedStudent]);

    const fetchReports = async () => {
        const key = `${selectedStudent?.id}_${period}`;
        if (!cachedDiaryData[key]) {
            setLoading(true);
        }
        try {
            const { startDate, endDate } = getDateRange(period);

            if (!selectedStudent) return;

            const academicYear = selectedStudent.academic_year;

            let query = supabase
                .from('daily_reports')
                .select('*, teacher:profiles(name)')
                .eq('student_id', selectedStudent.id)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });

            if (academicYear) {
                const startOfYear = `${academicYear}-01-01`;
                const endOfYear = `${academicYear}-12-31`;
                query = query.gte('date', startOfYear).lte('date', endOfYear);
            }

            const { data, error } = await query;

            if (error) throw error;

            const studentIds = data?.map(r => r.student_id) || [];
            let reportsWithAttendance = [...(data || [])];

            if (studentIds.length > 0) {
                const { data: attendanceData } = await supabase
                    .from('student_attendance')
                    .select(`
                        student_id,
                        status,
                        sheet:class_attendance_sheets!inner(date)
                    `)
                    .in('student_id', studentIds)
                    .gte('sheet.date', startDate)
                    .lte('sheet.date', endDate);

                reportsWithAttendance = reportsWithAttendance.map(report => {
                    const attendance = attendanceData?.find(
                        (a: any) => a.sheet?.date === report.date && a.student_id === report.student_id
                    );
                    return {
                        ...report,
                        attendance_status: attendance?.status
                    };
                });
            }

            cachedDiaryData[key] = reportsWithAttendance;
            setReports(reportsWithAttendance);

        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    const getDateRange = (periodType: PeriodType) => {
        const now = new Date();
        let startDate: string;
        let endDate: string;

        switch (periodType) {
            case 'today':
                startDate = format(now, 'yyyy-MM-dd');
                endDate = startDate;
                break;
            case 'week':
                startDate = format(startOfWeek(now, { locale: ptBR }), 'yyyy-MM-dd');
                endDate = format(endOfWeek(now, { locale: ptBR }), 'yyyy-MM-dd');
                break;
            case 'month':
                startDate = format(startOfMonth(now), 'yyyy-MM-dd');
                endDate = format(endOfMonth(now), 'yyyy-MM-dd');
                break;
        }

        return { startDate, endDate };
    };

    const handleOpenDetail = useCallback((report: DailyReport) => {
        setSelectedReport(report);
    }, []);

    const getPeriodLabel = () => {
        switch (period) {
            case 'today': return 'Hoje';
            case 'week': return 'Esta Semana';
            case 'month': return 'Este Mês';
        }
    };

    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const todayStr = format(now, 'yyyy-MM-dd');
    const isTodayLocked = currentTime < releaseTime;

    const visibleReports = reports.filter(r => {
        if (r.date === todayStr && isTodayLocked) return false;

        // Se for falta, sempre mostramos para o pai saber
        if (r.attendance_status === 'absent') return true;

        // Caso contrário, verificamos se há algum conteúdo real
        const hasRoutine = r.routine_data && (
            (r.routine_data.meals && (r.routine_data.meals.breakfast || r.routine_data.meals.lunch || r.routine_data.meals.snack)) ||
            (r.routine_data.sleep && (r.routine_data.sleep.nap || r.routine_data.sleep.duration)) ||
            (r.routine_data.hygiene && (r.routine_data.hygiene.status || r.routine_data.hygiene.diapers)) ||
            r.routine_data.mood
        );

        const hasPedagogical = r.activities?.trim() || r.homework?.trim() || r.observations?.trim();

        return hasRoutine || hasPedagogical;
    });

    const totalPresent = visibleReports.filter(r => r.attendance_status === 'present').length;
    const totalWithHomework = visibleReports.filter(r => r.homework).length;
    const totalWithObs = visibleReports.filter(r => r.observations).length;

    return (
        <div className="space-y-8 pb-24">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-brand-100 rounded-xl text-brand-600">
                        <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-800 tracking-tight">Diário de Classe</h1>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Acompanhe a rotina diária</p>
                    </div>
                </div>

                <div className="bg-gray-100 p-1 rounded-xl flex items-center justify-between shadow-inner">
                    {(['today', 'week', 'month'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${period === p
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-1 max-w-2xl mx-auto space-y-6">
                {loading ? (
                    <DiarySkeleton />
                ) : (
                    <>
                        {visibleReports.length > 0 && (
                            <div className="bg-white/90 backdrop-blur-md border border-gray-100 rounded-2xl p-4 shadow-sm ring-1 ring-black/5">
                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">
                                    <span>📊 Resumo - {getPeriodLabel()}</span>
                                    <span className="bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">{visibleReports.length} registros</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-green-50/50 rounded-xl p-3 border border-green-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-lg font-black text-green-700">{totalPresent}</span>
                                        <span className="text-[10px] uppercase font-bold text-green-600/70">Presenças</span>
                                    </div>
                                    <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-lg font-black text-blue-700">{totalWithHomework}</span>
                                        <span className="text-[10px] uppercase font-bold text-blue-600/70">Lições</span>
                                    </div>
                                    <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 flex flex-col items-center justify-center text-center">
                                        <span className="text-lg font-black text-amber-700">{totalWithObs}</span>
                                        <span className="text-[10px] uppercase font-bold text-amber-600/70">Obs.</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {visibleReports.length === 0 ? (
                            <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center shadow-sm">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <BookOpen className="w-8 h-8 text-gray-300" />
                                </div>
                                <h3 className="text-lg font-black text-gray-900 mb-2 tracking-tight">Nenhum registro</h3>
                                <p className="text-gray-500 text-sm max-w-[200px] mx-auto font-medium">
                                    O professor ainda não preencheu o diário para {getPeriodLabel().toLowerCase()}.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {visibleReports.map((report) => (
                                    <DiaryCard
                                        key={report.id}
                                        report={report}
                                        onToggle={handleOpenDetail}
                                        isLocked={false}
                                        releaseTime={releaseTime}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <BottomSheet
                isOpen={!!selectedReport}
                onClose={() => setSelectedReport(null)}
                title={selectedReport ? format(new Date(selectedReport.date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR }) : ''}
            >
                {selectedReport && (
                    <div className="space-y-6 pb-6">
                        {/* Status Check */}
                        <div className={`p-4 rounded-2xl flex items-center justify-between ${selectedReport.attendance_status === 'present' ? 'bg-green-50 border border-green-100 text-green-800' :
                            selectedReport.attendance_status === 'absent' ? 'bg-red-50 border border-red-100 text-red-800' :
                                'bg-blue-50 border border-blue-100 text-blue-800'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${selectedReport.attendance_status === 'present' ? 'bg-green-100 text-green-600' :
                                    selectedReport.attendance_status === 'absent' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    {selectedReport.attendance_status === 'present' ? <CheckCircle2 size={20} /> :
                                        selectedReport.attendance_status === 'absent' ? <AlertCircle size={20} /> : <FileText size={20} />}
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-black text-[10px] uppercase tracking-[0.2em] leading-none opacity-40 mb-1.5">Frequência</span>
                                    <span className="font-black text-xs">
                                        {selectedReport.attendance_status === 'present' ? 'PRESENTE' :
                                            selectedReport.attendance_status === 'absent' ? 'FALTOU' : 'JUSTIFICADO'}
                                    </span>
                                </div>
                            </div>

                            {selectedReport.teacher?.name && (
                                <div className="text-right flex flex-col items-end">
                                    <span className="font-black text-[10px] uppercase tracking-[0.2em] leading-none opacity-40 mb-1.5">Professor(a)</span>
                                    <div className="flex items-center gap-1.5 justify-end">
                                        <span className="font-black text-xs text-brand-700">{selectedReport.teacher.name}</span>
                                        <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
                                            <Smile size={12} className="text-brand-600" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pedagógico */}
                        <div className="space-y-4">
                            {selectedReport.activities && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-brand-600">
                                        <Smile size={18} strokeWidth={3} />
                                        <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">Atividades do Dia</h3>
                                    </div>
                                    <div className="bg-gray-50 rounded-2xl p-5 text-sm text-gray-700 leading-relaxed font-medium">
                                        {selectedReport.activities}
                                    </div>
                                </div>
                            )}

                            {selectedReport.homework && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <BookOpen size={18} strokeWidth={3} />
                                        <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">Lição de Casa</h3>
                                    </div>
                                    <div className="bg-blue-50/30 border border-blue-100 rounded-2xl p-5 text-sm text-gray-700 leading-relaxed font-medium">
                                        {selectedReport.homework}
                                    </div>
                                </div>
                            )}

                            {selectedReport.observations && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-amber-600">
                                        <AlertCircle size={18} strokeWidth={3} />
                                        <h3 className="font-black text-[10px] uppercase tracking-[0.2em]">Observações</h3>
                                    </div>
                                    <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-5 text-sm text-gray-800 leading-relaxed italic font-medium">
                                        "{selectedReport.observations}"
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rotina - Ocultar se for falta ou se não houver dados */}
                        {selectedReport.attendance_status !== 'absent' && selectedReport.routine_data && (
                            (() => {
                                const hasMeals = selectedReport.routine_data.meals && (selectedReport.routine_data.meals.breakfast || selectedReport.routine_data.meals.lunch || selectedReport.routine_data.meals.snack);
                                const hasSleep = selectedReport.routine_data.sleep && (selectedReport.routine_data.sleep.nap || selectedReport.routine_data.sleep.duration);
                                const hasHygiene = selectedReport.routine_data.hygiene && (
                                    typeof selectedReport.routine_data.hygiene === 'object'
                                        ? (selectedReport.routine_data.hygiene.status || selectedReport.routine_data.hygiene.diapers)
                                        : !!selectedReport.routine_data.hygiene
                                );
                                const hasMood = !!selectedReport.routine_data.mood;

                                if (!hasMeals && !hasSleep && !hasHygiene && !hasMood) return null;

                                return (
                                    <div className="space-y-4 pt-6 border-t border-gray-100">
                                        <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-gray-400">Rotina & Cuidados</h3>

                                        <div className="grid grid-cols-2 gap-3">
                                            {hasMeals && (
                                                <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 space-y-3">
                                                    <div className="flex items-center gap-2 text-orange-600">
                                                        <Utensils size={16} strokeWidth={3} />
                                                        <span className="font-black text-[10px] uppercase tracking-wider">Alimentação</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {selectedReport.routine_data.meals?.breakfast && (
                                                            <p className="text-[11px] text-gray-600 leading-tight">
                                                                <strong className="text-orange-900 font-extrabold">Café:</strong> {selectedReport.routine_data.meals.breakfast}
                                                            </p>
                                                        )}
                                                        {selectedReport.routine_data.meals?.lunch && (
                                                            <p className="text-[11px] text-gray-600 leading-tight">
                                                                <strong className="text-orange-900 font-extrabold">Almoço:</strong> {selectedReport.routine_data.meals.lunch}
                                                            </p>
                                                        )}
                                                        {selectedReport.routine_data.meals?.snack && (
                                                            <p className="text-[11px] text-gray-600 leading-tight">
                                                                <strong className="text-orange-900 font-extrabold">Lanche:</strong> {selectedReport.routine_data.meals.snack}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {hasSleep && (
                                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-3">
                                                    <div className="flex items-center gap-2 text-indigo-600">
                                                        <Moon size={16} strokeWidth={3} />
                                                        <span className="font-black text-[10px] uppercase tracking-wider">Sono</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {selectedReport.routine_data.sleep?.nap && (
                                                            <p className="text-xs text-gray-700 font-bold leading-tight">
                                                                {selectedReport.routine_data.sleep.nap}
                                                            </p>
                                                        )}
                                                        {selectedReport.routine_data.sleep?.duration && (
                                                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-tighter">
                                                                Duração: {selectedReport.routine_data.sleep.duration}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {selectedReport.routine_data.hygiene && (
                                                (() => {
                                                    const hygiene = selectedReport.routine_data.hygiene;
                                                    const status = typeof hygiene === 'object' ? hygiene.status : hygiene;
                                                    const diapers = typeof hygiene === 'object' ? hygiene.diapers : null;

                                                    if (!status && !diapers) return null;

                                                    return (
                                                        <div className="bg-green-50/50 border border-green-100 rounded-2xl p-4 space-y-2">
                                                            <div className="flex items-center gap-2 text-green-600">
                                                                <Droplets size={16} strokeWidth={3} />
                                                                <span className="font-black text-[10px] uppercase tracking-wider">Higiene</span>
                                                            </div>
                                                            {status && (
                                                                <p className="text-[11px] text-gray-600 font-bold">
                                                                    Status: <span className="text-green-800 font-black">{status}</span>
                                                                </p>
                                                            )}
                                                            {diapers && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[9px] font-black uppercase">
                                                                        {diapers} trocas
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                            )}

                                            {hasMood && (
                                                <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-4 space-y-2">
                                                    <div className="flex items-center gap-2 text-pink-600">
                                                        <Smile size={16} strokeWidth={3} />
                                                        <span className="font-black text-[10px] uppercase tracking-wider">Humor</span>
                                                    </div>
                                                    <p className="text-[11px] text-pink-900 font-black capitalize leading-tight">
                                                        {selectedReport.routine_data.mood}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()
                        )}
                    </div>
                )}
            </BottomSheet>
        </div>
    );
};
