
import { type FC, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Button } from './ui';
import { Loader2, Save, Sun, Moon, Utensils, BookOpen, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, LayoutDashboard, GraduationCap, FileText, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface ClassDailyAgendaProps {
    classId: string;
    date: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | null;

export const ClassDailyAgenda: FC<ClassDailyAgendaProps> = ({ classId, date }) => {
    const { currentSchool, user } = useAuth();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data
    const [students, setStudents] = useState<any[]>([]);
    const [reportsMap, setReportsMap] = useState<Record<string, any>>({});
    const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
    const [statusMap, setStatusMap] = useState<Record<string, 'saved' | 'unsaved' | 'pending'>>({});
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [observationStudent, setObservationStudent] = useState<any | null>(null);

    // Batch Actions State
    const [batchHomework, setBatchHomework] = useState('');
    const [batchActivity, setBatchActivity] = useState('');

    useEffect(() => {
        fetchData();
    }, [classId, date]);

    // Permission Logic
    const canEdit = (() => {
        if (!user) return false;
        if (['ADMIN', 'SECRETARY', 'COORDINATOR'].includes(user.role)) return true;

        // Simple comparison YYYY-MM-DD
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        return date >= todayStr;
    })();

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: roster, error: rosterError } = await supabase
                .from('class_enrollments')
                .select('student_id, student:students(id, name)')
                .eq('class_id', classId);

            if (rosterError) throw rosterError;

            const sorted = (roster || []).sort((a: any, b: any) =>
                (a.student?.name || '').localeCompare(b.student?.name || '')
            );
            setStudents(sorted);

            const { data: reports, error: reportsError } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('class_id', classId)
                .eq('date', date);

            if (reportsError) throw reportsError;

            const { data: attendanceData } = await supabase
                .from('class_attendance_sheets')
                .select('id, student_attendance(student_id, status)')
                .eq('class_id', classId)
                .eq('date', date)
                .single();

            const rMap: any = {};
            const existingReportIds = new Set();
            reports?.forEach((r) => {
                rMap[r.student_id] = { ...r, routine_data: r.routine_data || {} };
                existingReportIds.add(r.student_id);
            });

            const aMap: any = {};
            if (attendanceData && attendanceData.student_attendance) {
                attendanceData.student_attendance.forEach((a: any) => {
                    aMap[a.student_id] = a.status;
                });
            }

            const sMap: any = {};
            sorted.forEach((s: any) => {
                const hasReport = existingReportIds.has(s.student_id);
                sMap[s.student_id] = hasReport ? 'saved' : 'pending';

                if (!rMap[s.student_id]) {
                    rMap[s.student_id] = {
                        student_id: s.student_id,
                        routine_data: {
                            meals: { breakfast: '', lunch: '', snack: '' },
                            sleep: { nap: '', duration: '' },
                            hygiene: { status: '', diapers: 0 },
                            mood: 'Feliz'
                        },
                        homework: '', activities: '', observations: ''
                    };
                }
                // Explicit Attendance: If no record, stays undefined/null
                if (aMap[s.student_id] === undefined) {
                    aMap[s.student_id] = null;
                }
            });

            setReportsMap(rMap);
            setAttendanceMap(aMap);
            setStatusMap(sMap);

            if (reports && reports.length > 0) {
                setBatchHomework(reports[0].homework || '');
                setBatchActivity(reports[0].activities || '');
            } else {
                setBatchHomework('');
                setBatchActivity('');
            }

        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar diário.');
        } finally {
            setLoading(false);
        }
    };

    const updateReport = (studentId: string, field: string, value: any, isRoutineData = false) => {
        setReportsMap(prev => {
            const current = prev[studentId];
            let newData;
            if (isRoutineData) {
                if (field.includes('.')) {
                    const [parent, child] = field.split('.');
                    newData = {
                        ...current,
                        routine_data: {
                            ...current.routine_data,
                            [parent]: { ...(current.routine_data?.[parent] || {}), [child]: value }
                        }
                    };
                } else {
                    newData = {
                        ...current,
                        routine_data: { ...current.routine_data, [field]: value }
                    };
                }
            } else {
                newData = { ...current, [field]: value };
            }
            return { ...prev, [studentId]: newData };
        });
        setStatusMap(prev => ({ ...prev, [studentId]: 'unsaved' }));
    };

    const toggleAttendance = (studentId: string) => {
        setAttendanceMap(prev => {
            const current = prev[studentId];
            // Cycle: null -> present -> absent -> present
            let next: AttendanceStatus = 'present';
            if (current === 'present') next = 'absent';
            else if (current === 'absent') next = 'present';
            else next = 'present'; // From null/late to present

            return { ...prev, [studentId]: next };
        });
        setStatusMap(prev => ({ ...prev, [studentId]: 'unsaved' }));
    };

    const handleApplyBatch = () => {
        setReportsMap(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                next[key] = {
                    ...next[key],
                    homework: batchHomework,
                    activities: batchActivity
                };
            });
            return next;
        });
        setStatusMap(prev => {
            const next: any = {};
            Object.keys(prev).forEach(k => next[k] = 'unsaved');
            return next;
        });
        addToast('success', 'Conteúdo aplicado para todos.');
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            const { data: sheetData } = await supabase
                .from('class_attendance_sheets')
                .select('id')
                .eq('class_id', classId)
                .eq('date', date)
                .single();

            let sheetId = sheetData?.id;
            if (!sheetId) {
                if (!currentSchool) return;
                const { data: newSheet, error: createError } = await supabase
                    .from('class_attendance_sheets')
                    .insert({
                        class_id: classId,
                        date,
                        school_id: currentSchool.id
                    })
                    .select()
                    .single();
                if (createError) throw createError;
                sheetId = newSheet.id;
            }

            const attendanceRecords = Object.keys(attendanceMap)
                .filter(id => attendanceMap[id] !== null)
                .map(studentId => ({
                    sheet_id: sheetId,
                    student_id: studentId,
                    status: attendanceMap[studentId]
                }));

            const { error: attError } = await supabase
                .from('student_attendance')
                .upsert(attendanceRecords, { onConflict: 'sheet_id,student_id' });
            if (attError) throw attError;

            const reportData = Object.values(reportsMap).map((r: any) => ({
                school_id: currentSchool?.id,
                class_id: classId,
                student_id: r.student_id,
                date: date,
                routine_data: r.routine_data,
                homework: r.homework,
                activities: r.activities,
                observations: r.observations,
                created_by: user?.id
            }));

            const { error: repError } = await supabase
                .from('daily_reports')
                .upsert(reportData, { onConflict: 'student_id,date' });

            if (repError) throw repError;

            setStatusMap(prev => {
                const next: any = {};
                Object.keys(prev).forEach(k => next[k] = 'saved');
                return next;
            });

            addToast('success', 'Diário e Chamada salvos!');
        } catch (error: any) {
            console.error(error);
            addToast('error', error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-4" />
            <p className="text-gray-500 font-medium">Carregando diário...</p>
        </div>
    );

    const stats = {
        saved: Object.values(statusMap).filter(s => s === 'saved').length,
        unsaved: Object.values(statusMap).filter(s => s === 'unsaved').length,
        total: students.length
    };

    return (
        <div className="space-y-6">
            {/* Read Only Banner */}
            {!canEdit && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 animate-in slide-in-from-top-2">
                    <div className="p-2 bg-amber-100 rounded-full">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Modo Somente Leitura</h4>
                        <p className="text-xs opacity-90">Você está visualizando um registro passado. A edição está bloqueada para preservar o histórico.</p>
                    </div>
                </div>
            )}

            {/* Mobile FAB - Floating Save Button */}
            {canEdit && (
                <div className="md:hidden fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4">
                    <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className={`
                            flex items-center gap-3 px-6 py-4 rounded-2xl font-black shadow-2xl transition-all active:scale-95
                            ${stats.unsaved > 0
                                ? 'bg-amber-500 text-white shadow-amber-500/40'
                                : 'bg-brand-600 text-white shadow-brand-600/40'}
                        `}
                    >
                        {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-xs uppercase tracking-widest mb-0.5">
                                {saving ? 'Salvando...' : stats.unsaved > 0 ? 'Salvar Alterações' : 'Salvar Diário'}
                            </span>
                            {!saving && (
                                <span className="text-[10px] opacity-80">
                                    {stats.saved}/{stats.total} Alunos salvos
                                </span>
                            )}
                        </div>
                    </button>
                </div>
            )}

            {/* Control Bar - Sticky Desktop */}
            <div className="hidden md:flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm sticky top-4 z-20 backdrop-blur-sm bg-white/95">

                {/* Save Status / Actions */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-3 text-xs font-medium text-gray-500 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                        {stats.unsaved > 0 ? (
                            <span className="flex items-center gap-2 text-amber-600 font-bold animate-pulse">
                                <AlertCircle className="w-4 h-4" />
                                {stats.unsaved} alterações pendentes
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 text-green-600 font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                Tudo salvo
                            </span>
                        )}
                        <span className="w-px h-3 bg-gray-300 mx-1"></span>
                        <span>{stats.saved}/{stats.total} alunos</span>
                    </div>

                    {canEdit && (
                        <Button
                            onClick={handleSaveAll}
                            disabled={saving}
                            className={`${stats.unsaved > 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-brand-600 hover:bg-brand-700"} text-white shadow-lg transition-all min-w-[160px]`}
                        >
                            {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {stats.unsaved > 0 ? 'Salvar Alterações' : 'Salvar Tudo'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Desktop Activities Card - Hidden on Mobile */}
            <div className="hidden md:block bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-brand-600" />
                        Atividades Gerais da Turma
                    </h3>
                    <Button variant="ghost" className="text-xs text-brand-600 hover:bg-brand-50" onClick={handleApplyBatch} size="sm" disabled={!canEdit}>
                        Aplicar para Todos
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Em Sala (Resumo)</label>
                        <textarea
                            disabled={!canEdit}
                            className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none bg-gray-50 focus:bg-white disabled:opacity-60 disabled:bg-gray-100"
                            rows={3}
                            placeholder="O que foi trabalhado hoje? Ex: Atividade de pintura..."
                            value={batchActivity}
                            onChange={(e) => setBatchActivity(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Para Casa</label>
                        <textarea
                            disabled={!canEdit}
                            className="w-full border border-gray-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all resize-none bg-gray-50 focus:bg-white disabled:opacity-60 disabled:bg-gray-100"
                            rows={3}
                            placeholder="Lição de casa ou recado..."
                            value={batchHomework}
                            onChange={(e) => setBatchHomework(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Mobile Activities Card (Collapsible Mockup Style) */}
            <div className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-3">
                <button
                    onClick={() => setExpandedCardId(expandedCardId === 'activities' ? null : 'activities')}
                    className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-slate-800 text-sm">Resumo do Dia</h3>
                            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Atividades & Para Casa</p>
                        </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedCardId === 'activities' ? 'rotate-180' : ''}`} />
                </button>

                {expandedCardId === 'activities' && (
                    <div className="p-4 border-t border-slate-100 space-y-4 bg-slate-50/30 animate-in slide-in-from-top-1 duration-200">
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                                <LayoutDashboard className="w-3 h-3" /> Em Sala
                            </label>
                            <textarea
                                disabled={!canEdit}
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none shadow-sm disabled:opacity-60"
                                rows={3}
                                placeholder="O que a turma aprendeu hoje?"
                                value={batchActivity}
                                onChange={(e) => setBatchActivity(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5 flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" /> Para Casa
                            </label>
                            <textarea
                                disabled={!canEdit}
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none shadow-sm disabled:opacity-60"
                                rows={2}
                                placeholder="Lição de casa ou recados..."
                                value={batchHomework}
                                onChange={(e) => setBatchHomework(e.target.value)}
                            />
                        </div>
                        {canEdit && (
                            <Button onClick={handleApplyBatch} className="w-full bg-brand-600 hover:bg-brand-700 text-white h-10 rounded-xl text-sm font-bold shadow-lg shadow-brand-200">
                                Salvar Atividades
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {students.map((item) => {
                    const r = reportsMap[item.student_id] || {};
                    const routine = r.routine_data || {};
                    const attStatus = attendanceMap[item.student_id];
                    const isPresent = attStatus === 'present' || attStatus === 'late';
                    const isPending = attStatus === null || attStatus === undefined;
                    const status = statusMap[item.student_id];
                    const hasObservation = r.observations && r.observations.trim().length > 0;

                    return (
                        <div key={item.student_id} className={`bg-white rounded-2xl border transition-all duration-300
                            ${isPresent ? 'border-gray-200 shadow-sm hover:shadow-md' : ''}
                            ${!isPresent && !isPending ? 'border-red-100 bg-red-50/10 opacity-75' : ''}
                            ${isPending ? 'border-amber-200 bg-amber-50' : ''}
                        `}>
                            {/* Card Header (Mockup Style with Gradient) */}
                            <div className="p-4 flex justify-between items-center border-b border-slate-50 bg-gradient-to-r from-slate-50/50 to-white rounded-t-2xl">
                                <div className="flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm uppercase shadow-sm transition-colors ring-2 ring-white
                                        ${isPresent ? 'bg-brand-100 text-brand-600' : ''}
                                        ${!isPresent && !isPending ? 'bg-red-100 text-red-500' : ''}
                                        ${isPending ? 'bg-slate-100 text-slate-400' : ''}
                                    `}>
                                        {item.student?.name?.substring(0, 2)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-sm">{item.student?.name}</h3>
                                        {/* Status Text Below Name - Clickable Toggle */}
                                        <button
                                            disabled={!canEdit}
                                            onClick={() => toggleAttendance(item.student_id)}
                                            className="flex items-center gap-2 mt-0.5 group focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {!isPresent && !isPending && <span className="text-[10px] text-red-500 font-bold uppercase flex items-center gap-1 tracking-wider border-b border-dashed border-red-200 group-hover:border-red-400">Ausente</span>}
                                            {isPending && <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1 tracking-wider border-b border-dashed border-slate-200 group-hover:border-slate-400">Pendente</span>}
                                            {isPresent && <span className="text-[10px] text-brand-600 font-bold uppercase flex items-center gap-1 tracking-wider border-b border-dashed border-brand-200 group-hover:border-brand-400">Presente</span>}
                                        </button>
                                    </div>
                                </div>

                                {/* Status Badge & Expand */}
                                <div className="flex items-center gap-3">
                                    <div>
                                        {status === 'saved' && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200 font-bold">Salvo</span>}
                                        {status === 'unsaved' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full border border-amber-200 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Alterado</span>}
                                    </div>
                                    <button
                                        onClick={() => setExpandedCardId(expandedCardId === item.student_id ? null : item.student_id)}
                                        className="p-1 text-slate-400 hover:text-brand-600 transition-colors"
                                    >
                                        {expandedCardId === item.student_id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className={`p-4 animate-in fade-in slide-in-from-top-2 duration-300 ${expandedCardId === item.student_id ? 'block' : 'hidden md:grid md:grid-cols-2 lg:grid-cols-12'} gap-6`}>

                                {/* Routine Section - Hidden if Absent */}
                                {isPresent && (
                                    <div className="lg:col-span-12 xl:col-span-5 space-y-4 md:border-r border-gray-100 md:pr-5 mb-4 md:mb-0">
                                        {/* Mood Selector (Outlined Style) */}
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase mb-2">
                                                <Sun className="w-3.5 h-3.5" /> Humor do Dia
                                            </label>
                                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                                {[
                                                    { label: 'Feliz', emoji: '😄', activeClass: 'bg-gradient-to-br from-green-50 to-white border-green-200 text-green-700 shadow-sm ring-1 ring-green-100' },
                                                    { label: 'Cansado', emoji: '😴', activeClass: 'bg-gradient-to-br from-blue-50 to-white border-blue-200 text-blue-700 shadow-sm ring-1 ring-blue-100' },
                                                    { label: 'Choroso', emoji: '😭', activeClass: 'bg-gradient-to-br from-amber-50 to-white border-amber-200 text-amber-700 shadow-sm ring-1 ring-amber-100' },
                                                    { label: 'Doente', emoji: '🤒', activeClass: 'bg-gradient-to-br from-red-50 to-white border-red-200 text-red-700 shadow-sm ring-1 ring-red-100' }
                                                ].map((mood) => (
                                                    <button
                                                        key={mood.label}
                                                        disabled={!canEdit}
                                                        onClick={() => updateReport(item.student_id, 'mood', mood.label, true)}
                                                        className={`flex-shrink-0 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all flex flex-col items-center gap-1 min-w-[70px] disabled:opacity-50 disabled:cursor-not-allowed
                                                            ${routine.mood === mood.label
                                                                ? mood.activeClass
                                                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                            }
                                                        `}
                                                        title={mood.label}
                                                    >
                                                        <span className="text-lg leading-none">{mood.emoji}</span>
                                                        <span className="text-[10px] uppercase">{mood.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Routine Grid: Grouped by category */}
                                        <div className="space-y-4 mt-4">
                                            {/* Alimentação */}
                                            <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 space-y-3">
                                                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    <Utensils className="w-3 h-3" /> Alimentação
                                                </label>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Café da Manhã</span>
                                                        <select
                                                            className="w-full text-xs bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer"
                                                            value={routine.meals?.breakfast || ''}
                                                            onChange={(e) => updateReport(item.student_id, 'meals.breakfast', e.target.value, true)}
                                                        >
                                                            <option value="" className="text-gray-400">---</option>
                                                            <option value="☕ Comeu Tudo">☕ Comeu Tudo</option>
                                                            <option value="🍞 Comeu Bem">🍞 Comeu Bem</option>
                                                            <option value="🥣 Comeu Pouco">🥣 Comeu Pouco</option>
                                                            <option value="❌ Recusou">❌ Recusou</option>
                                                        </select>
                                                    </div>
                                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Almoço</span>
                                                        <select
                                                            className="w-full text-xs bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer"
                                                            value={routine.meals?.lunch || ''}
                                                            onChange={(e) => updateReport(item.student_id, 'meals.lunch', e.target.value, true)}
                                                        >
                                                            <option value="" className="text-gray-400">---</option>
                                                            <option value="🥘 Comeu Tudo">🥘 Comeu Tudo</option>
                                                            <option value="🍛 Comeu Bem">🍛 Comeu Bem</option>
                                                            <option value="🥡 Comeu Pouco">🥡 Comeu Pouco</option>
                                                            <option value="❌ Recusou">❌ Recusou</option>
                                                        </select>
                                                    </div>
                                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Lanche</span>
                                                        <select
                                                            className="w-full text-xs bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer"
                                                            value={routine.meals?.snack || ''}
                                                            onChange={(e) => updateReport(item.student_id, 'meals.snack', e.target.value, true)}
                                                        >
                                                            <option value="" className="text-gray-400">---</option>
                                                            <option value="🍎 Aceitou Bem">🍎 Aceitou Bem</option>
                                                            <option value="🍪 Comeu Pouco">🍪 Comeu Pouco</option>
                                                            <option value="❌ Recusou">❌ Recusou</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sono & Higiene */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 space-y-3">
                                                    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <Moon className="w-3 h-3" /> Sono
                                                    </label>
                                                    <div className="space-y-2">
                                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Status</span>
                                                            <select
                                                                className="w-full text-xs bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer"
                                                                value={routine.sleep?.nap || ''}
                                                                onChange={(e) => updateReport(item.student_id, 'sleep.nap', e.target.value, true)}
                                                            >
                                                                <option value="" className="text-gray-400">---</option>
                                                                <option value="😴 Dormiu Bem">😴 Dormiu Bem</option>
                                                                <option value="🥴 Agitado">🥴 Agitado</option>
                                                                <option value="👀 Não Dormiu">👀 Não Dormiu</option>
                                                            </select>
                                                        </div>
                                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Duração</span>
                                                            <input
                                                                type="text"
                                                                placeholder="Ex: 1h 30min"
                                                                className="w-full text-xs bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0"
                                                                value={routine.sleep?.duration || ''}
                                                                onChange={(e) => updateReport(item.student_id, 'sleep.duration', e.target.value, true)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>


                                                <div className="bg-slate-50/30 p-3 rounded-xl border border-slate-100 space-y-3">
                                                    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        <CheckCircle2 className="w-3 h-3" /> Higiene
                                                    </label>
                                                    <div className="space-y-2">
                                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Status</span>
                                                            <select
                                                                disabled={!canEdit}
                                                                className="w-full text-xs bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 cursor-pointer disabled:opacity-50"
                                                                value={typeof routine.hygiene === 'object' ? routine.hygiene.status : routine.hygiene || ''}
                                                                onChange={(e) => updateReport(item.student_id, 'hygiene.status', e.target.value, true)}
                                                            >
                                                                <option value="" className="text-gray-400">---</option>
                                                                <option value="✨ Normal">✨ Normal</option>
                                                                <option value="🧻 Troca Extra">🧻 Troca Extra</option>
                                                                <option value="⚠️ Irregular">⚠️ Irregular</option>
                                                            </select>
                                                        </div>
                                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Trocas de Fralda</span>
                                                            <input
                                                                disabled={!canEdit}
                                                                type="number"
                                                                min="0"
                                                                className="w-full text-xs bg-transparent border-none p-0 font-medium text-slate-700 focus:ring-0 disabled:opacity-50"
                                                                value={routine.hygiene?.diapers || 0}
                                                                onChange={(e) => updateReport(item.student_id, 'hygiene.diapers', parseInt(e.target.value) || 0, true)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                                }

                                {/* Observations Section (Mockup Style Button) */}
                                < div className={isPresent ? "lg:col-span-7 xl:col-span-7 flex flex-col gap-4" : "col-span-12 flex flex-col gap-4"} >
                                    <div className="flex-1 flex flex-col">
                                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase mb-2">
                                            <AlertCircle className="w-3.5 h-3.5" /> Observações Individuais
                                        </label>

                                        <button
                                            disabled={!canEdit}
                                            onClick={() => setObservationStudent(item.student)}
                                            className={`w-full py-3 px-4 rounded-xl border-dashed border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 h-full min-h-[140px] disabled:opacity-60 disabled:cursor-not-allowed
                                                ${hasObservation
                                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-brand-200 hover:text-brand-600 hover:bg-slate-50'
                                                }
                                            `}
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <FileText className={`w-6 h-6 ${hasObservation ? 'text-amber-500' : 'text-slate-300'}`} />
                                                <div className="flex items-center gap-2">
                                                    <span>{hasObservation ? 'Editar Observação' : 'Adicionar Observação'}</span>
                                                    {hasObservation && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                                </div>
                                                {hasObservation && (
                                                    <p className="text-[10px] font-normal text-amber-600/70 max-w-[200px] truncate italic mt-1">
                                                        "{r.observations}"
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div >
                    );
                })}
            </div >

            {/* Observation Modal (Mockup Style) */}
            {
                observationStudent && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setObservationStudent(null)} />
                        <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden transform transition-all">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 text-sm">Observação Diária</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{observationStudent.name}</p>
                                    </div>
                                </div>
                                <button onClick={() => setObservationStudent(null)} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-5 bg-white">
                                <label className="text-[10px] uppercase font-bold text-slate-400 mb-2 block">O que aconteceu hoje?</label>
                                <textarea
                                    autoFocus
                                    className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-2xl resize-none text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder-slate-300"
                                    placeholder="Descreva aqui detalhes importantes sobre o dia do aluno para os pais..."
                                    value={reportsMap[observationStudent.id]?.observations || ''}
                                    onChange={(e) => updateReport(observationStudent.id, 'observations', e.target.value)}
                                />
                            </div>
                            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
                                {canEdit && (
                                    <Button onClick={() => setObservationStudent(null)} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white h-12 rounded-2xl font-bold shadow-lg shadow-brand-600/20 active:scale-95 transition-all">
                                        Salvar e Fechar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                students.length === 0 && (
                    <div className="p-10 text-center text-gray-400">
                        Nenhum aluno nesta turma.
                    </div>
                )
            }
        </div >
    );
};
