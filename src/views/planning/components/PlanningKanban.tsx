import { useState, useEffect } from 'react';
import { planningService } from '../../../services/planningService';
import type { LessonPlan } from '../../../types';
import { Plus, Clock, CheckCircle } from 'lucide-react';
import { LessonPlanModal } from './LessonPlanModal';
import { useToast } from '../../../contexts/ToastContext';

interface PlanningKanbanProps {
    classId: string;
    date: Date;
    events: any[];
}

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

export const PlanningKanban = ({ classId, date, events }: PlanningKanbanProps) => {
    const { addToast } = useToast();
    const [plans, setPlans] = useState<LessonPlan[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [editingPlan, setEditingPlan] = useState<LessonPlan | undefined>(undefined);

    useEffect(() => {
        fetchPlans();
    }, [classId, date]);

    const getWeekDays = (baseDate: Date) => {
        const days = [];
        const current = new Date(baseDate);
        const day = current.getDay() || 7; // Sunday is 7
        if (day !== 1) current.setHours(-24 * (day - 1)); // Set to Monday

        for (let i = 0; i < 5; i++) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    };

    const weekDates = getWeekDays(date);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const start = weekDates[0].toISOString().split('T')[0];
            const end = weekDates[4].toISOString().split('T')[0];

            const data = await planningService.getLessonPlans(classId, start, end);
            setPlans(data);
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar aulas');
        } finally {
            setLoading(false);
        }
    };

    const handleAddLesson = (dayDate: Date) => {
        setSelectedDate(dayDate);
        setEditingPlan(undefined);
        setIsModalOpen(true);
    };

    const handleEditLesson = (plan: LessonPlan, dayDate: Date) => {
        setSelectedDate(dayDate);
        setEditingPlan(plan);
        setIsModalOpen(true);
    };

    const getPlansForDate = (dayDate: Date) => {
        const dateStr = dayDate.toISOString().split('T')[0];
        return plans.filter(p => p.date === dateStr);
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 h-full min-h-[600px]">
                {weekDates.map((dayDate, index) => {
                    const dayPlans = getPlansForDate(dayDate);
                    const isToday = new Date().toDateString() === dayDate.toDateString();

                    return (
                        <div key={index} className={`flex flex-col h-full rounded-2xl border ${isToday ? 'border-brand-200 bg-brand-50/30' : 'border-gray-200 bg-gray-50/50'}`}>
                            {/* Column Header */}
                            <div className={`p-4 border-b ${isToday ? 'border-brand-100 bg-brand-50' : 'border-gray-100 bg-gray-100'} rounded-t-2xl`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`text-sm font-bold ${isToday ? 'text-brand-700' : 'text-gray-600'}`}>
                                        {WEEKDAYS[index]}
                                    </span>
                                    {isToday && <span className="text-[10px] font-bold bg-brand-200 text-brand-700 px-2 py-0.5 rounded-full">HOJE</span>}
                                </div>
                                <div className={`text-2xl font-bold ${isToday ? 'text-brand-900' : 'text-gray-800'}`}>
                                    {dayDate.getDate()}
                                    <span className="text-sm font-normal text-gray-400 ml-1">
                                        / {dayDate.toLocaleDateString('pt-BR', { month: 'short' })}
                                    </span>
                                </div>

                                {/* Events / Holidays Banner */}
                                {events.filter(e => {
                                    const eventDate = new Date(e.start_time);
                                    return eventDate.toDateString() === dayDate.toDateString();
                                }).map(e => (
                                    <div key={e.id} className={`mt-2 text-xs p-1.5 rounded flex items-center gap-1 ${e.type === 'holiday' ? 'bg-red-50 text-red-600 border border-red-100' :
                                        'bg-blue-50 text-blue-600 border border-blue-100'
                                        }`}>
                                        <span className="font-bold uppercase tracking-wider">{e.type === 'holiday' ? 'Feriado' : 'Evento'}</span>
                                        <span className="truncate flex-1">{e.title}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Plans List */}
                            <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="text-center py-4 text-xs text-gray-400">Carregando...</div>
                                ) : (
                                    <>
                                        {dayPlans.map(plan => (
                                            <div
                                                key={plan.id}
                                                onClick={() => handleEditLesson(plan, dayDate)}
                                                className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden"
                                            >
                                                {/* Left Status Bar */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${plan.status === 'completed' ? 'bg-green-500' :
                                                    plan.status === 'cancelled' ? 'bg-red-400' :
                                                        'bg-brand-500'
                                                    }`} />

                                                <div className="pl-2">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${plan.subject?.color || 'bg-gray-100 text-gray-600'}`}>
                                                            {plan.subject?.emoji} {plan.subject?.name}
                                                        </span>
                                                        {plan.status === 'completed' && <CheckCircle className="w-3 h-3 text-green-500" />}
                                                    </div>

                                                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                                                        <Clock className="w-3 h-3" />
                                                        {plan.start_time.slice(0, 5)} - {plan.end_time.slice(0, 5)}
                                                    </div>

                                                    {plan.topic && (
                                                        <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">
                                                            {plan.topic}
                                                        </p>
                                                    )}

                                                    {plan.homework && (
                                                        <div className="mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-500 flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                                            Lição de casa
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}

                                <button
                                    onClick={() => handleAddLesson(dayDate)}
                                    // Block if holiday? For now just visual warning.
                                    className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:text-brand-600 hover:border-brand-200 hover:bg-brand-50 transition-all flex items-center justify-center gap-1 text-sm font-medium"
                                >
                                    <Plus className="w-4 h-4" />
                                    Adicionar
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div >

            <LessonPlanModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchPlans}
                classId={classId}
                date={selectedDate}
                plan={editingPlan}
            />
        </>
    );
};
