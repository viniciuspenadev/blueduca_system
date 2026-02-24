import React, { useState, useEffect } from 'react';
import { X, Mail, MessageCircle, AlertTriangle, ShieldCheck, HeartPulse, GraduationCap, CheckCircle, Calendar, Clock, Loader2, LineChart, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../services/supabase';
import { format, startOfDay, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClassStudentDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    studentInfo: any; // Using the 'item' passed from enrollments map (contains inner student data)
    classId: string;
    schoolYear: number;
}

export const ClassStudentDetailsDrawer: React.FC<ClassStudentDetailsDrawerProps> = ({
    isOpen,
    onClose,
    studentInfo,
    classId,
    schoolYear
}) => {
    const [activeTab, setActiveTab] = useState<'perfil' | 'diario' | 'ocorrencias' | 'chamadas' | 'notas'>('perfil');

    // Data States
    const [diaries, setDiaries] = useState<any[]>([]);
    const [occurrences, setOccurrences] = useState<any[]>([]);
    const [attendances, setAttendances] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isLoadingDiaries, setIsLoadingDiaries] = useState(false);
    const [selectedDiary, setSelectedDiary] = useState<any | null>(null);
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

    // KPI States
    const [attendanceRate, setAttendanceRate] = useState<number | null>(null);
    const [familyEngagement, setFamilyEngagement] = useState<{ label: string, color: string }>({ label: 'Calculando...', color: 'text-slate-400' });

    useEffect(() => {
        if (isOpen && studentInfo?.id) {
            setActiveTab('perfil');
            setCurrentMonth(startOfMonth(new Date())); // Reset to current month on open
            fetchStudentClassData();
        }
    }, [isOpen, studentInfo?.id]);

    // Fetch diaries when month changes
    useEffect(() => {
        if (isOpen && studentInfo?.id && activeTab === 'diario') {
            fetchDiariesForMonth(currentMonth);
        }
    }, [currentMonth, isOpen, studentInfo?.id, activeTab]);

    const fetchDiariesForMonth = async (month: Date) => {
        if (!studentInfo?.id) return;
        setIsLoadingDiaries(true);
        try {
            const studentId = studentInfo.student.id;

            // Get full grid range to include padding days
            const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
            const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });

            const { data: diariesData } = await supabase
                .from('daily_reports')
                .select('*')
                .eq('student_id', studentId)
                .gte('date', format(gridStart, 'yyyy-MM-dd'))
                .lte('date', format(gridEnd, 'yyyy-MM-dd'))
                .order('date', { ascending: false });

            const fetchedDiaries = diariesData || [];
            setDiaries(fetchedDiaries);

            // Auto-select the most recent diary of the CURRENT month 
            // (ignoring padding days from previous/next months for the auto-select)
            const currentMonthDiaries = fetchedDiaries.filter(d => {
                const parts = d.date.split('-');
                if (parts.length === 3) {
                    return parseInt(parts[1]) - 1 === month.getMonth();
                }
                return false;
            });

            if (currentMonthDiaries.length > 0) {
                setSelectedDiary(currentMonthDiaries[0]);
            } else {
                setSelectedDiary(null);
            }

            // Calculate Family Engagement for this month
            if (fetchedDiaries.length === 0) {
                setFamilyEngagement({ label: 'S/ Dados', color: 'text-slate-400' });
            } else {
                const readCount = fetchedDiaries.filter(d => {
                    let arr = d.read_by_parents;
                    if (typeof arr === 'string') {
                        try { arr = JSON.parse(arr); } catch (e) { arr = []; }
                    }
                    return Array.isArray(arr) && arr.length > 0;
                }).length;
                const readingRate = readCount / fetchedDiaries.length;
                if (readingRate >= 0.75) {
                    setFamilyEngagement({ label: 'Alto', color: 'text-brand-500' });
                } else if (readingRate >= 0.4) {
                    setFamilyEngagement({ label: 'Médio', color: 'text-amber-500' });
                } else {
                    setFamilyEngagement({ label: 'Baixo', color: 'text-red-500' });
                }
            }
        } catch (error) {
            console.error('Error fetching diaries for month:', error);
        } finally {
            setIsLoadingDiaries(false);
        }
    };

    const fetchStudentClassData = async () => {
        if (!studentInfo?.id || !classId) return;
        setIsLoadingData(true);
        try {
            const studentId = studentInfo.student.id;

            // Note: Diaries and Family Engagement are now fetched inside fetchDiariesForMonth
            // triggered by the useEffect observing `activeTab` and `currentMonth`.
            if (activeTab === 'perfil' && diaries.length === 0) {
                // Initial background fetch to populate Family Engagement on the profile tab
                fetchDiariesForMonth(currentMonth);
            }

            // Fetch Real Attendance Rate
            const { data: attDashData } = await supabase
                .from('attendance_dashboard_view')
                .select('attendance_rate')
                .eq('student_id', studentId)
                .eq('school_year', schoolYear)
                .maybeSingle();

            setAttendanceRate(attDashData?.attendance_rate ?? null);

            // Fetch occurrences (table likely doesn't exist yet, commenting out to avoid 404)
            /*
            const { data: occurrencesData, error: occError } = await supabase
                .from('student_behavior_records') 
                .select('*')
                .eq('student_id', studentId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (!occError) {
                 setOccurrences(occurrencesData || []);
            }
            */
            setOccurrences([]);

            // Fetch Attendance (using correct tables: student_attendance joined with class_attendance_sheets)
            const { data: attendanceData, error: attError } = await supabase
                .from('student_attendance')
                .select('id, status, notes, sheet:class_attendance_sheets!inner(date, class_id)')
                .eq('student_id', studentId)
                .eq('sheet.class_id', classId)
                .order('sheet(date)', { ascending: false })
                .limit(10);

            if (attError) console.error('Error fetching attendance:', attError);

            // Map the nested sheet date to the top level for the UI
            const formattedAttendance = (attendanceData || []).map((att: any) => ({
                id: att.id,
                status: att.status,
                justification: att.notes,
                date: att.sheet?.date
            }));

            setAttendances(formattedAttendance);

        } catch (error) {
            console.error('Error fetching student class data:', error);
        } finally {
            setIsLoadingData(false);
        }
    };


    if (!isOpen || !studentInfo) return null;

    const student = studentInfo.student;
    const enrollmentId = studentInfo.enrollment_id;

    // Helper functions for quick actions
    const openWhatsApp = (phone?: string) => {
        if (phone) {
            const cleaned = phone.replace(/\D/g, '');
            window.open(`https://wa.me/55${cleaned}`, '_blank');
        }
    };

    const openEmail = (email?: string) => {
        if (email) {
            window.location.href = `mailto:${email}`;
        }
    };

    // Derived Data
    const healthInfo = student?.health_info || {};
    const allergies = healthInfo?.allergies || [];
    const authorizedPickups = healthInfo?.authorized_pickups || [];

    // Convert allergies to a display string or component array
    const renderAllergies = () => {
        if (!allergies || (Array.isArray(allergies) && allergies.length === 0)) return null;

        let displayArr = [];
        if (Array.isArray(allergies)) {
            displayArr = allergies.map((item: any) => typeof item === 'object' ? item.allergy || item.name : item);
        } else {
            displayArr = [allergies];
        }

        if (displayArr.length === 0) return null;

        return (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="text-sm font-bold text-red-800">Alertas Médicos Críticos</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {displayArr.map((al: string, i: number) => (
                            <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-100/80 text-red-800 text-xs font-bold border border-red-200 shadow-sm">
                                {al}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div className="relative w-full md:w-[600px] max-w-full h-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300 animate-slide-in-right">

                {/* 1. HEADER FIXED TOP */}
                <div className="flex-none p-6 border-b border-slate-100 bg-white">
                    {/* Top Row: Close BTN & Badges */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                <CheckCircle className="w-3.5 h-3.5" /> Ativo
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-500 uppercase tracking-wider">
                                #{enrollmentId.substring(0, 6)}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Main Profile Info */}
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-2xl uppercase overflow-hidden border-2 border-brand-200 flex-shrink-0 shadow-sm">
                            {student?.photo_url ? (
                                <img src={student.photo_url} className="w-full h-full object-cover" alt={student?.name} />
                            ) : (
                                student?.name?.substring(0, 2) || 'AL'
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl font-black text-slate-900 truncate leading-tight mb-2">
                                {student?.name}
                            </h2>
                            {/* Quick Actions Row */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openWhatsApp(student?.financial_responsible?.phone)}
                                    disabled={!student?.financial_responsible?.phone}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    WhatsApp
                                </button>
                                <button
                                    onClick={() => openEmail(student?.financial_responsible?.email)}
                                    disabled={!student?.financial_responsible?.email}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Mail className="w-3.5 h-3.5" />
                                    Email
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. TABS SCROLLABLE */}
                <div className="flex-none bg-slate-50/50 border-b border-slate-100">
                    <div className="flex overflow-x-auto p-2 gap-1 custom-scrollbar">
                        {[
                            { id: 'perfil', label: 'Visão Geral' },
                            { id: 'diario', label: 'Diário & Rotina' },
                            { id: 'ocorrencias', label: 'Ocorrências' },
                            { id: 'chamadas', label: 'Frequência' },
                            { id: 'notas', label: 'Desempenho' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`
                                    flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all
                                    ${activeTab === tab.id
                                        ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}
                                `}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. SCROLLABLE CONTENT BODY */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
                    {/* --- TAB: PERFIL --- */}
                    {activeTab === 'perfil' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Critical Health Alerts */}
                            {renderAllergies()}

                            {/* KPIs Section */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                                    <HeartPulse className={`w-6 h-6 mb-2 ${familyEngagement.color}`} />
                                    <p className={`text-2xl font-black ${familyEngagement.color}`}>{familyEngagement.label}</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Engajamento Familia</p>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                                    <GraduationCap className={`w-6 h-6 mb-2 ${attendanceRate !== null && attendanceRate < 75 ? 'text-red-500' : 'text-emerald-500'}`} />
                                    <p className="text-2xl font-black text-slate-800">
                                        {attendanceRate !== null ? `${attendanceRate}%` : '--%'}
                                    </p>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Frequência Atual</p>
                                </div>
                            </div>

                            {/* Pickups */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-brand-500" />
                                    Autorizados a Buscar
                                </h3>
                                {authorizedPickups.length > 0 ? (
                                    <div className="space-y-3">
                                        {authorizedPickups.map((person: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 flex-shrink-0">
                                                    <span className="font-bold text-sm uppercase">{person.name?.substring(0, 2) || 'P'}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-900 truncate">{person.name}</p>
                                                    <p className="text-xs text-slate-500">{person.phone} {person.kinship ? `• ${person.kinship}` : ''}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500 italic">Nenhum responsável extra cadastrado na ficha do aluno.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- TAB: DIÁRIO --- */}
                    {activeTab === 'diario' && (
                        <div className="space-y-6 animate-fade-in relative">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-brand-500" />
                                    Heatmap Mensal de Rotina
                                </h3>

                                {/* Month Selector */}
                                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                                    <button
                                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                        className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-600"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <span className="text-sm font-bold text-slate-700 w-[120px] text-center capitalize">
                                        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                                    </span>
                                    <button
                                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                        className="p-1 hover:bg-slate-100 rounded-md transition-colors text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                                        disabled={currentMonth >= startOfMonth(new Date())} // Block future months
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {isLoadingData || isLoadingDiaries ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
                                    <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-4" />
                                    <p className="text-sm font-bold text-slate-500">Buscando diários de {format(currentMonth, 'MMMM', { locale: ptBR })}...</p>
                                </div>
                            ) : diaries.length > 0 ? (
                                <div className="space-y-6">
                                    {/* Heatmap Grid */}
                                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm max-w-[320px] mx-auto md:mx-0">
                                        <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
                                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                                                <div key={i} className="text-center text-[10px] md:text-xs font-bold text-slate-400">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 md:gap-2">
                                            {(() => {
                                                // 1. Generate a perfect calendar grid for the Selected Month
                                                const today = startOfDay(new Date());
                                                const monthStart = startOfMonth(currentMonth);
                                                const monthEnd = endOfMonth(currentMonth);
                                                const start = startOfWeek(monthStart, { weekStartsOn: 0 });
                                                const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
                                                const daysArray = eachDayOfInterval({ start, end });

                                                // 2. Create a map of diaries by date string (YYYY-MM-DD) for O(1) lookup
                                                const diariesByDate = diaries.reduce((acc: Record<string, any>, d: any) => {
                                                    const parts = d.date ? d.date.split('-') : [];
                                                    if (parts.length === 3) {
                                                        const key = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                                                        acc[key] = d;
                                                    }
                                                    return acc;
                                                }, {});

                                                // 3. Render the blocks
                                                return daysArray.map((dateObj) => {
                                                    const dateKey = format(dateObj, 'yyyy-MM-dd');
                                                    const diary = diariesByDate[dateKey];
                                                    const dateLabel = format(dateObj, "dd/MM", { locale: ptBR });
                                                    const weekDay = format(dateObj, 'EEEE', { locale: ptBR });

                                                    const isFuture = dateObj > today;
                                                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                                    const isCurrentMonth = dateObj.getMonth() === currentMonth.getMonth();

                                                    let bgColor = 'bg-slate-100 hover:bg-slate-200 border border-slate-200 opacity-80'; // Default Past Empty

                                                    if (!isCurrentMonth) {
                                                        bgColor = 'bg-transparent opacity-0 pointer-events-none'; // Hide padding days completely
                                                    } else if (isFuture) {
                                                        bgColor = 'bg-transparent border border-dashed border-slate-200 opacity-40 hover:bg-slate-50';
                                                    } else if (diary) {
                                                        const data = diary.routine_data || {};
                                                        const mood = data.mood || '';
                                                        const lunch = data.meals?.lunch || '';

                                                        if (mood.toLowerCase() === 'agitado' || mood.toLowerCase() === 'choroso' || lunch.toLowerCase() === 'recusou' || diary.ate_all === false) {
                                                            bgColor = 'bg-red-400 hover:bg-red-500 border border-red-500 opacity-100';
                                                        } else if (mood.toLowerCase() === 'triste' || lunch.toLowerCase() === 'pouco' || diary.slept_well === false) {
                                                            bgColor = 'bg-amber-400 hover:bg-amber-500 border border-amber-500 opacity-100';
                                                        } else {
                                                            // Perfect Day
                                                            bgColor = 'bg-emerald-400 hover:bg-emerald-500 border border-emerald-500 opacity-100';
                                                        }
                                                    } else if (isWeekend) {
                                                        bgColor = 'bg-slate-100 border border-transparent opacity-40'; // Soft for weekends without diaries
                                                    }

                                                    return (
                                                        <button
                                                            key={dateKey}
                                                            onClick={() => {
                                                                if (diary) setSelectedDiary(diary);
                                                            }}
                                                            disabled={!diary && (isFuture || !isCurrentMonth)}
                                                            title={!isCurrentMonth ? undefined : `${weekDay}, ${dateLabel}${diary ? '' : ' (Sem Registo)'}`}
                                                            className={`aspect-square rounded-md sm:rounded-lg transition-all ${bgColor} ${selectedDiary?.id === diary?.id ? 'ring-2 ring-brand-600 ring-offset-2 scale-110 shadow-md z-10' : diary ? 'hover:scale-105 cursor-pointer' : 'cursor-default'} flex items-center justify-center relative`}
                                                        >
                                                            {/* Optional: Add a tiny dot if it has observations */}
                                                            {diary?.observations && isCurrentMonth && <div className="absolute w-1 h-1 bg-white rounded-full opacity-70"></div>}

                                                            {/* Day number watermark */}
                                                            {!diary && isCurrentMonth && <span className="text-[9px] font-bold text-slate-400 pointer-events-none">{dateObj.getDate()}</span>}
                                                            {diary && isCurrentMonth && <span className="text-[9px] font-bold text-white/50 pointer-events-none">{dateObj.getDate()}</span>}
                                                        </button>
                                                    );
                                                });
                                            })()}
                                        </div>
                                        <div className="mt-4 flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wide">
                                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-400"></div> Dia Bom</div>
                                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-400"></div> Ressalvas</div>
                                            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-400"></div> Atenção</div>
                                        </div>
                                    </div>

                                    {/* Selected Details Panel */}
                                    {selectedDiary && (() => {
                                        const dateParts = selectedDiary.date ? selectedDiary.date.split('-') : [];
                                        const selDate = dateParts.length === 3 ? new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 12, 0, 0)) : new Date(selectedDiary.date);

                                        return (
                                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-base">
                                                            Diário de {format(selDate, "dd 'de' MMMM", { locale: ptBR })}
                                                        </h4>
                                                        <span className="text-xs font-bold uppercase text-slate-400">{format(selDate, 'EEEE', { locale: ptBR })}</span>
                                                    </div>

                                                    {/* Read Status Badge */}
                                                    {(() => {
                                                        let readArray = selectedDiary.read_by_parents;
                                                        if (typeof readArray === 'string') {
                                                            try { readArray = JSON.parse(readArray); } catch (e) { readArray = []; }
                                                        }
                                                        const isRead = Array.isArray(readArray) && readArray.length > 0;

                                                        return isRead ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider shadow-sm border border-emerald-200">
                                                                <CheckCircle className="w-4 h-4" /> Visualizado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider shadow-sm border border-slate-200">
                                                                <Clock className="w-4 h-4" /> Aguardando Leitura
                                                            </span>
                                                        );
                                                    })()}
                                                </div>

                                                <p className="text-sm text-slate-700 mb-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm leading-relaxed">
                                                    {selectedDiary.observations || <span className="italic text-slate-400">Nenhuma observação geral registrada para este dia.</span>}
                                                </p>

                                                {/* Routine Data tags */}
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedDiary.routine_data?.mood && <span className="text-xs px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg font-bold border border-brand-100">Humor: {selectedDiary.routine_data.mood}</span>}
                                                    {selectedDiary.routine_data?.meals?.lunch && <span className="text-xs px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg font-bold border border-brand-100">Almoço: {selectedDiary.routine_data.meals.lunch}</span>}
                                                    {selectedDiary.routine_data?.sleep?.nap && <span className="text-xs px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg font-bold border border-brand-100">Sono: {selectedDiary.routine_data.sleep.nap}</span>}
                                                    {selectedDiary.routine_data?.hygiene?.diapers && <span className="text-xs px-3 py-1.5 bg-brand-50 text-brand-700 rounded-lg font-bold border border-brand-100">Fraldas: {selectedDiary.routine_data.hygiene.diapers} trocas</span>}

                                                    {/* Legacy flags fallback */}
                                                    {selectedDiary.ate_all !== undefined && <span className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-bold">Comeu Bem: {selectedDiary.ate_all ? 'Sim' : 'Não'}</span>}
                                                    {selectedDiary.slept_well !== undefined && <span className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-bold">Dormiu Bem: {selectedDiary.slept_well ? 'Sim' : 'Não'}</span>}
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-center bg-white p-8 rounded-xl border border-dashed border-slate-300">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Calendar className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h4 className="font-bold text-slate-800 text-lg mb-2">Nenhum Diário em {format(currentMonth, 'MMMM', { locale: ptBR })}</h4>
                                    <p className="text-slate-500 text-sm max-w-sm">
                                        Não existem relatórios diários registrados para este aluno no mês selecionado. Retorne para meses anteriores utilizando as setas de navegação.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- TAB: OCORRENCIAS --- */}
                    {activeTab === 'ocorrencias' && (
                        <div className="space-y-6 animate-fade-in relative">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-brand-500" />
                                    Registro de Ocorrências
                                </h3>
                                {/* Assuming user is a teacher/admin, provide a quick way to add one */}
                                <button className="px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors">
                                    + Nova Ocorrência
                                </button>
                            </div>

                            {isLoadingData ? (
                                <div className="flex flex-col items-center justify-center py-10">
                                    <Loader2 className="w-6 h-6 text-brand-500 animate-spin mb-2" />
                                    <p className="text-sm text-slate-500">Carregando histórico...</p>
                                </div>
                            ) : occurrences.length > 0 ? (
                                <div className="space-y-4">
                                    {occurrences.map((occ: any, _idx: number) => {
                                        const occDate = occ.created_at ? format(new Date(occ.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Data desconhecida';

                                        return (
                                            <div key={occ.id || _idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-wider">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> Advertência
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-mono">{occDate}</span>
                                                </div>
                                                <p className="text-sm text-slate-700 font-medium mb-3">
                                                    {occ.description || occ.title || "Detalhes da ocorrência não fornecidos."}
                                                </p>
                                                {occ.teacher_name && (
                                                    <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg inline-block">
                                                        Registrado por: <span className="font-bold text-slate-700">{occ.teacher_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-emerald-50 rounded-xl border border-emerald-100 border-dashed">
                                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                                    <p className="text-sm font-bold text-emerald-800">Ficha Disciplinar Limpa</p>
                                    <p className="text-xs text-emerald-600 mt-1">Nenhuma ocorrência registrada para este aluno.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- TAB: CHAMADAS --- */}
                    {activeTab === 'chamadas' && (
                        <div className="space-y-6 animate-fade-in relative">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-brand-500" />
                                    Últimos Registros de Frequência
                                </h3>
                                {/* Assuming user is a teacher/admin, provide a quick way to justify */}
                                <button className="px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors">
                                    Justificar Falta
                                </button>
                            </div>

                            {isLoadingData ? (
                                <div className="flex flex-col items-center justify-center py-10">
                                    <Loader2 className="w-6 h-6 text-brand-500 animate-spin mb-2" />
                                    <p className="text-sm text-slate-500">Carregando mapa de faltas...</p>
                                </div>
                            ) : attendances.length > 0 ? (
                                <div className="space-y-3">
                                    {attendances.filter(a => a.status !== 'present').length > 0 ? (
                                        attendances.filter(a => a.status !== 'present').map((att: any, _idx: number) => {
                                            const attDate = att.date ? format(new Date(att.date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }) : 'Data desconhecida';
                                            const isJustified = att.status === 'justified';
                                            return (
                                                <div key={att.id || _idx} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isJustified ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                                                            {isJustified ? <AlertTriangle className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{isJustified ? 'Falta Justificada' : 'Falta Registrada'}</div>
                                                            <div className="text-xs text-slate-500">{attDate}</div>
                                                        </div>
                                                    </div>
                                                    {att.justification && (
                                                        <span className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg max-w-[200px] truncate" title={att.justification}>
                                                            Motivo: {att.justification}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <div className="text-center py-10 bg-emerald-50 rounded-xl border border-emerald-100 border-dashed">
                                            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                                            <p className="text-sm font-bold text-emerald-800">100% de Presença Recente</p>
                                            <p className="text-xs text-emerald-600 mt-1">O aluno não possui faltas nas últimas aulas registradas.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                    <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                    <p className="text-sm text-slate-500">Nenhum registro de chamada recente nesta turma.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- TAB: NOTAS --- */}
                    {activeTab === 'notas' && (
                        <div className="space-y-6 animate-fade-in relative">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <LineChart className="w-5 h-5 text-brand-500" />
                                    Desempenho Acadêmico
                                </h3>
                                <button className="px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors">
                                    Lançar Nota
                                </button>
                            </div>

                            <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-700">Módulo de Avaliações em Integração</p>
                                <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
                                    Em breve, os gráficos de desempenho e o boletim detalhado da turma estarão disponíveis diretamente neste painel.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
