import { type FC, useEffect, useState } from 'react';
import { Utensils, Coffee, BookOpen, Check, Lock, Clock } from 'lucide-react';

interface DayTimelineProps { }

export const DayTimeline: FC<DayTimelineProps> = () => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 10000); // Update every 10s for better feel
        return () => clearInterval(timer);
    }, []);

    const hour = now.getHours();
    const minutes = now.getMinutes();
    const currentTimeInMinutes = hour * 60 + minutes;

    // Visibility Check: Starts at 09:00
    if (hour < 9) return null;

    // Time checkpoints
    const snackTime = 9 * 60 + 30;  // 09:30
    const lunchTime = 12 * 60;      // 12:00
    const diaryTime = 19 * 60;      // 19:00

    // Determine Logic State
    let currentStateLabel = '';
    let nextEventLabel = '';
    let timeToNext = '';

    if (currentTimeInMinutes < snackTime) {
        currentStateLabel = 'Preparando para o Lanche';
        const diff = snackTime - currentTimeInMinutes;
        nextEventLabel = 'Lanche';
        timeToNext = `${diff} min`;
    } else if (currentTimeInMinutes < lunchTime) {
        if (currentTimeInMinutes < snackTime + 30) {
            currentStateLabel = 'Hora do Lanche 🍎';
        } else {
            currentStateLabel = 'Atividades em Sala';
            const diff = lunchTime - currentTimeInMinutes;
            nextEventLabel = 'Almoço';
            timeToNext = diff > 60 ? `${Math.floor(diff / 60)}h ${diff % 60}min` : `${diff} min`;
        }
    } else if (currentTimeInMinutes < diaryTime) {
        if (currentTimeInMinutes < lunchTime + 60) {
            currentStateLabel = 'Hora do Almoço 🥗';
        } else {
            currentStateLabel = 'Tarde de Aprendizado';
            const diff = diaryTime - currentTimeInMinutes;
            nextEventLabel = 'Diário';
            timeToNext = diff > 60 ? `${Math.floor(diff / 60)}h ${diff % 60}min` : `${diff} min`;
        }
    } else {
        currentStateLabel = 'Dia Finalizado ✨';
    }

    // Progress Calculation
    let progressPercentage = 0;
    if (currentTimeInMinutes >= diaryTime) {
        progressPercentage = 100;
    } else if (currentTimeInMinutes >= lunchTime) {
        // Range: Lunch (12:00) to Diary (19:00) -> 50% to 100%
        const total = diaryTime - lunchTime;
        const current = currentTimeInMinutes - lunchTime;
        progressPercentage = 50 + ((current / total) * 50);
    } else if (currentTimeInMinutes >= snackTime) {
        // Range: Snack (09:30) to Lunch (12:00) -> 0% to 50%
        const total = lunchTime - snackTime;
        const current = currentTimeInMinutes - snackTime;
        progressPercentage = ((current / total) * 50);
    }

    const getStepStatus = (stepTimeMinutes: number) => {
        if (currentTimeInMinutes >= stepTimeMinutes + 30) return 'completed';
        if (currentTimeInMinutes >= stepTimeMinutes - 60 && currentTimeInMinutes < stepTimeMinutes + 30) return 'active';
        return 'pending';
    };

    const steps = [
        { id: 'snack', label: 'Lanche', icon: Coffee, status: getStepStatus(snackTime), time: '09:30' },
        { id: 'lunch', label: 'Almoço', icon: Utensils, status: getStepStatus(lunchTime), time: '12:00' },
        { id: 'diary', label: 'Diário', icon: BookOpen, status: hour >= 19 ? 'completed' : 'pending', time: '19:00' }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header: Dynamic Status */}
            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        {currentStateLabel}
                    </span>
                </div>
                {nextEventLabel && (
                    <div className="flex items-center gap-1.5 text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-medium">
                        <Clock className="w-3 h-3" />
                        <span>{nextEventLabel} em {timeToNext}</span>
                    </div>
                )}
            </div>

            {/* Timline Body */}
            <div className="p-5 relative">
                {/* Visual Guide Line (Background) */}
                {/* Inset by 2rem (approx 8 units) to align with center of first/last nodes */}
                {/* Timeline Track Container */}
                {/* Inset by 2.5rem (mx-10) to align with center of first/last nodes (p-5 + half node) */}
                <div className="absolute top-10 left-0 right-0 mx-10 h-0.5 z-0 -translate-y-1/2">
                    {/* Background Line */}
                    <div className="absolute inset-0 bg-gray-100" />

                    {/* Progress Line */}
                    <div
                        className="absolute left-0 top-0 bottom-0 bg-brand-500 transition-all duration-1000 ease-in-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>

                <div className="relative z-10 flex justify-between">
                    {steps.map((step, index) => {
                        const isCompleted = step.status === 'completed';
                        const isActive = step.status === 'active';
                        const isLocked = step.id === 'diary' && !isCompleted;

                        return (
                            <div key={index} className="flex flex-col items-center gap-3">
                                {/* Node */}
                                <div className={`
                                    w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300
                                    ${isCompleted
                                        ? 'bg-brand-500 border-brand-500 text-white shadow-brand-100'
                                        : isActive
                                            ? 'bg-white border-brand-500 text-brand-500 shadow-md scale-110'
                                            : 'bg-white border-gray-100 text-gray-300'}
                                `}>
                                    {isLocked ? (
                                        <Lock className="w-4 h-4" />
                                    ) : isCompleted ? (
                                        <Check className="w-5 h-5 stroke-[3]" />
                                    ) : (
                                        <step.icon className="w-4 h-4" />
                                    )}
                                </div>

                                {/* Texts */}
                                <div className="flex flex-col items-center">
                                    <span className={`text-[10px] font-bold ${isActive ? 'text-brand-600' : 'text-gray-400'}`}>
                                        {step.time}
                                    </span>
                                    <span className={`text-xs font-bold uppercase ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
