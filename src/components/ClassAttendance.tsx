
import { type FC, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Button } from './ui';
import { Loader2, Check, X, Clock, Save, CheckCircle2, FileText } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

interface ClassAttendanceProps {
    classId: string;
    date: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | null;

export const ClassAttendance: FC<ClassAttendanceProps> = ({ classId, date }) => {
    const { addToast } = useToast();
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [noteOpenId, setNoteOpenId] = useState<string | null>(null);

    // Data
    const [students, setStudents] = useState<any[]>([]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus, notes: string }>>({});
    const [sheetId, setSheetId] = useState<string | null>(null);

    // Computed
    const totalStudents = students.length;
    const markedCount = Object.values(attendanceMap).filter(s => s.status !== null).length;
    const pendingCount = totalStudents - markedCount;
    const isComplete = totalStudents > 0 && pendingCount === 0;

    useEffect(() => {
        fetchData();
    }, [classId, date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Students in Class
            const { data: roster, error: rosterError } = await supabase
                .from('class_enrollments')
                .select('student_id, student:students(id, name, photo_url)')
                .eq('class_id', classId)
                .order('student(name)');

            if (rosterError) throw rosterError;

            // Sort in JS to be safe
            const sortedRoster = (roster || []).sort((a: any, b: any) =>
                (a.student?.name || '').localeCompare(b.student?.name || '')
            );
            setStudents(sortedRoster);

            // 2. Fetch Existing Attendance Sheet
            const { data: sheet } = await supabase
                .from('class_attendance_sheets')
                .select('id')
                .eq('class_id', classId)
                .eq('date', date)
                .single();

            if (sheet) {
                setSheetId(sheet.id);
                // Fetch details
                const { data: details } = await supabase
                    .from('student_attendance')
                    .select('student_id, status, notes')
                    .eq('sheet_id', sheet.id);

                const map: any = {};
                // Pre-fill with existing data
                details?.forEach((d: any) => {
                    map[d.student_id] = { status: d.status, notes: d.notes || '' };
                });

                // Ensure all students are in the map (even if added later)
                sortedRoster.forEach((s: any) => {
                    if (!map[s.student_id]) {
                        map[s.student_id] = { status: null, notes: '' };
                    }
                });

                setAttendanceMap(map);
            } else {
                setSheetId(null);
                // Default to NULL (Explicit Attendance)
                const map: any = {};
                sortedRoster.forEach((s: any) => {
                    map[s.student_id] = { status: null, notes: '' };
                });
                setAttendanceMap(map);
            }

        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar dados da chamada.');
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = (studentId: string) => {
        setAttendanceMap(prev => {
            const current = prev[studentId];
            let nextStatus: AttendanceStatus = 'present';

            if (current.status === 'present') nextStatus = 'absent';
            else if (current.status === 'absent') nextStatus = 'late';
            else if (current.status === 'late') nextStatus = 'present';
            else nextStatus = 'present'; // From null to present

            return {
                ...prev,
                [studentId]: { ...current, status: nextStatus }
            };
        });
    };

    const markAllPresent = () => {
        setAttendanceMap(prev => {
            const next = { ...prev };
            students.forEach(s => {
                if (next[s.student_id]?.status === null) {
                    next[s.student_id] = { ...next[s.student_id], status: 'present' };
                }
            });
            return next;
        });
        addToast('success', 'Todos pendentes marcados como presente!');
    };

    const handleSave = async () => {
        // Permite salvar parcial, apenas avisa se não houver NADA marcado
        if (markedCount === 0) {
            addToast('error', 'Marque pelo menos um aluno para salvar.');
            return;
        }

        setSaving(true);
        try {
            let currentSheetId = sheetId;

            // 1. Create Sheet if not exists
            if (!currentSheetId) {
                const { data: newSheet, error: createError } = await supabase
                    .from('class_attendance_sheets')
                    .insert({ class_id: classId, date, school_id: currentSchool?.id })
                    .select()
                    .single();

                if (createError) throw createError;
                currentSheetId = newSheet.id;
                setSheetId(currentSheetId);
            }

            // 2. Upsert Records (Apenas os que foram marcados)
            const records = students
                .filter((s: any) => attendanceMap[s.student_id]?.status !== null)
                .map((s: any) => ({
                    sheet_id: currentSheetId,
                    student_id: s.student_id,
                    status: attendanceMap[s.student_id]?.status,
                    notes: attendanceMap[s.student_id]?.notes
                }));

            if (records.length === 0) return;

            const { error: upsertError } = await supabase
                .from('student_attendance')
                .upsert(records, { onConflict: 'sheet_id,student_id' });

            if (upsertError) throw upsertError;

            addToast('success', 'Chamada salva com sucesso!');

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
            <p className="text-gray-500 font-medium">Carregando lista de chamada...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Control Bar */}
            {/* Control Bar - Desktop */}
            <div className="hidden md:block bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4 sticky top-4 z-20">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">

                        {/* Status Counters */}
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col px-3 border-l border-gray-200">
                                <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Total</span>
                                <span className="font-bold text-gray-900 leading-none">{totalStudents}</span>
                            </div>
                            <div className="flex flex-col px-3 border-l border-gray-200">
                                <span className="text-[10px] text-green-500 uppercase font-black tracking-wider">Presentes</span>
                                <span className="font-bold text-green-600 leading-none">
                                    {Object.values(attendanceMap).filter(s => s.status === 'present').length}
                                </span>
                            </div>
                            <div className="flex flex-col px-3 border-l border-gray-200">
                                <span className="text-[10px] text-red-400 uppercase font-black tracking-wider">Ausentes</span>
                                <span className="font-bold text-red-500 leading-none">
                                    {Object.values(attendanceMap).filter(s => s.status === 'absent').length}
                                </span>
                            </div>
                            {pendingCount > 0 && (
                                <div className="flex flex-col px-3 border-l border-gray-200 animate-pulse">
                                    <span className="text-[10px] text-amber-500 uppercase font-black tracking-wider">Pendentes</span>
                                    <span className="font-bold text-amber-600 leading-none">{pendingCount}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        {pendingCount > 0 && (
                            <Button
                                variant="outline"
                                onClick={markAllPresent}
                                disabled={saving}
                                className="flex-1 md:flex-none border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-brand-300"
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Marcar Todos Presentes
                            </Button>
                        )}

                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex-1 md:flex-none min-w-[170px] text-white transition-all shadow-lg
                                ${markedCount > 0 ? 'bg-brand-600 hover:bg-brand-700 hover:scale-105' : 'bg-gray-300 cursor-not-allowed'}
                            `}
                        >
                            {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            <div className="flex flex-col items-start leading-none gap-0.5">
                                <span className="text-sm font-bold">{saving ? 'Salvando...' : 'Salvar Chamada'}</span>
                                {pendingCount > 0 && !saving && (
                                    <span className="text-[9px] text-white/70 font-medium">Faltam {pendingCount} alunos</span>
                                )}
                            </div>
                        </Button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ease-out ${isComplete ? 'bg-brand-500' : 'bg-amber-400'}`}
                        style={{ width: `${(markedCount / totalStudents) * 100}%` }}
                    />
                </div>
            </div>

            {/* Mobile FAB - Floating Save Button */}
            <div className="md:hidden fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`
                        flex items-center gap-3 px-6 py-4 rounded-2xl font-black shadow-2xl transition-all active:scale-95
                        ${markedCount > 0
                            ? 'bg-brand-600 text-white shadow-brand-600/40'
                            : 'bg-slate-200 text-slate-400 border border-slate-300'}
                    `}
                >
                    {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    <div className="flex flex-col items-start leading-none">
                        <span className="text-xs uppercase tracking-widest mb-0.5">
                            {saving ? 'Salvando...' : 'Salvar Chamada'}
                        </span>
                        {!saving && (
                            <span className="text-[10px] opacity-80">
                                {markedCount}/{totalStudents} • {pendingCount > 0 ? `Faltam ${pendingCount}` : 'Concluído'}
                            </span>
                        )}
                    </div>
                </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {students.map((item) => {
                    const current = attendanceMap[item.student_id] || { status: null, notes: '' };
                    const status = current.status;
                    const note = current.notes;
                    const hasNotes = note && note.trim().length > 0;
                    const isNotesOpen = noteOpenId === item.student_id;

                    const isPresent = status === 'present';
                    const isAbsent = status === 'absent';
                    const isLate = status === 'late';
                    const isPending = status === null;

                    return (
                        <div
                            key={item.student_id}
                            className={`
                                relative flex flex-col rounded-xl border transition-all duration-200 overflow-visible group
                                ${isPending ? 'bg-white border-gray-200 hover:border-gray-300' : ''}
                                ${isPresent ? 'bg-green-50/50 border-green-400 shadow-sm' : ''}
                                ${isAbsent ? 'bg-red-50/50 border-red-400 shadow-sm' : ''}
                                ${isLate ? 'bg-amber-50/50 border-amber-400 shadow-sm' : ''}
                            `}
                        >
                            {/* Card Body - Click to Toggle Status */}
                            <div
                                onClick={() => toggleStatus(item.student_id)}
                                className="p-3 cursor-pointer flex flex-col items-center justify-center text-center select-none min-h-[110px]"
                            >
                                <div className="relative mb-2">
                                    {item.student?.photo_url ? (
                                        <img src={item.student.photo_url} className="w-10 h-10 rounded-full object-cover shadow-sm border border-white" />
                                    ) : (
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border border-white shadow-sm
                                            ${isPending ? 'bg-gray-100 text-gray-500' : ''}
                                            ${isPresent ? 'bg-green-100 text-green-700' : ''}
                                            ${isAbsent ? 'bg-red-100 text-red-700' : ''}
                                            ${isLate ? 'bg-amber-100 text-amber-700' : ''}
                                        `}>
                                            {item.student?.name?.substring(0, 2).toUpperCase()}
                                        </div>
                                    )}

                                    {!isPending && (
                                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white shadow-sm ring-2 ring-white
                                            ${isPresent ? 'bg-green-500' : ''}
                                            ${isAbsent ? 'bg-red-500' : ''}
                                            ${isLate ? 'bg-amber-500' : ''}
                                        `}>
                                            {isPresent && <Check className="w-2.5 h-2.5" />}
                                            {isAbsent && <X className="w-2.5 h-2.5" />}
                                            {isLate && <Clock className="w-2.5 h-2.5" />}
                                        </div>
                                    )}
                                </div>

                                <h4 className={`font-bold text-xs leading-tight line-clamp-2 px-1 ${isPending ? 'text-gray-600' : 'text-gray-900'}`}>
                                    {item.student?.name}
                                </h4>

                                <div className="h-4 mt-1">
                                    {isPending && <span className="text-[10px] text-gray-400 font-medium">Toque para marcar</span>}
                                    {isPresent && <span className="text-[10px] text-green-600 font-bold uppercase">Presente</span>}
                                    {isAbsent && <span className="text-[10px] text-red-600 font-bold uppercase">Falta</span>}
                                    {isLate && <span className="text-[10px] text-amber-600 font-bold uppercase">Atraso</span>}
                                </div>
                            </div>

                            {/* Footer / Notes Toggle */}
                            {!isPending && (
                                <div className={`border-t flex items-center justify-center h-8 transition-colors
                                    ${isPresent ? 'border-green-100 hover:bg-green-100/50' : ''}
                                    ${isAbsent ? 'border-red-100 hover:bg-red-100/50' : ''}
                                    ${isLate ? 'border-amber-100 hover:bg-amber-100/50' : ''}
                                `}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNoteOpenId(isNotesOpen ? null : item.student_id);
                                        }}
                                        className="w-full h-full flex items-center justify-center"
                                        title="Adicionar Observação"
                                    >
                                        <div className="relative">
                                            <FileText className={`w-3.5 h-3.5 ${hasNotes ? 'text-gray-900 fill-gray-900' : 'text-gray-400'}`} />
                                            {hasNotes && !isNotesOpen && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-brand-500 rounded-full ring-1 ring-white" />}
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* Popover Notes Input */}
                            {isNotesOpen && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[200px] z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-2 animate-in fade-in slide-in-from-top-1">
                                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-gray-200 rotate-45" />
                                    <textarea
                                        autoFocus
                                        className="w-full text-xs p-2 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                                        rows={3}
                                        placeholder="Digite uma observação..."
                                        value={note}
                                        onChange={(e) => setAttendanceMap(prev => ({
                                            ...prev,
                                            [item.student_id]: { ...prev[item.student_id], notes: e.target.value }
                                        }))}
                                    />
                                    <div className="flex justify-end mt-1">
                                        <button onClick={() => setNoteOpenId(null)} className="text-[10px] font-bold text-gray-500 hover:text-gray-700">OK</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {students.length === 0 && (
                <div className="p-10 text-center text-gray-400 bg-white rounded-xl border-dashed border-2 border-gray-200">
                    <p>Nenhum aluno enturmado para realizar a chamada.</p>
                </div>
            )}
        </div>
    );
};
