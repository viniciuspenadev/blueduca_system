import { type FC, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { AlertCircle, MessageCircle, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface AbsentStudent {
    id: string;
    name: string;
    photo_url: string | null;
    className: string;
    phone: string | null;
}

export const AbsentStudentsWidget: FC = () => {
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [absentStudents, setAbsentStudents] = useState<AbsentStudent[]>([]);

    useEffect(() => {
        if (currentSchool?.id) {
            fetchAbsentStudents();
        }
    }, [currentSchool?.id]);

    const fetchAbsentStudents = async () => {
        setLoading(true);
        try {
            // Em vez de 'en-CA' puro, pega exatos YYYY-MM-DD do fuso local 
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            console.log('[AbsentWidget] HOJE É:', today, 'ESCOLA:', currentSchool?.id);

            // 1. Get all sheets for today with class info
            // Limit to currentSchool
            const { data: sheets, error: sheetsError } = await supabase
                .from('class_attendance_sheets')
                .select(`
                    id,
                    class_id,
                    classes!inner ( name, school_id )
                `)
                .eq('date', today)
                .eq('classes.school_id', currentSchool?.id);

            console.log('[AbsentWidget] SHEETS AVALIADAS:', sheets, 'ERROR:', sheetsError);

            if (sheetsError) throw sheetsError;

            if (!sheets || sheets.length === 0) {
                setAbsentStudents([]);
                return;
            }

            const sheetMap = new Map();
            sheets.forEach(s => {
                sheetMap.set(s.id, (s.classes as any)?.name || 'Turma não informada');
            });

            const sheetIds = sheets.map(s => s.id);
            console.log('[AbsentWidget] Mapeado SheetIds:', sheetIds);

            // 2. Get absent records and student info
            const { data: records, error: recordsError } = await supabase
                .from('student_attendance')
                .select(`
                    student_id,
                    sheet_id,
                    status,
                    student:students (
                        id,
                        name,
                        photo_url,
                        enrollments (
                            details
                        )
                    )
                `)
                .in('sheet_id', sheetIds)
                .eq('status', 'absent');

            console.log('[AbsentWidget] RECORDS:', records, 'ERRO:', recordsError);

            if (recordsError) throw recordsError;

            if (records) {
                const formattedList = records.map((record: any) => {
                    // Tenta extrair o telefone de dentro do enrollments vinculado ao aluno
                    const studentEnrollments = record.student?.enrollments || [];
                    const activeEnrollment = Array.isArray(studentEnrollments) ? studentEnrollments[0] : studentEnrollments;
                    const parentPhone = activeEnrollment?.details?.parent_phone || null;

                    return {
                        id: record.student_id,
                        name: record.student?.name || 'Aluno Desconhecido',
                        photo_url: record.student?.photo_url || null,
                        className: sheetMap.get(record.sheet_id) || 'Turma não informada',
                        phone: parentPhone
                    };
                });

                // Sort alphabetically by name
                formattedList.sort((a, b) => a.name.localeCompare(b.name));
                setAbsentStudents(formattedList);
            }

        } catch (error) {
            console.error('Error fetching absent students:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleWhatsApp = (studentName: string, phone: string | null) => {
        if (!phone) {
            alert('Telefone do responsável não cadastrado.');
            return;
        }

        // Remove non-numeric chars
        const cleanPhone = phone.replace(/\D/g, '');
        const message = encodeURIComponent(`Olá! Somos da escola e notamos a ausência do(a) aluno(a) ${studentName} na aula de hoje. Está tudo bem?`);
        window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full min-h-[300px] flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse"></div>
                    <div className="h-4 w-32 bg-gray-100 rounded animate-pulse"></div>
                </div>
                <div className="space-y-4 py-4 w-full h-full flex flex-col justify-center items-center">
                    <div className="animate-pulse flex space-x-4">
                        <div className="rounded-full bg-slate-200 h-10 w-10"></div>
                        <div className="flex-1 space-y-6 py-1">
                            <div className="h-2 bg-slate-200 rounded text-center mb-2 w-[180px]"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 tracking-tight">Alunos Faltantes</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">Chamadas finalizadas hoje</p>
                    </div>
                </div>
                <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold ring-1 ring-red-100">
                    {absentStudents.length} {absentStudents.length === 1 ? 'ausência' : 'ausências'}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3 custom-scrollbar">
                {absentStudents.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                            <Clock className="w-6 h-6 text-green-500" />
                        </div>
                        <p className="text-sm text-gray-500 font-medium">Nenhuma falta registrada</p>
                        <p className="text-xs text-gray-400 mt-1">Todos os alunos presentes ou chamada pendente.</p>
                    </div>
                ) : (
                    absentStudents.map((student) => (
                        <div
                            key={student.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-gray-50 bg-gray-50/50 hover:bg-white hover:shadow-sm hover:border-gray-100 transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                {student.photo_url ? (
                                    <img src={student.photo_url} alt={student.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                                        {student.name.substring(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs lg:text-sm font-bold text-gray-900 leading-tight group-hover:text-brand-600 transition-colors line-clamp-1">
                                        {student.name}
                                    </p>
                                    <p className="text-[10px] lg:text-xs text-gray-500 mt-0.5">{student.className}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => handleWhatsApp(student.name, student.phone)}
                                className={`
                                    p-2 rounded-lg transition-all flex items-center justify-center
                                    ${student.phone
                                        ? 'bg-green-50 text-green-600 hover:bg-green-500 hover:text-white hover:shadow-md'
                                        : 'bg-gray-50 text-gray-400 cursor-not-allowed'}
                                `}
                                title={student.phone ? "Enviar WhatsApp para responsável" : "Telefone não cadastrado"}
                                disabled={!student.phone}
                            >
                                <MessageCircle className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>

    );
};
