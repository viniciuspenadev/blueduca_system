import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import {
    School,
    BarChart3,
    Settings,
    Search,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { PlanningKanban } from './components/PlanningKanban';
import { PlanningCalendar } from './components/PlanningCalendar';
import { PlanningOverview } from './PlanningOverview';
import { PlanningSettingsModal } from './components/PlanningSettingsModal';
import { useToast } from '../../contexts/ToastContext';

export const PlanningDashboard = () => {
    const { user } = useAuth();
    const { addToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [viewMode, setViewMode] = useState<'week' | 'month' | 'overview'>('week');
    const [events, setEvents] = useState<any[]>([]); // Store School Events

    // Settings Modal
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Date Navigation
    const [currentDate, setCurrentDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchClasses();
    }, [user]);

    useEffect(() => {
        if (selectedClassId) {
            fetchEvents();
        }
    }, [selectedClassId, currentDate, viewMode]);

    const fetchEvents = async () => {
        // Calculate start/end dates based on view mode
        let startStr, endStr;
        const year = currentDate.getFullYear();

        if (viewMode === 'month') {
            const month = currentDate.getMonth();
            startStr = new Date(year, month, 1).toISOString().split('T')[0];
            endStr = new Date(year, month + 1, 0).toISOString().split('T')[0];
        } else {
            // Week logic
            const start = new Date(currentDate);
            const day = start.getDay() || 7;
            if (day !== 1) start.setHours(-24 * (day - 1));

            const end = new Date(start);
            end.setDate(end.getDate() + 4); // Friday

            startStr = start.toISOString().split('T')[0];
            endStr = end.toISOString().split('T')[0];
        }

        // Fetch events: Global OR Class Specific
        const { data } = await supabase
            .from('events')
            .select('*')
            .or(`class_id.is.null,class_id.eq.${selectedClassId}`)
            .gte('start_time', `${startStr}T00:00:00`)
            .lte('start_time', `${endStr}T23:59:59`);

        if (data) setEvents(data);
    };

    const fetchClasses = async () => {
        if (!user) return;
        setLoading(true);
        try {
            let query = supabase
                .from('classes')
                .select('id, name, school_year, shift')
                .eq('status', 'active')
                .order('name');

            // If Teacher, filter by ownership
            if (user.role === 'TEACHER') {
                // Get class IDs from class_teachers
                const { data: teacherClasses } = await supabase
                    .from('class_teachers')
                    .select('class_id')
                    .eq('teacher_id', user.id);

                const classIds = teacherClasses?.map(tc => tc.class_id) || [];

                if (classIds.length > 0) {
                    query = query.in('id', classIds);
                } else {
                    // Teacher has no classes
                    setClasses([]);
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await query;
            if (error) throw error;

            setClasses(data || []);
            if (data && data.length > 0) {
                // Auto-select first class
                setSelectedClassId(data[0].id);
            }
        } catch (error) {
            console.error(error);
            addToast('error', 'Erro ao carregar turmas');
        } finally {
            setLoading(false);
        }
    };

    const handlePrevious = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() - 7);
        } else {
            newDate.setMonth(newDate.getMonth() - 1);
        }
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(newDate.getDate() + 7);
        } else {
            newDate.setMonth(newDate.getMonth() + 1);
        }
        setCurrentDate(newDate);
    };

    const formatDateRange = () => {
        if (viewMode === 'month') {
            return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        } else {
            // Week range
            const start = new Date(currentDate);
            const day = start.getDay() || 7; // Get current day number, converting Sun(0) to 7
            if (day !== 1) start.setHours(-24 * (day - 1)); // Set to Monday

            const end = new Date(start);
            end.setDate(end.getDate() + 4); // Friday

            return `${start.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a ${end.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Planejamento de Aulas
                    </h1>
                    <p className="text-gray-500">Gerencie o conteúdo programático das suas turmas</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                    {/* Class Selector (Hide in Overview) */}
                    {viewMode !== 'overview' && (
                        <>
                            <div className="relative min-w-[200px]">
                                <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <select
                                    className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 font-medium text-gray-700 appearance-none cursor-pointer"
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                >
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name} ({c.school_year})</option>
                                    ))}
                                    {classes.length === 0 && !loading && <option>Nenhuma turma encontrada</option>}
                                </select>
                            </div>
                            <div className="h-8 w-px bg-gray-200 hidden md:block" />
                        </>
                    )}

                    {/* Gestão Button - Only for Admins */}
                    {user?.role === 'ADMIN' && (
                        <button
                            onClick={() => setViewMode('overview')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${viewMode === 'overview'
                                ? 'bg-brand-600 text-white shadow-md'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            <BarChart3 className="w-4 h-4" /> Gestão
                        </button>
                    )}

                    {/* Settings Button - Only for Admins */}
                    {user?.role === 'ADMIN' && (
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors"
                            title="Configurações de Prazos"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Bar (Hide in Overview since it has internal nav) */}
            {viewMode !== 'overview' && (
                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                    {/* Search */}
                    <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-2 rounded-lg w-full md:w-64 border border-gray-200">
                        <Search className="w-4 h-4" />
                        <input
                            className="bg-transparent border-none focus:outline-none text-sm w-full"
                            placeholder="Buscar classe..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Toggle */}
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

                        {/* Date Navigation */}
                        <div className="h-4 w-px bg-gray-200 mx-2" />
                        <button onClick={handlePrevious} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-gray-700 text-sm capitalize">
                            {formatDateRange()}
                        </span>
                        <button onClick={handleNext} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="min-h-[500px]">
                {viewMode === 'overview' ? (
                    <PlanningOverview date={currentDate} setDate={setCurrentDate} />
                ) : (
                    <>
                        {loading ? (
                            <div className="text-center py-20 text-gray-500">Carregando planejamento...</div>
                        ) : !selectedClassId ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                                <School className="w-16 h-16 text-gray-200 mb-4" />
                                <h3 className="text-xl font-bold text-gray-700">Selecione uma turma</h3>
                                <p className="text-gray-500">Escolha uma turma para visualizar o planejamento.</p>
                            </div>
                        ) : (
                            <>
                                {viewMode === 'week' ? (
                                    <PlanningKanban
                                        classId={selectedClassId}
                                        date={currentDate}
                                        events={events}
                                    />
                                ) : (
                                    <PlanningCalendar
                                        classId={selectedClassId}
                                        date={currentDate}
                                        events={events}
                                    />
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Settings Modal */}
            <PlanningSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};
