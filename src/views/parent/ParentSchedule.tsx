import { type FC, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../../services/supabase';
import { useStudent } from '../../contexts/StudentContext';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import type { LessonPlan } from '../../types';
import { planningService } from '../../services/planningService';
import { useSystem } from '../../contexts/SystemContext';
import { LessonPlanDrawer } from '../../components/parent/LessonPlanDrawer';
import type { DailyTimelineItem } from '../../types/timeline';

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export const ParentSchedule: FC = () => {
    const { selectedStudent } = useStudent();
    const { currentYear } = useSystem();
    const [loading, setLoading] = useState(true);
    const [plans, setPlans] = useState<LessonPlan[]>([]);
    const [className, setClassName] = useState('');
    const [currentDate, setCurrentDate] = useState(() => {
        const date = new Date();
        const day = date.getDay();
        if (day === 6) date.setDate(date.getDate() + 2);
        if (day === 0) date.setDate(date.getDate() + 1);
        return date;
    });

    const [selectedPlan, setSelectedPlan] = useState<DailyTimelineItem | null>(null);

    useEffect(() => {
        if (!selectedStudent || !currentYear) return;
        fetchSchedule();
    }, [selectedStudent, currentYear, currentDate]);

    const fetchSchedule = async () => {
        setLoading(true);
        try {
            const targetYear = selectedStudent?.academic_year || new Date().getFullYear();

            const { data: enrollment } = await supabase
                .from('class_enrollments')
                .select('class_id, class:classes!inner(name, school_year)')
                .eq('student_id', selectedStudent?.id)
                .eq('class.status', 'active')
                .eq('class.school_year', targetYear)
                .limit(1)
                .maybeSingle();

            if (!enrollment) {
                setLoading(false);
                return;
            }

            setClassName((enrollment.class as any)?.name || '');

            const baseDate = new Date(currentDate);
            const day = baseDate.getDay() || 7;
            const start = new Date(baseDate);
            if (day !== 1) start.setHours(-24 * (day - 1));

            const end = new Date(start);
            end.setDate(end.getDate() + 4);

            const startStr = format(start, 'yyyy-MM-dd');
            const endStr = format(end, 'yyyy-MM-dd');

            const data = await planningService.getLessonPlans(enrollment.class_id, startStr, endStr);
            setPlans(data);

        } catch (error) {
            console.error('Error fetching schedule:', error);
        } finally {
            setLoading(false);
        }
    };

    const getPlansForDay = (dayIndex: number) => {
        const baseDate = new Date(currentDate);
        const currentDay = baseDate.getDay() || 7;
        const targetDate = new Date(baseDate);
        targetDate.setDate(baseDate.getDate() - (currentDay - dayIndex));

        const dateStr = format(targetDate, 'yyyy-MM-dd');
        return plans.filter(p => p.date === dateStr);
    };

    const handlePlanClick = (plan: LessonPlan) => {
        // Map LessonPlan to DailyTimelineItem
        setSelectedPlan({
            id: plan.id,
            timeline_id: 'schedule',
            title: plan.subject?.name || 'Aula',
            description: (plan as any).notes || '', // Fallback to notes
            start_time: plan.start_time.slice(0, 5),
            end_time: plan.end_time.slice(0, 5),
            order_index: 0,
            type: 'academic',
            topic: plan.topic,
            objective: (plan as any).objective, // Map objective
            materials: (plan as any).materials, // Map materials
            homework: plan.homework,
            teacher_name: (plan as any).teacher?.name, // Map teacher name
            attachments: [],
        });
    };

    const displayDays = [1, 2, 3, 4, 5];

    return (
        <div className="space-y-6 pb-24">
            {/* Header Area */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-100 rounded-xl text-brand-600">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Cronograma Escolar</h2>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                        <button
                            onClick={() => {
                                const newDate = new Date(currentDate);
                                newDate.setDate(newDate.getDate() - 7);
                                setCurrentDate(newDate);
                            }}
                            className="p-1 hover:bg-white hover:shadow-sm rounded text-gray-500 transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => {
                                const newDate = new Date(currentDate);
                                newDate.setDate(newDate.getDate() + 7);
                                setCurrentDate(newDate);
                            }}
                            className="p-1 hover:bg-white hover:shadow-sm rounded text-gray-500 transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        {(() => {
                            const start = new Date(currentDate);
                            const day = start.getDay() || 7;
                            if (day !== 1) start.setHours(-24 * (day - 1));
                            const end = new Date(start);
                            end.setDate(end.getDate() + 4);
                            return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
                        })()}
                    </span>
                    {className && (
                        <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg border border-brand-100 uppercase tracking-wider">
                            {className}
                        </span>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Carregando cronograma...</p>
                </div>
            ) : !className ? (
                <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Sem turma associada</h2>
                    <p className="text-gray-500">O aluno ainda não foi enturmado.</p>
                </div>
            ) : (
                <div className="px-1 space-y-6">
                    {displayDays.map(dayIndex => {
                        const dayPlans = getPlansForDay(dayIndex);
                        const isToday = new Date().getDay() === dayIndex;

                        return (
                            <div key={dayIndex} className={`rounded-2xl border overflow-hidden ${isToday ? 'border-brand-300 shadow-md ring-1 ring-brand-100' : 'border-gray-200 bg-white shadow-sm'}`}>
                                <div className={`px-4 py-3 border-b flex justify-between items-center ${isToday ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-100'}`}>
                                    <h3 className={`font-bold ${isToday ? 'text-brand-700' : 'text-gray-700'}`}>
                                        {WEEKDAYS[dayIndex]}
                                    </h3>
                                    {isToday && <span className="text-[10px] font-bold bg-brand-200 text-brand-800 px-2 py-0.5 rounded-full uppercase">Hoje</span>}
                                </div>

                                <div className="divide-y divide-gray-100 bg-white">
                                    {dayPlans.length === 0 ? (
                                        <div className="p-4 text-center text-gray-400 text-sm italic">
                                            Nenhuma aula planejada
                                        </div>
                                    ) : (
                                        dayPlans.map(plan => (
                                            <div
                                                key={plan.id}
                                                onClick={() => handlePlanClick(plan)}
                                                className="p-4 flex gap-4 hover:bg-gray-50 transition-colors group relative cursor-pointer"
                                            >
                                                {/* Time */}
                                                <div className="flex flex-col items-end min-w-[60px] pt-1">
                                                    <span className="text-lg font-bold text-gray-900 leading-none">{plan.start_time.slice(0, 5)}</span>
                                                    <span className="text-xs text-gray-400 mt-1 font-medium">{plan.end_time.slice(0, 5)}</span>
                                                </div>

                                                {/* Visual Line */}
                                                <div className="relative flex flex-col items-center">
                                                    <div className={`w-3 h-3 rounded-full border-2 mt-2 z-10 bg-white ${plan.status === 'cancelled' ? 'border-red-400' : 'border-brand-400 group-hover:bg-brand-400 group-hover:scale-125 transition-all'}`}></div>
                                                    <div className="w-px h-full bg-gray-100 absolute top-3 -z-0"></div>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 pb-4 flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        {/* Subject Pill */}
                                                        <span className={`
                                                            inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-bold border shadow-sm
                                                            ${plan.subject?.color || 'bg-gray-100 text-gray-700 border-gray-200'}
                                                        `}>
                                                            <span>{plan.subject?.emoji}</span>
                                                            {plan.subject?.name}
                                                        </span>

                                                        {/* Teacher Info (New) */}
                                                        {(plan as any).teacher?.name && (
                                                            <div className="flex items-center gap-1.5 pl-0.5 pt-1">
                                                                <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                                                                <span className="text-xs font-medium text-gray-500">
                                                                    Prof. {(plan as any).teacher.name}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Cancelled Badge */}
                                                        {plan.status === 'cancelled' && (
                                                            <div className="pt-1">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100 uppercase tracking-wide">
                                                                    Cancelada
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Chevron */}
                                                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-400 transition-colors mt-1" />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <LessonPlanDrawer
                isOpen={!!selectedPlan}
                onClose={() => setSelectedPlan(null)}
                lesson={selectedPlan}
            />
        </div>
    );
};
