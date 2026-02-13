import { type FC, useState } from 'react';

import { Clock, Coffee, BookOpen, Moon, Bus, Circle } from 'lucide-react';
import { useDailyTimeline } from '../../hooks/useDailyTimeline';
import { LessonPlanDrawer } from './LessonPlanDrawer';
import type { DailyTimelineItem } from '../../types/timeline';

interface DailyTimelineProps {
    classId?: string;
    studentId?: string;
    enrollmentId?: string;
    externalItems?: DailyTimelineItem[]; // Allow passing lesson plans from parent
}

export const DailyTimelineComponent: FC<DailyTimelineProps> = ({ classId, enrollmentId, externalItems = [] }) => {
    const { timeline, loading } = useDailyTimeline({ classId, enrollmentId });
    const [selectedItem, setSelectedItem] = useState<DailyTimelineItem | null>(null);

    // Merge logic: If we have external items (Lesson Plans), we should merge them or append them.
    // For now, let's assume externalItems are the "Academic" ones and likely mapped from Lesson Plans.
    // We can combine them and sort by start_time.
    const combinedItems = [...(timeline?.items || []), ...externalItems].sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return a.start_time.localeCompare(b.start_time);
    });

    const itemsToDisplay = combinedItems.length > 0 ? combinedItems : [];

    const getIcon = (type: string) => {
        switch (type) {
            case 'food': return <Coffee className="w-4 h-4 text-orange-500" />;
            case 'academic': return <BookOpen className="w-4 h-4 text-brand-600" />;
            case 'rest': return <Moon className="w-4 h-4 text-purple-500" />;
            case 'transport': return <Bus className="w-4 h-4 text-blue-500" />;
            default: return <Circle className="w-4 h-4 text-gray-400" />;
        }
    };

    if (loading) return <div className="p-4 text-center text-xs text-gray-400">Carregando rotina...</div>;
    // if (!timeline || !timeline.items || timeline.items.length === 0) return null; // Old check
    // New check: if both lists are empty
    if ((!timeline || !timeline.items || timeline.items.length === 0) && externalItems.length === 0) return null;

    // Helper to get time in minutes for comparison
    const getTimeInMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const getCurrentStatus = (itemStartTime: string | null, nextItemStartTime: string | null) => {
        if (!itemStartTime) return 'future'; // No time set? treat as future or neutral

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = getTimeInMinutes(itemStartTime);

        // If there's a next item, check if we are in the window between this item and the next
        if (nextItemStartTime) {
            const endMinutes = getTimeInMinutes(nextItemStartTime);
            if (currentMinutes >= startMinutes && currentMinutes < endMinutes) return 'current';
        } else {
            // Last item: if it started within the last 2 hours (arbitrary duration), it's current. 
            // Or simpler: if it started and we passed it, it's current until end of day?
            // Let's say it's current if it started recently.
            if (currentMinutes >= startMinutes) return 'current';
        }

        if (currentMinutes >= startMinutes) return 'past';
        return 'future';
    };

    return (
        <>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 my-1">
                <div className="flex items-center gap-2 mb-3">
                    <div className="bg-brand-50 p-1.5 rounded-lg">
                        <Clock className="w-4 h-4 text-brand-600" />
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm">Rotina do Dia</h3>
                </div>

                <div className="relative">
                    <div className="flex overflow-x-auto gap-0.5 pb-0 scrollbar-hide snap-x px-0 justify-between">
                        {itemsToDisplay.map((item, index) => {
                            const isLast = index === itemsToDisplay.length - 1;
                            const nextItem = !isLast ? itemsToDisplay[index + 1] : null;

                            const status = getCurrentStatus(item.start_time || null, nextItem ? (nextItem.start_time || null) : null);

                            // Dynamic Styles based on Status
                            const isPast = status === 'past';
                            const isCurrent = status === 'current';
                            const isFuture = status === 'future';

                            const isClickable = item.type === 'academic' || !!item.description;

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => isClickable && setSelectedItem(item)}
                                    className={`relative flex-none md:flex-1 w-[52px] md:w-auto md:min-w-[52px] flex flex-col items-center group snap-start transition-opacity duration-300 \
                                    ${isFuture ? 'opacity-50 grayscale' : 'opacity-100'} \
                                    ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                                >

                                    {/* Connector Line */}
                                    {!isLast && (
                                        <div className={`absolute top-[1.15rem] left-[50%] w-full h-[2px] -z-10 transition-colors duration-500
                                            ${(isPast || isCurrent) ? 'bg-green-500' : 'bg-gray-100'}
                                        `} />
                                    )}

                                    {/* Time Pill */}
                                    <span className={`
                                        text-[9px] font-bold mb-1 px-1 py-0.5 rounded-md transition-colors duration-300
                                        ${isCurrent ? 'bg-green-100 text-green-700 animate-pulse' : ''}
                                        ${isPast ? 'bg-green-50 text-green-600' : ''}
                                        ${isFuture ? 'bg-gray-100 text-gray-400' : ''}
                                        ${!item.start_time ? 'opacity-0' : ''}
                                    `}>
                                        {item.start_time ? item.start_time.slice(0, 5) : '--:--'}
                                    </span>

                                    {/* Icon Circle */}
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center mb-1.5 shadow-sm border-2 transition-all transform duration-500
                                        ${isCurrent ? 'border-green-500 shadow-green-200 scale-110 animate-bounce-subtle ring-2 ring-green-100' : 'border-white'}
                                        ${isPast ? 'bg-green-500 text-white border-green-500' : ''}
                                        ${isFuture && item.color ? '' : 'bg-white border-gray-100'} 
                                    `} style={(isFuture && item.color) ? { backgroundColor: item.color + '15', color: item.color, borderColor: 'white' } : (isPast ? {} : {})}>
                                        {/* Icon rendering logic adjusted for past state */}
                                        {isPast ? <div className="text-white">{getIcon(item.type)}</div> : getIcon(item.type)}
                                    </div>

                                    {/* Title */}
                                    <span className={`
                                        text-[9px] font-bold text-center leading-tight line-clamp-2 w-full px-0.5 transition-colors
                                        ${isCurrent ? 'text-green-700' : 'text-gray-700'}
                                        ${isFuture ? 'text-gray-400' : ''}
                                    `}>
                                        {item.title}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <LessonPlanDrawer
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                lesson={selectedItem}
            />
        </>
    );
};
