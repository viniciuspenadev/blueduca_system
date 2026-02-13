import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

interface CustomDatePickerProps {
    value: string;
    onChange: (date: string) => void;
    minDate?: string;
    maxDate?: string;
    highlightedDates?: string[]; // Dates (YYYY-MM-DD) to show a dot
    className?: string;
    align?: 'left' | 'right';
    showIcon?: boolean;
}

export const CustomDatePicker = ({
    value,
    onChange,
    minDate,
    maxDate,
    highlightedDates = [],
    className = '',
    align = 'left',
    showIcon = true
}: CustomDatePickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Helper to parse "YYYY-MM-DD" safely (local time)
    const parseDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // State for the currently viewed month in the calendar
    const [viewDate, setViewDate] = useState(() => parseDate(value));

    // Sync view with value change (if closed)
    useEffect(() => {
        if (!isOpen) {
            setViewDate(parseDate(value));
        }
    }, [value, isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);

        // Simple constraint check (optional, can be stricter)
        if (minDate && delta < 0) {
            const min = parseDate(minDate);
            if (newDate.getFullYear() < min.getFullYear() || (newDate.getFullYear() === min.getFullYear() && newDate.getMonth() < min.getMonth())) {
                return; // Prevent going before min month
            }
        }
        if (maxDate && delta > 0) {
            const max = parseDate(maxDate);
            if (newDate.getFullYear() > max.getFullYear() || (newDate.getFullYear() === max.getFullYear() && newDate.getMonth() > max.getMonth())) {
                return;
            }
        }

        setViewDate(newDate);
    };

    // Generate days for grid
    const getDaysInMonth = (year: number, month: number) => {
        const date = new Date(year, month, 1);
        const days = [];

        // Fill previous month days
        const firstDayOfWeek = date.getDay(); // 0 = Sunday
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null);
        }

        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }
        return days;
    };

    const days = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const monthName = viewDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {/* Trigger Button */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 cursor-pointer group select-none ${className}`}
            >
                {showIcon && (
                    <div className="flex items-center z-10">
                        <CalendarIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </div>
                )}
                <span className="text-sm font-bold uppercase tracking-wider">
                    {parseDate(value).toLocaleDateString('pt-BR')}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {/* Dropdown Calendar */}
            {isOpen && (
                <>
                    {/* Background Overlay for mobile */}
                    <div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className={`
                        z-[100] w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 animate-in zoom-in-95 duration-200
                        fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                        md:absolute md:top-full md:mt-2 md:translate-x-0 md:translate-y-0
                        ${align === 'left' ? 'md:left-0 md:right-auto' : 'md:right-0 md:left-auto'}
                    `}>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 gap-2">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 shrink-0">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-bold text-gray-800 capitalize text-sm truncate text-center flex-1">{monthName}</span>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-600 shrink-0">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {weekDays.map((d, i) => (
                                <span key={`${d}-${i}`} className="text-xs font-bold text-gray-400">{d}</span>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {days.map((day, i) => {
                                if (!day) return <div key={`empty-${i}`} />;

                                const dayStr = formatDate(day);
                                const isSelected = dayStr === value;
                                const isToday = dayStr === formatDate(new Date());
                                const hasEvent = highlightedDates.includes(dayStr);

                                // Check max/min bounds
                                let isDisabled = false;
                                if (minDate && dayStr < minDate) isDisabled = true;
                                if (maxDate && dayStr > maxDate) isDisabled = true;

                                return (
                                    <button
                                        key={dayStr}
                                        disabled={isDisabled}
                                        onClick={() => {
                                            onChange(dayStr);
                                            setIsOpen(false);
                                        }}
                                        className={`
                                        h-8 w-8 rounded-lg flex items-center justify-center text-sm font-medium relative transition-colors
                                        ${isSelected ? 'bg-brand-600 text-white shadow-md' : 'text-gray-700 hover:bg-brand-50'}
                                        ${isToday && !isSelected ? 'text-brand-600 font-bold border border-brand-200' : ''}
                                        ${isDisabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}
                                    `}
                                    >
                                        {day.getDate()}
                                        {hasEvent && !isSelected && (
                                            <span className="absolute bottom-1 w-1 h-1 bg-brand-400 rounded-full" />
                                        )}
                                        {hasEvent && isSelected && (
                                            <span className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                            <span className="text-xs text-gray-500 font-medium">Dias com aula</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
