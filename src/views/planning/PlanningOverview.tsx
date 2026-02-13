import { useState, useEffect } from 'react';
import {
    Search,
    CheckCircle2,
    AlertCircle,
    Clock,
    ChevronLeft,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { planningOverviewService, type PlanningOverviewData } from '../../services/planningOverviewService';
import { usePlanningSettings } from '../../hooks/usePlanningSettings';
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PlanningOverviewProps {
    date: Date;
    setDate: (date: Date) => void;
}

export const PlanningOverview = ({ date, setDate }: PlanningOverviewProps) => {
    const { config, loading: configLoading } = usePlanningSettings();
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PlanningOverviewData[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            // Determine range based on viewMode
            let start, end;
            if (viewMode === 'week') {
                start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
                end = endOfWeek(date, { weekStartsOn: 1 });
            } else {
                start = startOfMonth(date);
                end = endOfMonth(date);
            }

            const result = await planningOverviewService.getPlanningOverview(
                format(start, 'yyyy-MM-dd'),
                format(end, 'yyyy-MM-dd')
            );
            setData(result);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [date, viewMode]);

    // Generate Headers
    const getHeaders = () => {
        if (viewMode === 'week') {
            const days = [];
            const start = startOfWeek(date, { weekStartsOn: 1 });
            for (let i = 0; i < 5; i++) { // Mon-Fri
                days.push(addDays(start, i));
            }
            return days.map(d => ({
                label: format(d, 'EEE', { locale: ptBR }),
                subLabel: format(d, 'dd'),
                date: d
            }));
        } else {
            // Month: Generate all days
            const days = [];
            const start = startOfMonth(date);
            const end = endOfMonth(date);
            let curr = start;
            while (curr <= end) {
                days.push(curr);
                curr = addDays(curr, 1);
            }
            return days.map(d => ({
                label: format(d, 'dd'),
                date: d,
                isWeekend: d.getDay() === 0 || d.getDay() === 6
            }));
        }
    };

    const headers = getHeaders();

    const getStatus = (statusDate: Date, hasPlan: boolean) => {
        if (!config) return 'pending';

        const now = new Date();

        if (hasPlan) return 'done';

        // Check if it's a workday
        const dayOfWeek = statusDate.getDay();
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0, Sun=6
        if (!config.workdays[dayIndex]) return 'pending'; // Not a workday

        // If alerts disabled, show pending
        if (config.alert_level === 'disabled') return 'pending';

        // LATE LOGIC
        // 1. If date is in past (before today) and no plan -> Late
        if (isBefore(statusDate, new Date(now.setHours(0, 0, 0, 0)))) {
            return config.alert_level === 'strict' ? 'late' : 'warning';
        }

        return 'pending';
    };

    const getStatusColor = (status: string, isMonth = false) => {
        if (isMonth) {
            switch (status) {
                case 'done': return 'bg-green-500';
                case 'pending': return 'bg-yellow-400';
                case 'warning': return 'bg-orange-400';
                case 'late': return 'bg-red-500';
                default: return 'bg-gray-100';
            }
        }
        switch (status) {
            case 'done': return 'bg-green-100 text-green-700 border-green-200';
            case 'pending': return 'bg-yellow-50 text-yellow-600 border-yellow-100';
            case 'warning': return 'bg-orange-50 text-orange-600 border-orange-100';
            case 'late': return 'bg-red-50 text-red-600 border-red-100';
            default: return 'bg-gray-100 text-gray-400';
        }
    };

    const filteredData = data.filter(t =>
        t.teacher_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.classes.some(c => c.class_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            {/* Filters Bar */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-2 rounded-lg w-full md:w-64 border border-gray-200">
                    <Search className="w-4 h-4" />
                    <input
                        className="bg-transparent border-none focus:outline-none text-sm w-full"
                        placeholder="Buscar professor ou turma..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-gray-100 p-0.5 rounded-lg flex gap-1 mr-4">
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Mês
                        </button>
                    </div>

                    <div className="h-4 w-px bg-gray-200 mx-2" />
                    <button onClick={() => viewMode === 'week' ? setDate(addDays(date, -7)) : setDate(addDays(date, -30))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-gray-700 text-sm capitalize">
                        {viewMode === 'week'
                            ? `${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd MMM', { locale: ptBR })} - ${format(endOfWeek(date, { weekStartsOn: 1 }), 'dd MMM', { locale: ptBR })}`
                            : format(date, 'MMMM yyyy', { locale: ptBR })
                        }
                    </span>
                    <button onClick={() => viewMode === 'week' ? setDate(addDays(date, 7)) : setDate(addDays(date, 30))} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* MAIN GRID */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
                {/* Grid Header */}
                <div className={`grid ${viewMode === 'week' ? 'grid-cols-[300px_1fr]' : 'grid-cols-[250px_1fr]'} border-b border-gray-200 bg-gray-50/50 min-w-[800px]`}>
                    <div className="p-4 font-bold text-xs uppercase tracking-wider text-gray-500">Professor / Turma</div>
                    {viewMode === 'week' ? (
                        <div className="grid grid-cols-5">
                            {headers.map((d: any) => (
                                <div key={d.date.toISOString()} className="p-4 text-center border-l border-gray-200">
                                    <div className="text-xs text-gray-500 font-bold uppercase">{d.label}</div>
                                    <div className="text-lg font-bold text-gray-800">{d.subLabel}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-[repeat(31,minmax(24px,1fr))]">
                            {headers.map((d: any) => (
                                <div key={d.date.toISOString()} className={`p-1 text-center border-l border-gray-100 ${d.isWeekend ? 'bg-gray-100/50' : ''}`}>
                                    <div className="text-[10px] text-gray-400 font-bold">{d.label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {(loading || configLoading) ? (
                    <div className="py-20 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-2" />
                        <p className="text-gray-500">Carregando dados...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100 min-w-[800px]">
                        {filteredData.map(teacher => (
                            <div key={teacher.teacher_id} className="group hover:bg-gray-50 transition-colors">
                                {/* Teacher Row */}
                                <div className={`grid ${viewMode === 'week' ? 'grid-cols-[300px_1fr]' : 'grid-cols-[250px_1fr]'}`}>
                                    <div className="p-4 flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                                            {teacher.teacher_name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-gray-900 text-sm truncate">{teacher.teacher_name}</h3>
                                            <p className="text-xs text-gray-500">{teacher.classes.length} Turmas</p>
                                        </div>
                                    </div>

                                    <div className="p-4 flex items-center border-l border-gray-200 text-sm text-gray-400 italic">
                                        <span className="bg-gray-100 px-2 py-1 rounded text-xs not-italic">
                                            {viewMode === 'week' ? 'Ver detalhe expandido 👇' : 'Visão mensal resumida 👉'}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded Classes Rows */}
                                <div className="bg-gray-50/30 border-t border-gray-100">
                                    {teacher.classes.map((cls, idx) => (
                                        <div key={cls.class_id} className={`grid ${viewMode === 'week' ? 'grid-cols-[300px_1fr]' : 'grid-cols-[250px_1fr]'} border-t border-gray-100/50 first:border-0`}>
                                            <div className="py-3 px-4 pl-16 flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${idx % 2 === 0 ? 'bg-brand-400' : 'bg-purple-400'}`}></div>
                                                <span className="text-sm font-medium text-gray-600 truncate" title={cls.class_name}>{cls.class_name}</span>
                                            </div>

                                            {viewMode === 'week' ? (
                                                <div className="grid grid-cols-5 border-l border-gray-200">
                                                    {headers.map((d: any) => {
                                                        const dateStr = format(d.date, 'yyyy-MM-dd');
                                                        const hasPlan = cls.lesson_dates.includes(dateStr);
                                                        const status = getStatus(d.date, hasPlan);

                                                        return (
                                                            <div key={dateStr} className="p-2 border-l border-gray-100 first:border-0 flex items-center justify-center">
                                                                <div className={`w-full h-full min-h-[40px] rounded-lg border flex items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer hover:opacity-80 ${getStatusColor(status)}`}>
                                                                    {status === 'done' && <CheckCircle2 className="w-4 h-4" />}
                                                                    {status === 'late' && <AlertCircle className="w-4 h-4" />}
                                                                    {status === 'pending' && <Clock className="w-4 h-4" />}
                                                                    <span className="uppercase tracking-tight md:inline hidden">
                                                                        {status === 'done' ? 'OK' : status === 'late' ? 'Pend' : 'Plan'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-[repeat(31,minmax(24px,1fr))] border-l border-gray-200">
                                                    {headers.map((d: any) => {
                                                        const dateStr = format(d.date, 'yyyy-MM-dd');
                                                        const hasPlan = cls.lesson_dates.includes(dateStr);
                                                        const status = getStatus(d.date, hasPlan);

                                                        return (
                                                            <div key={dateStr} className={`border-r border-gray-100/50 flex flex-col`}>
                                                                <div className={`flex-1 m-0.5 rounded-sm ${getStatusColor(status, true)} opacity-80 hover:opacity-100`} title={`${format(d.date, 'dd/MM')}: ${status}`} />
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-4 text-xs text-gray-500 font-medium">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Planejamento Entregue</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-600" /> Em Elaboração</div>
                <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600" /> Atrasado / Pendente</div>
            </div>
        </div >
    );
};
