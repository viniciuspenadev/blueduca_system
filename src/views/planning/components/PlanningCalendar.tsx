import { useState, useEffect } from 'react';
import { planningService } from '../../../services/planningService';
import type { LessonPlan } from '../../../types';
import { Plus } from 'lucide-react';
import { LessonPlanModal } from './LessonPlanModal';
import { useToast } from '../../../contexts/ToastContext';

interface PlanningCalendarProps {
    classId: string;
    date: Date;
    events: any[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const PlanningCalendar = ({ classId, date, events }: PlanningCalendarProps) => {
    const { addToast } = useToast();
    const [plans, setPlans] = useState<LessonPlan[]>([]);


    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [editingPlan, setEditingPlan] = useState<LessonPlan | undefined>(undefined);

    useEffect(() => {
        fetchPlans();
    }, [classId, date]);

    const fetchPlans = async () => {
        try {
            // Get first and last day of month
            const year = date.getFullYear();
            const month = date.getMonth();
            const start = new Date(year, month, 1).toISOString().split('T')[0];
            const end = new Date(year, month + 1, 0).toISOString().split('T')[0];

            const data = await planningService.getLessonPlans(classId, start, end);
            setPlans(data);
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar aulas');
        }
    };

    const getDaysInMonth = () => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];

        // Add empty days for previous month
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Add days of current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const calendarDays = getDaysInMonth();

    const getPlansForDate = (dayDate: Date) => {
        const dateStr = dayDate.toISOString().split('T')[0];
        return plans.filter(p => p.date === dateStr);
    };

    const handleDayClick = (dayDate: Date) => {
        // If there are plans, maybe show a list or add new?
        // For simplicity, let's open modal for adding new 
        // OR if there is only 1, edit it?
        // Better: Open modal to ADD new, but list existing in the UI
        setSelectedDate(dayDate);
        setEditingPlan(undefined);
        setIsModalOpen(true);
    };

    const handleEditPlan = (e: React.MouseEvent, plan: LessonPlan, dayDate: Date) => {
        e.stopPropagation();
        setSelectedDate(dayDate);
        setEditingPlan(plan);
        setIsModalOpen(true);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[700px]">
                    <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                        {WEEKDAYS.map(day => (
                            <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 auto-rows-[1fr]">
                        {calendarDays.map((dayDate, index) => {
                            if (!dayDate) {
                                return <div key={`empty-${index}`} className="bg-gray-50/30 border-b border-r border-gray-100 min-h-[140px]" />;
                            }

                            const isToday = new Date().toDateString() === dayDate.toDateString();

                            // 1. Get Data for this Day
                            const dayPlans = getPlansForDate(dayDate);
                            const dayEvents = events.filter(e => {
                                const eventDate = new Date(e.start_time);
                                return eventDate.toDateString() === dayDate.toDateString();
                            });

                            // 2. Identify Status
                            const holiday = dayEvents.find(e => e.type === 'holiday');
                            const otherEvents = dayEvents.filter(e => e.type !== 'holiday');

                            // 3. Render "Holiday Mode" (Takes over cell)
                            if (holiday) {
                                return (
                                    <div
                                        key={index}
                                        onClick={() => handleDayClick(dayDate)}
                                        className={`
                                    min-h-[140px] p-2 border-b border-r border-gray-100 transition-colors cursor-pointer group
                                    bg-red-50/50 hover:bg-red-50 relative overflow-hidden
                                `}
                                    >
                                        <span className="absolute top-2 right-2 text-xs font-semibold text-red-300">
                                            {dayDate.getDate()}
                                        </span>

                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-80 mt-2">
                                            <span className="text-xl mb-1">🏖️</span>
                                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-tight">
                                                Feriado
                                            </span>
                                            <span className="text-xs text-red-600 font-medium line-clamp-2 px-2 mt-1">
                                                {holiday.title}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }

                            // 4. Render "Regular Day" (Smart Stack)
                            // Combine contents for overflow calculation
                            // Priority: Events (Top) -> Lessons (Bottom)
                            const MAX_ITEMS = 3;
                            const totalItems = otherEvents.length + dayPlans.length;
                            const hasOverflow = totalItems > MAX_ITEMS;

                            // Determine how many of each to show
                            // We try to show all events first, then fill remaining slots with plans
                            const visibleEvents = otherEvents.slice(0, MAX_ITEMS);
                            const remainingSlots = Math.max(0, MAX_ITEMS - visibleEvents.length);
                            const visiblePlans = dayPlans.slice(0, remainingSlots);

                            return (
                                <div
                                    key={index}
                                    onClick={() => handleDayClick(dayDate)}
                                    className={`
                                min-h-[140px] p-2 border-b border-r border-gray-100 transition-colors cursor-pointer group hover:bg-gray-50
                                ${isToday ? 'bg-brand-50/20' : ''} flex flex-col gap-1.5
                            `}
                                >
                                    {/* Header: Date + Add Button */}
                                    <div className="flex justify-between items-start">
                                        <span className={`
                                    w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                                    ${isToday ? 'bg-brand-600 text-white' : 'text-gray-400'}
                                `}>
                                            {dayDate.getDate()}
                                        </span>
                                        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-brand-100 rounded text-gray-400 hover:text-brand-600 transition-all">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {/* Content Stack */}
                                    <div className="flex-1 flex flex-col gap-1">
                                        {/* A. Events Strips */}
                                        {visibleEvents.map(e => (
                                            <div key={e.id} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 truncate border-l-2 border-blue-500" title={e.title}>
                                                {e.title}
                                            </div>
                                        ))}

                                        {/* B. Lesson Plans */}
                                        {visiblePlans.map(plan => (
                                            <div
                                                key={plan.id}
                                                onClick={(e) => handleEditPlan(e, plan, dayDate)}
                                                className={`
                                            text-[10px] px-1.5 py-0.5 rounded border truncate flex items-center gap-1.5 transition-all
                                            ${plan.subject?.color ? plan.subject.color.replace('bg-', 'bg-opacity-20 bg-') + ' border-' + plan.subject.color.replace('bg-', '') : 'bg-gray-100 border-gray-200'}
                                            hover:opacity-80
                                        `}
                                                title={`${plan.subject?.name}: ${plan.topic}`}
                                            >
                                                <span className="text-xs shrink-0">{plan.subject?.emoji || '📚'}</span>
                                                <span className="font-semibold text-gray-700 truncate">{plan.subject?.name}</span>
                                            </div>
                                        ))}

                                        {/* C. Overflow Indicator */}
                                        {hasOverflow && (
                                            <div className="text-[10px] font-medium text-gray-400 pl-1 mt-auto">
                                                + {totalItems - (visibleEvents.length + visiblePlans.length)} mais...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <LessonPlanModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchPlans}
                classId={classId}
                date={selectedDate}
                plan={editingPlan}
            />
        </div>
    );
};
