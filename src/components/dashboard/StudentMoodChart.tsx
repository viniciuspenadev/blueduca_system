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

    if (loading) return <div className="h-40 animate-pulse bg-gray-50 rounded-xl" />;

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
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">Humor dos Alunos</h3>
                    <p className="text-[10px] text-gray-400">Registrado hoje</p>
                </div>
                <div className="p-2 rounded-full bg-purple-50 text-purple-600">
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
                                <span className="flex items-center gap-1.5 ">
                                    {getMoodIcon(mood)} {mood}
                                </span>
                                <span>{count} ({getPercentage(count)}%)</span>
                            </div>
                            <div className="w-full bg-gray-50 rounded-full h-1.5 overflow-hidden">
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
