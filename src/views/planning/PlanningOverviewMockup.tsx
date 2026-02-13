import { useState } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    CheckCircle2,
    AlertCircle,
    Clock
} from 'lucide-react';

export const PlanningOverviewMockup = () => {
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

    // DUMMY DATA FOR MOCKUP - WEEK
    const weekDays = [
        { day: 'Seg', date: '04' },
        { day: 'Ter', date: '05' },
        { day: 'Qua', date: '06' },
        { day: 'Qui', date: '07' },
        { day: 'Sex', date: '08' },
    ];

    // DUMMY DATA - MONTH (Generating 30 days)
    const monthDays = Array.from({ length: 30 }, (_, i) => ({
        day: i + 1,
        isWeekend: (i + 1) % 7 === 0 || (i + 1) % 7 === 6 // Rough approx for demo
    }));

    const teachers = [
        {
            id: 1,
            name: 'Ana Silva',
            avatar: 'https://i.pravatar.cc/150?u=1',
            classes: [
                {
                    name: '1º Ano A - Matutino',
                    status: ['done', 'done', 'pending', 'done', 'done'],
                    monthStatus: Array.from({ length: 30 }, () => Math.random() > 0.3 ? 'done' : (Math.random() > 0.5 ? 'pending' : 'late'))
                },
                {
                    name: '2º Ano B - Vespertino',
                    status: ['done', 'done', 'late', 'pending', 'pending'],
                    monthStatus: Array.from({ length: 30 }, () => Math.random() > 0.2 ? 'done' : 'late')
                }
            ]
        },
        {
            id: 2,
            name: 'Carlos Souza',
            avatar: 'https://i.pravatar.cc/150?u=2',
            classes: [
                {
                    name: '3º Ano A - Matutino',
                    status: ['done', 'done', 'done', 'done', 'done'],
                    monthStatus: Array.from({ length: 30 }, () => 'done')
                },
                {
                    name: '5º Ano C - Matutino',
                    status: ['done', 'done', 'done', 'done', 'done'],
                    monthStatus: Array.from({ length: 30 }, () => Math.random() > 0.1 ? 'done' : 'pending')
                }
            ]
        },
        {
            id: 3,
            name: 'Mariana Costa',
            avatar: 'https://i.pravatar.cc/150?u=3',
            classes: [
                {
                    name: '1º Ano B - Vespertino',
                    status: ['late', 'late', 'pending', 'pending', 'pending'],
                    monthStatus: Array.from({ length: 30 }, () => Math.random() > 0.6 ? 'pending' : 'late')
                }
            ]
        }
    ];

    const getStatusColor = (status: string, isMonth = false) => {
        if (isMonth) {
            // Simpler colors for small heatmap cells
            switch (status) {
                case 'done': return 'bg-green-500';
                case 'pending': return 'bg-yellow-400';
                case 'late': return 'bg-red-500';
                default: return 'bg-gray-100';
            }
        }
        switch (status) {
            case 'done': return 'bg-green-100 text-green-700 border-green-200';
            case 'pending': return 'bg-yellow-50 text-yellow-600 border-yellow-100'; // Upcoming but not done
            case 'late': return 'bg-red-50 text-red-600 border-red-100'; // Missing/Late
            default: return 'bg-gray-100 text-gray-400';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'done': return <CheckCircle2 className="w-4 h-4" />;
            case 'pending': return <Clock className="w-4 h-4" />;
            case 'late': return <AlertCircle className="w-4 h-4" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in p-6 pb-20 bg-gray-50/50 min-h-screen">
            {/* Header MOCKUP */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <CalendarIcon className="w-7 h-7 text-brand-600" />
                        Gestão de Planejamento
                    </h1>
                    <p className="text-gray-500">Visão geral do progresso de aulas por professor</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* MOCKUP Controls */}
                    <div className="flex items-center bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('week')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Semana
                        </button>
                        <button
                            onClick={() => setViewMode('month')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Mês (Heatmap)
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-2 rounded-lg w-full md:w-64 border border-gray-200">
                    <Search className="w-4 h-4" />
                    <input className="bg-transparent border-none focus:outline-none text-sm w-full" placeholder="Buscar professor..." />
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700">
                        <Filter className="w-4 h-4" />
                        Filtros
                    </button>
                    <div className="h-4 w-px bg-gray-200 mx-2" />
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-gray-700 text-sm">{viewMode === 'week' ? '04 Dez - 08 Dez' : 'Dezembro 2024'}</span>
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
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
                            {weekDays.map(d => (
                                <div key={d.day} className="p-4 text-center border-l border-gray-200">
                                    <div className="text-xs text-gray-500 font-bold uppercase">{d.day}</div>
                                    <div className="text-lg font-bold text-gray-800">{d.date}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-[repeat(30,minmax(24px,1fr))]">
                            {monthDays.map(d => (
                                <div key={d.day} className={`p-2 text-center border-l border-gray-100 ${d.isWeekend ? 'bg-gray-100/50' : ''}`}>
                                    <div className="text-[10px] text-gray-400 font-bold">{d.day}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Grid Content */}
                <div className="divide-y divide-gray-100 min-w-[800px]">
                    {teachers.map(teacher => (
                        <div key={teacher.id} className="group hover:bg-gray-50 transition-colors">
                            {/* Teacher Row */}
                            <div className={`grid ${viewMode === 'week' ? 'grid-cols-[300px_1fr]' : 'grid-cols-[250px_1fr]'}`}>
                                <div className="p-4 flex items-start gap-3">
                                    <img src={teacher.avatar} className="w-10 h-10 rounded-full bg-gray-200 object-cover" alt="" />
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-sm">{teacher.name}</h3>
                                        <p className="text-xs text-gray-500">{teacher.classes.length} Turmas</p>
                                    </div>
                                </div>

                                {/* Timeline / Progress Summary for Teacher */}
                                <div className="p-4 flex items-center border-l border-gray-200 text-sm text-gray-400 italic">
                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs not-italic">
                                        {viewMode === 'week' ? 'Ver detalhe expandido 👇' : 'Visão mensal resumida 👉'}
                                    </span>
                                </div>
                            </div>

                            {/* Expanded Classes Rows */}
                            <div className="bg-gray-50/30 border-t border-gray-100">
                                {teacher.classes.map((cls, idx) => (
                                    <div key={idx} className={`grid ${viewMode === 'week' ? 'grid-cols-[300px_1fr]' : 'grid-cols-[250px_1fr]'} border-t border-gray-100/50 first:border-0`}>
                                        <div className="py-3 px-4 pl-16 flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${idx % 2 === 0 ? 'bg-brand-400' : 'bg-purple-400'}`}></div>
                                            <span className="text-sm font-medium text-gray-600 truncate" title={cls.name}>{cls.name}</span>
                                        </div>

                                        {viewMode === 'week' ? (
                                            <div className="grid grid-cols-5 border-l border-gray-200">
                                                {cls.status.map((status, i) => (
                                                    <div key={i} className="p-2 border-l border-gray-100 first:border-0 flex items-center justify-center">
                                                        <div className={`w-full h-full min-h-[40px] rounded-lg border flex items-center justify-center gap-1.5 transition-all text-xs font-bold cursor-pointer hover:opacity-80 ${getStatusColor(status)}`}>
                                                            {getStatusIcon(status)}
                                                            <span className="uppercase tracking-tight md:inline hidden">
                                                                {status === 'done' ? 'OK' : status === 'late' ? 'Pend' : 'Plan'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-[repeat(30,minmax(24px,1fr))] border-l border-gray-200">
                                                {cls.monthStatus && cls.monthStatus.map((status, i) => (
                                                    <div key={i} className={`border-r border-gray-100/50 flex flex-col`}>
                                                        <div className={`flex-1 m-0.5 rounded-sm ${getStatusColor(status as string, true)} opacity-80 hover:opacity-100`} title={`Dia ${i + 1}: ${status}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-4 text-xs text-gray-500 font-medium">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Planejamento Entregue</div>
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-600" /> Em Elaboração</div>
                <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600" /> Atrasado / Pendente</div>
            </div>
        </div>
    );
};
