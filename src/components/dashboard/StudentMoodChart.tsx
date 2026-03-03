import { type FC, useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Smile, Frown, Meh, Thermometer } from 'lucide-react';

export const StudentMoodChart: FC = () => {
    const [loading, setLoading] = useState(true);
    const [moods, setMoods] = useState<Record<string, number>>({});
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchMoods();
    }, []);

    const fetchMoods = async () => {
        try {
            const today = new Date().toLocaleDateString('en-CA');

            const { data: reports, error } = await supabase
                .from('daily_reports')
                .select('routine_data')
                .eq('date', today);

            if (error) throw error;

            const counts: Record<string, number> = { 'Feliz': 0, 'Cansado': 0, 'Choroso': 0, 'Doente': 0 };
            let totalCount = 0;

            reports?.forEach((r: any) => {
                const mood = r.routine_data?.mood;
                if (mood && counts[mood] !== undefined) {
                    counts[mood]++;
                    totalCount++;
                }
            });

            setMoods(counts);
            setTotal(totalCount);
        } catch (error) {
            console.error('Error fetching mood stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="bg-white rounded-3xl border border-gray-100/80 p-6 shadow-sm h-full overflow-hidden flex flex-col animate-pulse">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-2">
                    <div className="h-3 w-28 bg-gray-200 rounded"></div>
                    <div className="h-2 w-20 bg-gray-100 rounded"></div>
                </div>
                <div className="w-9 h-9 bg-gray-100 rounded-2xl"></div>
            </div>
            <div className="space-y-4 mt-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="space-y-2">
                        <div className="flex justify-between">
                            <div className="h-3 w-16 bg-gray-200 rounded"></div>
                            <div className="h-3 w-8 bg-gray-200 rounded"></div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5"></div>
                    </div>
                ))}
            </div>
        </div>
    );

    const getMoodIcon = (mood: string) => {
        switch (mood) {
            case 'Feliz': return <Smile className="w-4 h-4 text-green-600" />;
            case 'Cansado': return <Meh className="w-4 h-4 text-amber-600" />;
            case 'Choroso': return <Frown className="w-4 h-4 text-blue-600" />;
            case 'Doente': return <Thermometer className="w-4 h-4 text-red-600" />;
            default: return <Smile className="w-4 h-4" />;
        }
    };

    const getPercentage = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;

    return (
        <div className="bg-white rounded-3xl border border-gray-100/80 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 h-full overflow-hidden flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">Humor dos Alunos</h3>
                    <p className="text-[10px] text-gray-400">Registrado hoje</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600">
                    <Smile className="w-5 h-5" />
                </div>
            </div>

            {total === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-xs">
                    <Smile className="w-8 h-8 mb-2 opacity-20" />
                    Sem registros hoje
                </div>
            ) : (
                <div className="space-y-3">
                    {Object.entries(moods).map(([mood, count]) => (
                        <div key={mood} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium text-gray-600">
                                <span className="flex items-center gap-2 ">
                                    <div className={`p-1 rounded-md ${mood === 'Feliz' ? 'bg-green-50' : mood === 'Cansado' ? 'bg-amber-50' : mood === 'Choroso' ? 'bg-blue-50' : 'bg-red-50'}`}>
                                        {getMoodIcon(mood)}
                                    </div>
                                    {mood}
                                </span>
                                <span className="text-gray-900 font-bold">{count} <span className="text-[10px] text-gray-400 font-normal">({getPercentage(count)}%)</span></span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${mood === 'Feliz' ? 'bg-green-400' :
                                        mood === 'Cansado' ? 'bg-amber-400' :
                                            mood === 'Choroso' ? 'bg-blue-400' : 'bg-red-400'
                                        }`}
                                    style={{ width: `${getPercentage(count)}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
