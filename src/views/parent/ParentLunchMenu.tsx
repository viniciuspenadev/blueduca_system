import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, UtensilsCrossed } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MenuTemplate {
    id: string;
    name: string;
    content: Record<string, { title: string, description: string }>;
    is_active: boolean;
}

const WEEK_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const ParentLunchMenu: React.FC = () => {
    const { currentSchool } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeTemplate, setActiveTemplate] = useState<MenuTemplate | null>(null);

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));

    useEffect(() => {
        if (currentSchool) {
            fetchActiveTemplate();
        }
    }, [currentSchool]);

    const fetchActiveTemplate = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('menu_templates')
                .select('*')
                .eq('school_id', currentSchool?.id)
                .eq('is_active', true)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            setActiveTemplate(data);
        } catch (error) {
            console.error('Error fetching template:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDayContent = (date: Date) => {
        if (!activeTemplate?.content) return null;
        const dayIndex = getDay(date);
        const key = WEEK_KEYS[dayIndex];
        return activeTemplate.content[key];
    };

    const currentContent = getDayContent(selectedDate);

    return (
        <div className="space-y-8 pb-24">
            <div className="bg-brand-600 p-6 rounded-3xl shadow-lg shadow-brand-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-white/20 rounded-xl text-white">
                        <UtensilsCrossed className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Cardápio da Escola</h2>
                        <p className="text-xs text-white/70 font-medium">Refeições saudáveis para os alunos</p>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-black/10 p-1 rounded-xl border border-white/10">
                    <button
                        onClick={() => setWeekStart(addDays(weekStart, -7))}
                        className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                    >
                        ←
                    </button>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar px-1">
                        {Array.from({ length: 7 }).map((_, idx) => {
                            const day = addDays(weekStart, idx);
                            const isSelected = isSameDay(day, selectedDate);
                            const dayContent = getDayContent(day);
                            const hasMenu = dayContent && dayContent.description;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        flex flex-col items-center justify-center min-w-[3rem] h-12 rounded-lg shrink-0 transition-all
                                        ${isSelected
                                            ? 'bg-white text-brand-600 font-bold shadow-md'
                                            : 'text-white/60 hover:bg-white/10'
                                        }
                                    `}
                                >
                                    <span className={`text-[9px] uppercase ${isSelected ? 'text-brand-600/60' : 'text-white/40'}`}>
                                        {format(day, 'EEE', { locale: ptBR }).replace('.', '')}
                                    </span>
                                    <span className="text-base leading-none mt-0.5">{format(day, 'dd')}</span>
                                    {hasMenu && (
                                        <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-brand-400' : 'bg-green-400'}`} />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                    <button
                        onClick={() => setWeekStart(addDays(weekStart, 7))}
                        className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                    >
                        →
                    </button>
                </div>
            </div>

            <div className="px-1 max-w-2xl mx-auto space-y-6">
                <h2 className="text-gray-800 font-bold text-lg px-2">
                    {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h2>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin text-brand-600 w-10 h-10 mb-4" />
                        <p className="text-gray-500 font-medium tracking-tight">Buscando cardápio...</p>
                    </div>
                ) : !activeTemplate ? (
                    <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
                        <UtensilsCrossed size={48} className="text-gray-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Sem Cardápio Ativo</h3>
                        <p className="text-gray-500 text-sm">Nenhum cardápio foi publicado pela escola ainda.</p>
                    </div>
                ) : !currentContent || !currentContent.description ? (
                    <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center">
                        <UtensilsCrossed size={48} className="text-gray-200 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Nada cadastrado</h3>
                        <p className="text-gray-500 text-sm">Não há informações para este dia ({format(selectedDate, 'EEEE', { locale: ptBR })}).</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
                                    <UtensilsCrossed size={24} />
                                </div>
                                <h3 className="font-bold text-gray-900 text-xl">{currentContent.title || 'Refeição do Dia'}</h3>
                            </div>

                            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-lg font-medium p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                {currentContent.description}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
