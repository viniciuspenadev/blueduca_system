import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';

interface LeadCard {
    id: string;
    name: string;
    status: string;
    visit_date?: string;
}

interface LeadsCalendarProps {
    leads: LeadCard[];
    onLeadClick: (id: string) => void;
}

export const LeadsCalendar: React.FC<LeadsCalendarProps> = ({ leads, onLeadClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Filter only leads with visit_date
    const events = leads.filter(l => l.visit_date);

    // Calendar Helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date: Date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const isToday = (day: number) => {
        const today = new Date();
        return (
            day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear()
        );
    };

    const getEventsForDay = (day: number) => {
        return events.filter(l => {
            const d = new Date(l.visit_date!);
            return (
                d.getDate() === day &&
                d.getMonth() === currentDate.getMonth() &&
                d.getFullYear() === currentDate.getFullYear()
            );
        });
    };

    // Generate Calendar Grid
    const renderCalendarDays = () => {
        const days = [];
        // Empty cells for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[120px] bg-gray-50/50 border-b border-r border-gray-100"></div>);
        }
        // Actual days
        for (let day = 1; day <= daysInMonth; day++) {
            const dayEvents = getEventsForDay(day);
            days.push(
                <div key={day} className={`min-h-[120px] border-b border-r border-gray-100 p-2 transition-colors hover:bg-gray-50 flex flex-col ${isToday(day) ? 'bg-blue-50/30' : 'bg-white'}`}>
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700'}`}>
                            {day}
                        </span>
                        {dayEvents.length > 0 && (
                            <span className="text-xs font-bold text-gray-400">{dayEvents.length} visitas</span>
                        )}
                    </div>

                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar">
                        {dayEvents.map(event => (
                            <button
                                key={event.id}
                                onClick={() => onLeadClick(event.id)}
                                className="w-full text-left text-xs p-1.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 hover:border-purple-200 transition-colors truncate flex items-center gap-1.5 group"
                            >
                                <Clock size={10} className="shrink-0 text-purple-400 group-hover:text-purple-600" />
                                <span className="truncate font-medium">{new Date(event.visit_date!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {event.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            );
        }
        return days;
    };

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-gray-50/50">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <CalendarIcon className="text-blue-600" size={20} />
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                    </h2>
                    <div className="flex bg-white rounded-lg border border-gray-200 shadow-sm p-0.5">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600"><ChevronLeft size={18} /></button>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600"><ChevronRight size={18} /></button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                        Hoje
                    </button>
                </div>
            </div>

            {/* Grid Header */}
            <div className="grid grid-cols-7 border-b border-gray-200 shrink-0 bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wider text-center py-2">
                {weekDays.map(day => <div key={day}>{day}</div>)}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 flex-1 overflow-y-auto">
                {renderCalendarDays()}
            </div>
        </div>
    );
};
