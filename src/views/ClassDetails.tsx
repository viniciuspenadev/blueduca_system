import { type FC, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Button, Input, Modal, Badge } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';
import { ClassAttendance } from '../components/ClassAttendance';
import { ClassDailyAgenda } from '../components/ClassDailyAgenda';
import { ClassGrades } from '../components/ClassGrades';
import { PlanningKanban } from './planning/components/PlanningKanban';
import { PlanningCalendar } from './planning/components/PlanningCalendar';
import { CustomDatePicker } from '../components/ui/CustomDatePicker';
import { planningService } from '../services/planningService';

import {
    ArrowLeft,
    Users,
    GraduationCap,
    Trash2,
    UserPlus,
    Search,
    BookOpen,
    Calendar,
    FileText,
    Layout,
    Check,
    Plus,
    Edit,
    LogOut,
    X,
    Star
} from 'lucide-react';
import type { Class, ClassEnrollment } from '../types';

export const ClassDetailsView: FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const { currentSchool, user } = useAuth(); // Fixed: user instead of session

    const [loading, setLoading] = useState(true);
    const [classData, setClassData] = useState<Class | null>(null);
    const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'attendance' | 'diary' | 'grades' | 'planning'>('students');
    const [planningViewMode, setPlanningViewMode] = useState<'week' | 'month'>('week');
    const [events, setEvents] = useState<any[]>([]); // Store School Events

    // Shared Date State
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    // Add Student Modal State
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    const [studentSearch, setStudentSearch] = useState('');
    const [availableStudents, setAvailableStudents] = useState<any[]>([]);

    // Add Teacher Modal State
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [teacherSearch, setTeacherSearch] = useState('');
    const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);

    const [mobileActiveTab, setMobileActiveTab] = useState<'attendance' | 'diary' | 'grades' | 'planning'>('diary');

    // Simplified Mobile Tab Sync
    useEffect(() => {
        if (mobileActiveTab === 'attendance') setActiveTab('attendance');
        else if (mobileActiveTab === 'diary') setActiveTab('diary');
    }, [mobileActiveTab]);

    // Edit Class Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Class>>({});
    const [timelines, setTimelines] = useState<any[]>([]); // simplified type

    useEffect(() => {
        if (isEditModalOpen) {
            fetchTimelines();
            setEditForm({
                name: classData?.name,
                school_year: classData?.school_year,
                shift: classData?.shift,
                capacity: classData?.capacity,
                daily_timeline_id: classData?.daily_timeline_id
            });
        }
    }, [isEditModalOpen, classData]);

    const fetchTimelines = async () => {
        if (!currentSchool) return;
        const { data } = await supabase
            .from('daily_timelines')
            .select('id, name')
            .eq('school_id', currentSchool.id);
        if (data) setTimelines(data);
    };

    const handleUpdateClass = async () => {
        try {
            const { error } = await supabase
                .from('classes')
                .update(editForm)
                .eq('id', id);

            if (error) throw error;

            addToast('success', 'Turma atualizada com sucesso!');
            setIsEditModalOpen(false);
            fetchClassDetails();
        } catch (error: any) {
            addToast('error', 'Erro ao atualizar: ' + error.message);
        }
    };

    // Date Picker Highlights
    const [lessonDates, setLessonDates] = useState<string[]>([]);

    // Feature: Fetch lesson dates for calendar highlights
    const fetchLessonDates = async () => {
        if (!classData) return;
        try {
            const dates = await planningService.getLessonDates(
                id!,
                `${classData.school_year}-01-01`,
                `${classData.school_year}-12-31`
            );
            setLessonDates(dates);
        } catch (error) {
            console.error('Error fetching lesson dates:', error);
        }
    };

    useEffect(() => {
        if (classData) {
            fetchLessonDates();
            fetchEvents();
        }
    }, [classData, planningViewMode, selectedDate]); // Refetch when view/date changes

    const fetchEvents = async () => {
        if (!id) return;

        let startStr, endStr;
        const d = new Date(selectedDate + 'T12:00:00'); // Use same date logic as components
        const year = d.getFullYear();

        if (planningViewMode === 'month') {
            const month = d.getMonth();
            startStr = new Date(year, month, 1).toISOString().split('T')[0];
            endStr = new Date(year, month + 1, 0).toISOString().split('T')[0];
        } else {
            // Week logic
            const start = new Date(d);
            const day = start.getDay() || 7;
            if (day !== 1) start.setHours(-24 * (day - 1));

            const end = new Date(start);
            end.setDate(end.getDate() + 4); // Friday

            startStr = start.toISOString().split('T')[0];
            endStr = end.toISOString().split('T')[0];
        }

        if (!currentSchool) return;

        const { data } = await supabase
            .from('events')
            .select('*')
            .eq('school_id', currentSchool.id)
            .or(`class_id.is.null,class_id.eq.${id}`)
            .gte('start_time', `${startStr}T00:00:00`)
            .lte('start_time', `${endStr}T23:59:59`);

        if (data) setEvents(data);
    };

    // Feature: Auto-correct date when class loads
    useEffect(() => {
        if (classData?.school_year) {
            const year = parseInt(classData.school_year.toString());
            const currentYearStr = selectedDate.split('-')[0];
            const currentYearInt = parseInt(currentYearStr);

            if (year !== currentYearInt) {
                // If we are viewing a class from 2024, but date is 2026, snap to 2024-12-01 (or today if same year)
                // Let's just snap to the last valid school day of that year allowed? Or the first?
                // Let's safe bet: YYYY-MM-DD -> keep MM-DD if valid, else 01-01
                // Actually user asked to "travas" (lock).

                // If today is NOT in the target year, move to target year.
                // Auto-correct to start of school year
                setSelectedDate(`${year}-02-01`);
            }
        }
    }, [classData?.school_year]);


    // Validation Logic
    const minDate = classData ? `${classData.school_year}-01-01` : undefined;
    const maxDate = classData ? `${classData.school_year}-12-31` : undefined;

    const fetchClassDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('classes')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            setClassData(data);
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar turma');
            navigate('/turmas');
        }
    };

    const fetchEnrollments = async () => {
        try {
            const { data, error } = await supabase
                .from('class_enrollments')
                .select(`
                    *,
                    student:students(id, name, photo_url),
                    enrollment:enrollments(id, status)
                `)
                .eq('class_id', id);

            if (error) throw error;
            setEnrollments(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchTeachers = async () => {
        try {
            const { data, error } = await supabase
                .from('class_teachers')
                .select(`
                    *,
                    teacher:profiles(id, name, email, avatar_url)
                `)
                .eq('class_id', id);

            if (error) throw error;
            setTeachers(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchAvailableStudents = async () => {
        if (!classData) return;

        try {
            if (!currentSchool) return;
            // REGRA: Só mostrar alunos com Matrícula APROVADA para o ANO LETIVO da turma.
            const { data, error } = await supabase
                .from('enrollments')
                .select('id, student_id, candidate_name, student:students(name)')
                .eq('school_id', currentSchool.id)
                .eq('status', 'approved')
                .eq('academic_year', classData.school_year)
                .not('student_id', 'is', null)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Filter out those already in THIS class
            const currentStudentIds = enrollments.map(e => e.student_id);
            const available = data ? data.filter(e => !currentStudentIds.includes(e.student_id)) : [];

            setAvailableStudents(available);
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao buscar alunos disponíveis');
        }
    };

    const fetchAvailableTeachers = async () => {
        if (!currentSchool) return;
        try {
            const { data: members, error: memberError } = await supabase
                .from('school_members')
                .select('user_id, profiles!inner(*)')
                .eq('school_id', currentSchool.id);

            if (memberError) throw memberError;

            // Filter for teachers in application logic if needed, or if we trust profiles.role
            const teachersList = members
                .map((m: any) => m.profiles)
                .filter((p: any) => p.role === 'TEACHER');

            const existingIds = teachers.map(t => t.teacher_id);
            setAvailableTeachers(teachersList.filter((t: any) => !existingIds.includes(t.id)));
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddStudent = async (enrollmentId: string, studentId: string) => {
        try {
            const { error } = await supabase
                .from('class_enrollments')
                .insert({
                    class_id: id,
                    enrollment_id: enrollmentId,
                    student_id: studentId
                });

            if (error) throw error;

            addToast('success', 'Aluno adicionado!');
            setIsAddStudentOpen(false);
            fetchEnrollments();
            fetchClassDetails(); // Update counts if any
        } catch (error: any) {
            addToast('error', error.message);
        }
    };

    const handleAddTeacher = async (teacherId: string) => {
        try {
            const { error } = await supabase
                .from('class_teachers')
                .insert({
                    class_id: id,
                    teacher_id: teacherId,
                    is_primary: teachers.length === 0 // First one is primary by default
                });

            if (error) throw error;

            addToast('success', 'Professor adicionado!');
            setIsAddTeacherOpen(false);
            fetchTeachers();
        } catch (error: any) {
            addToast('error', error.message);
        }
    };

    const handleRemoveTeacher = async (teacherId: string) => {
        try {
            // 1. Check for movement
            const { data: movement, error: moveError } = await supabase.rpc('check_teacher_movement', {
                p_class_id: id,
                p_teacher_id: teacherId
            });

            if (moveError) throw moveError;

            if (movement.has_movement) {
                addToast('error', 'Este professor possui lançamentos nesta turma (lições ou chamadas) e não pode ser removido.');
                return;
            }

            const isConfirmed = await confirm({
                title: 'Remover Professor',
                message: 'Tem certeza que deseja remover este professor da turma?',
                type: 'danger',
                confirmText: 'Remover'
            });

            if (!isConfirmed) return;

            const { error } = await supabase
                .from('class_teachers')
                .delete()
                .eq('class_id', id)
                .eq('teacher_id', teacherId);

            if (error) throw error;

            addToast('success', 'Professor removido da turma!');
            fetchTeachers();
        } catch (error: any) {
            addToast('error', 'Erro ao remover: ' + error.message);
        }
    };

    const handleToggleTeacherStatus = async (teacherId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
        const actionLabel = newStatus === 'ACTIVE' ? 'Ativar' : 'Desativar';

        try {
            const { error } = await supabase
                .from('class_teachers')
                .update({ status: newStatus })
                .eq('class_id', id)
                .eq('teacher_id', teacherId);

            if (error) throw error;

            addToast('success', `Professor ${actionLabel === 'Ativar' ? 'ativado' : 'desativado'} com sucesso!`);
            fetchTeachers();
        } catch (error: any) {
            addToast('error', 'Erro ao alterar status: ' + error.message);
        }
    };

    const handleSetPrimaryTeacher = async (teacherId: string) => {
        try {
            // Primeiro, remove o status de regente de todos os outros professores desta turma
            const { error: resetError } = await supabase
                .from('class_teachers')
                .update({ is_primary: false })
                .eq('class_id', id);

            if (resetError) throw resetError;

            // Depois, define o professor selecionado como regente
            const { error: setError } = await supabase
                .from('class_teachers')
                .update({ is_primary: true })
                .eq('class_id', id)
                .eq('teacher_id', teacherId);

            if (setError) throw setError;

            addToast('success', 'Professor regente alterado com sucesso!');
            fetchTeachers();
        } catch (error: any) {
            addToast('error', 'Erro ao alterar regente: ' + error.message);
        }
    };

    useEffect(() => {
        if (id) {
            Promise.all([fetchClassDetails(), fetchEnrollments(), fetchTeachers()])
                .finally(() => setLoading(false));
        }
    }, [id]);

    useEffect(() => {
        if (isAddStudentOpen) fetchAvailableStudents();
    }, [isAddStudentOpen]);

    useEffect(() => {
        if (isAddTeacherOpen) fetchAvailableTeachers();
    }, [isAddTeacherOpen]);

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;
    if (!classData) return null;

    return (
        <>
            {/* =================================================================================
                DESKTOP VIEW (Header, Stats, Tabs and Main Content)
               ================================================================================= */}
            <div className="hidden md:block space-y-4 lg:space-y-8 animate-fade-in pb-20">
                {/* Header / Hero */}
                <div className="relative bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                    {/* Background layers */}
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-800 opacity-95" />
                    <div className="absolute top-0 right-0 w-1/3 h-full bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)]" />
                    <div className="absolute bottom-0 left-0 w-full h-32 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />

                    <div className="relative pt-4 lg:pt-8 px-6 lg:px-10 pb-6 lg:pb-10">
                        {/* Top Actions Layer */}
                        <div className="flex justify-between items-center mb-4 lg:mb-10">
                            <Button
                                variant="ghost"
                                className="text-white hover:bg-white/20 hover:text-white bg-white/5 border border-white/10 px-4 lg:px-6 rounded-xl lg:rounded-2xl backdrop-blur-md text-xs lg:text-sm"
                                onClick={() => navigate('/turmas')}
                            >
                                <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                                Voltar para Turmas
                            </Button>

                            <div className="flex items-center gap-3">
                                {(user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                                    <Button
                                        variant="ghost"
                                        className="text-white hover:bg-white/20 bg-white/5 border border-white/10 px-5 rounded-2xl backdrop-blur-md"
                                        onClick={() => setIsEditModalOpen(true)}
                                    >
                                        <Edit className="w-4 h-4 mr-2" />
                                        Editar
                                    </Button>
                                )}

                                {(user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                                    <Button
                                        variant="ghost"
                                        className="text-white hover:bg-red-500 hover:text-white bg-white/5 border border-white/10 px-5 rounded-2xl backdrop-blur-md"
                                        onClick={async () => {
                                            if (enrollments.length > 0) {
                                                addToast('error', 'Não é possível excluir uma turma que possui alunos vinculados.');
                                                return;
                                            }

                                            const isConfirmed = await confirm({
                                                title: 'Excluir Turma',
                                                message: 'Tem certeza que deseja excluir esta turma? Esta ação não pode ser desfeita.',
                                                type: 'danger',
                                                confirmText: 'Excluir Turma'
                                            });

                                            if (isConfirmed) {
                                                setLoading(true);
                                                try {
                                                    const { error } = await supabase.from('classes').delete().eq('id', id);
                                                    if (error) throw error;
                                                    addToast('success', 'Turma excluída com sucesso');
                                                    navigate('/turmas');
                                                } catch (err: any) {
                                                    addToast('error', 'Erro ao excluir: ' + err.message);
                                                    setLoading(false);
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Main Title & Stats Layer */}
                        <div className="flex flex-col lg:flex-row gap-10 items-end justify-between">
                            <div className="flex gap-8 items-end flex-1">
                                <div className="mb-2 text-white z-10">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Badge className="border-white/30 text-white bg-white/10 uppercase font-black tracking-[0.2em] text-[10px] px-3 py-1">
                                            {classData.shift === 'morning' ? 'Manhã' : classData.shift === 'afternoon' ? 'Tarde' : classData.shift}
                                        </Badge>
                                        <Badge className="border-white/30 text-white bg-white/10 uppercase font-black tracking-[0.2em] text-[10px] px-3 py-1">
                                            {classData.school_year}
                                        </Badge>
                                    </div>
                                    <h1 className="text-3xl lg:text-5xl font-black tracking-tight mb-1 lg:mb-2 leading-none">{classData.name}</h1>
                                    <div className="flex items-center gap-2 text-white/70 font-bold text-xs lg:text-base">
                                        <div className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-green-400 animate-pulse" />
                                        {enrollments.length} alunos ativos nesta turma
                                    </div>
                                </div>
                            </div>

                            {/* Consolidated Date Selector & Stats */}
                            <div className="flex gap-4 items-center z-10">
                                {/* Stats Cards Inline */}
                                <div className="flex gap-3 h-12 lg:h-14 bg-white/10 backdrop-blur-md rounded-xl lg:rounded-2xl p-1 border border-white/20 shadow-lg">
                                    <div className="flex flex-col justify-center px-3 lg:px-4 border-r border-white/10">
                                        <span className="text-[10px] scale-90 lg:scale-100 font-black text-white/50 uppercase tracking-widest text-[9px]">Alunos</span>
                                        <span className="text-base lg:text-lg font-black text-white leading-none">{enrollments.length}</span>
                                    </div>
                                    <div className="flex flex-col justify-center px-3 lg:px-4">
                                        <span className="text-[10px] scale-90 lg:scale-100 font-black text-white/50 uppercase tracking-widest text-[9px]">Professores</span>
                                        <span className="text-base lg:text-lg font-black text-white leading-none">{teachers.length}</span>
                                    </div>
                                </div>

                                {/* Single Date Picker */}
                                <div className="relative group flex flex-col items-end">
                                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-1.5 border border-white/30 flex items-center gap-3 hover:bg-white/20 transition-all shadow-xl">
                                        <div className="flex flex-col px-4 py-1">
                                            <span className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none mb-1">Data de Trabalho</span>
                                            <CustomDatePicker
                                                value={selectedDate}
                                                onChange={setSelectedDate}
                                                minDate={minDate}
                                                maxDate={maxDate}
                                                highlightedDates={lessonDates}
                                                align="right"
                                                showIcon={false}
                                                className="text-white !font-black !p-0 !bg-transparent !border-none !shadow-none cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div >
                            </div>
                        </div>
                    </div>
                </div >

                {/* Navigation Tabs (Desktop) */}
                < div className="flex justify-center" >
                    <div className="bg-white p-1 lg:p-1.5 rounded-xl lg:rounded-2xl shadow-sm border border-gray-200 inline-flex gap-1 overflow-x-auto max-w-full">
                        {[
                            { id: 'students', label: 'Alunos', icon: Users },
                            { id: 'teachers', label: 'Professores', icon: GraduationCap },
                            { id: 'attendance', label: 'Chamada', icon: BookOpen },
                            { id: 'diary', label: 'Agenda', icon: BookOpen },
                            { id: 'grades', label: 'Notas', icon: FileText },
                            { id: 'planning', label: 'Atividades', icon: Layout }
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`
                                        flex items-center gap-2 px-3 lg:px-6 py-1.5 lg:py-2.5 rounded-lg lg:rounded-xl text-xs lg:text-sm font-bold transition-all whitespace-nowrap
                                        ${isActive
                                            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                        }
                                    `}
                                >
                                    <Icon className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div >

                {/* Content Area (Desktop) */}
                < div className="min-h-[400px] animate-fade-in-up" >
                    {activeTab === 'students' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">Lista de Alunos</h3>
                                {(user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                                    <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={() => setIsAddStudentOpen(true)}>
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Adicionar Aluno
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {enrollments.length === 0 ? (
                                    <div className="col-span-full bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                            <Users className="w-8 h-8 text-gray-300" />
                                        </div>
                                        <h3 className="text-gray-900 font-medium mb-1">Nenhum aluno enturmado</h3>
                                        <p className="text-gray-500 text-sm">Adicione alunos para começar a gerenciar.</p>
                                    </div>
                                ) : (
                                    enrollments.map((item) => (
                                        <div key={item.id} className="bg-white p-3 lg:p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-brand-200 transition-all">
                                            <div className="flex items-center gap-3 lg:gap-4">
                                                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-bold text-xs lg:text-sm uppercase ring-2 ring-white shadow-sm">
                                                    {item.student?.name?.substring(0, 2) || 'AL'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors">{item.student?.name}</p>
                                                    <p className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full inline-block mt-1">Mat: {item.enrollment_id.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                            <button className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100" title="Remover aluno">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {
                        activeTab === 'teachers' && (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-gray-800">Corpo Docente</h3>
                                    {(user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                                        <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={() => setIsAddTeacherOpen(true)}>
                                            <UserPlus className="w-4 h-4 mr-2" />
                                            Adicionar Professor
                                        </Button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {teachers.map((t) => (
                                        <div
                                            key={t.id}
                                            className={`
                                                relative group bg-white rounded-3xl border border-slate-200 p-6 
                                                hover:shadow-2xl hover:shadow-brand-100 hover:border-brand-200 
                                                transition-all duration-300 flex flex-col items-center text-center
                                                ${t.status === 'INACTIVE' ? 'opacity-60 grayscale bg-slate-50' : ''}
                                            `}
                                        >
                                            {/* Top Badges */}
                                            <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                                                {t.is_primary ? (
                                                    <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-indigo-200 flex items-center gap-1.5">
                                                        <Star className="w-3 h-3 fill-current" />
                                                        Regente
                                                    </span>
                                                ) : (
                                                    (user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                                                        <button
                                                            onClick={() => handleSetPrimaryTeacher(t.teacher_id)}
                                                            className="px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-brand-50 hover:text-brand-600 transition-all flex items-center gap-1.5"
                                                            title="Definir como Regente"
                                                        >
                                                            <Star className="w-3 h-3" />
                                                            Tornar Regente
                                                        </button>
                                                    )
                                                )}
                                                {t.status === 'INACTIVE' && (
                                                    <span className="px-3 py-1 bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                                                        Inativo
                                                    </span>
                                                )}
                                            </div>

                                            {/* Photo / Avatar */}
                                            <div className="relative mb-4">
                                                <div className="w-24 h-24 rounded-3xl overflow-hidden ring-4 ring-slate-50 group-hover:ring-brand-50 transition-all duration-300 shadow-xl">
                                                    {t.teacher?.avatar_url ? (
                                                        <img
                                                            src={t.teacher.avatar_url}
                                                            alt={t.teacher.name}
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 group-hover:from-brand-50 group-hover:to-brand-100 transition-colors">
                                                            <GraduationCap className="w-10 h-10 group-hover:scale-110 transition-transform duration-500" />
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Subject badge floating on avatar */}
                                                {t.subject && (
                                                    <div className="absolute -bottom-2 -right-2 px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-md text-[10px] font-bold text-slate-600">
                                                        {t.subject}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="space-y-1 mb-6 flex-1">
                                                <h4 className="text-lg font-black text-slate-900 group-hover:text-brand-600 transition-colors leading-tight">
                                                    {t.teacher?.name}
                                                </h4>
                                                <p className="text-xs font-medium text-slate-400 truncate max-w-[200px]">
                                                    {t.teacher?.email}
                                                </p>
                                            </div>

                                            {/* Actions Container */}
                                            <div className="w-full pt-4 border-t border-slate-50 flex items-center justify-center gap-2">
                                                {(user?.role === 'ADMIN' || user?.role === 'SECRETARY') && (
                                                    <>
                                                        <button
                                                            onClick={() => handleToggleTeacherStatus(t.teacher_id, t.status)}
                                                            className={`
                                                                flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all
                                                                ${t.status === 'INACTIVE'
                                                                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                                    : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}
                                                            `}
                                                            title={t.status === 'INACTIVE' ? 'Ativar na turma' : 'Desativar na turma'}
                                                        >
                                                            {t.status === 'INACTIVE' ? <Check className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                                                            {t.status === 'INACTIVE' ? 'Ativar' : 'Afastar'}
                                                        </button>

                                                        <button
                                                            onClick={() => handleRemoveTeacher(t.teacher_id)}
                                                            className="w-12 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                                                            title="Remover da turma"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {teachers.length === 0 && (
                                        <div className="col-span-full py-16 text-center">
                                            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                                <GraduationCap className="w-10 h-10 text-slate-300" />
                                            </div>
                                            <h3 className="text-slate-900 font-black mb-1">Nenhum professor atribuído</h3>
                                            <p className="text-slate-400 text-sm font-medium">Use o botão acima para vincular professores a esta turma.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }

                    {
                        activeTab === 'attendance' && id && (
                            <ClassAttendance classId={id} date={selectedDate} />
                        )
                    }

                    {
                        activeTab === 'diary' && id && (
                            <ClassDailyAgenda classId={id} date={selectedDate} />
                        )
                    }

                    {
                        activeTab === 'grades' && id && (
                            <ClassGrades classId={id} />
                        )
                    }

                    {activeTab === 'planning' && id && (
                        <div className="bg-white rounded-[2.5rem] border border-gray-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                            <div className="p-4 lg:p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 lg:gap-6 bg-slate-50/30">
                                <div>
                                    <h3 className="text-lg lg:text-xl font-black text-slate-900 flex items-center gap-2 lg:gap-3">
                                        <div className="p-1.5 lg:p-2 bg-brand-50 rounded-lg lg:rounded-xl">
                                            <Layout className="w-4 h-4 lg:w-5 lg:h-5 text-brand-600" />
                                        </div>
                                        Plano de Atividades
                                    </h3>
                                    <p className="text-[11px] lg:text-sm font-bold text-slate-400 mt-0.5 lg:mt-1">Gerencie lições, materiais e objetivos pedagógicos.</p>
                                </div>

                                <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex gap-1">
                                    <button
                                        onClick={() => setPlanningViewMode('week')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${planningViewMode === 'week' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <Layout className="w-4 h-4" /> Semana
                                    </button>
                                    <button
                                        onClick={() => setPlanningViewMode('month')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${planningViewMode === 'month' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        <Calendar className="w-4 h-4" /> Mês
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 md:p-8">
                                {planningViewMode === 'week' ? (
                                    <PlanningKanban classId={id} date={new Date(selectedDate + 'T12:00:00')} events={events} />
                                ) : (
                                    <PlanningCalendar classId={id} date={new Date(selectedDate + 'T12:00:00')} events={events} />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div >

            {/* =================================================================================
                MOBILE VIEW
               ================================================================================= */}
            <div className="md:hidden min-h-screen bg-slate-50">
                {/* --- MOBILE DATE SELECTOR --- */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data de Trabalho</span>
                            <CustomDatePicker
                                value={selectedDate}
                                onChange={setSelectedDate}
                                className="!bg-transparent !p-0 !shadow-none !border-none"
                            />
                        </div>
                    </div>
                </div>

                {/* --- MOBILE TABS (Sticky below layout header) --- */}
                <div className="bg-white border-b border-slate-200 sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 shadow-sm mt-1">
                    <div className="flex px-4 gap-6 overflow-x-auto no-scrollbar border-b border-gray-100">
                        {[
                            { id: 'attendance', label: 'Chamada' },
                            { id: 'diary', label: 'Agenda' },
                            { id: 'grades', label: 'Notas' },
                            { id: 'planning', label: 'Atividades' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setMobileActiveTab(tab.id as any)}
                                className={`pb-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap px-1 
                                    ${mobileActiveTab === tab.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}
                                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* --- 3. MAIN CONTENT --- */}
                <div className="animate-fade-in-up pt-6 pb-32">
                    {mobileActiveTab === 'diary' && id && (
                        <div className="p-4 pt-0">
                            <ClassDailyAgenda classId={id} date={selectedDate} />
                        </div>
                    )}

                    {mobileActiveTab === 'attendance' && id && (
                        <div className="p-4 pt-0">
                            <ClassAttendance classId={id} date={selectedDate} />
                        </div>
                    )}

                    {mobileActiveTab === 'grades' && id && (
                        <div className="p-4 pt-0">
                            <ClassGrades classId={id} />
                        </div>
                    )}

                    {mobileActiveTab === 'planning' && id && (
                        <div className="p-4 pt-0">
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <BookOpen className="w-5 h-5 text-brand-600" />
                                        Plano de Atividades
                                    </h3>
                                    <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
                                        <button
                                            onClick={() => setPlanningViewMode('week')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${planningViewMode === 'week' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Semana
                                        </button>
                                        <button
                                            onClick={() => setPlanningViewMode('month')}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${planningViewMode === 'month' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Mês
                                        </button>
                                    </div>
                                </div>
                                {planningViewMode === 'week' ? (
                                    <PlanningKanban classId={id} date={new Date(selectedDate + 'T12:00:00')} events={events} />
                                ) : (
                                    <PlanningCalendar classId={id} date={new Date(selectedDate + 'T12:00:00')} events={events} />
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {
                isAddStudentOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in max-h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Adicionar Aluno</h2>
                                <button onClick={() => setIsAddStudentOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <Input
                                placeholder="Buscar aluno por nome..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                icon={<Search className="w-4 h-4 text-gray-400" />}
                                className="bg-gray-50 border-gray-200"
                            />
                            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {availableStudents
                                    .filter(s => (s.candidate_name || '').toLowerCase().includes(studentSearch.toLowerCase()) || (s.student?.name || '').toLowerCase().includes(studentSearch.toLowerCase()))
                                    .map(s => (
                                        <div key={s.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all">
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">{s.student?.name || s.candidate_name}</p>
                                                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Matrícula Aprovada
                                                </p>
                                            </div>
                                            <Button size="sm" className="bg-gray-900 text-white hover:bg-brand-600" onClick={() => handleAddStudent(s.id, s.student_id)}>
                                                <Plus className="w-3 h-3 mr-1" /> Adicionar
                                            </Button>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isAddTeacherOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in max-h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Adicionar Professor</h2>
                                <button onClick={() => setIsAddTeacherOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <Input
                                placeholder="Buscar professor por nome..."
                                value={teacherSearch}
                                onChange={(e) => setTeacherSearch(e.target.value)}
                                icon={<Search className="w-4 h-4 text-gray-400" />}
                                className="bg-gray-50 border-gray-200"
                            />
                            <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {availableTeachers
                                    .filter(t => (t.name || '').toLowerCase().includes(teacherSearch.toLowerCase()))
                                    .map(t => (
                                        <div key={t.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl hover:border-brand-200 hover:shadow-sm transition-all">
                                            <div>
                                                <p className="font-bold text-sm text-gray-900">{t.name}</p>
                                                <p className="text-xs text-gray-500">{t.email}</p>
                                            </div>
                                            <Button size="sm" className="bg-gray-900 text-white hover:bg-brand-600" onClick={() => handleAddTeacher(t.id)}>
                                                <Plus className="w-3 h-3 mr-1" /> Adicionar
                                            </Button>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                )
            }

            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Editar Turma"
            >
                <div className="space-y-4">
                    <div>
                        <Input
                            label="Nome da Turma"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Input
                                type="number"
                                label="Ano Letivo"
                                value={editForm.school_year || ''}
                                onChange={(e) => setEditForm({ ...editForm, school_year: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                            <select
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                value={editForm.shift || 'morning'}
                                onChange={(e) => setEditForm({ ...editForm, shift: e.target.value as any })}
                            >
                                <option value="morning">Manhã</option>
                                <option value="afternoon">Tarde</option>
                                <option value="full">Integral</option>
                                <option value="night">Noite</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <Input
                            type="number"
                            label="Capacidade"
                            value={editForm.capacity || ''}
                            onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
                        />
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rotina Padrão (Timeline)</label>
                        <select
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            value={editForm.daily_timeline_id || ''}
                            onChange={(e) => setEditForm({ ...editForm, daily_timeline_id: e.target.value || null })}
                        >
                            <option value="">Nenhuma (Padrão)</option>
                            {timelines.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateClass}>Salvar Alterações</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
