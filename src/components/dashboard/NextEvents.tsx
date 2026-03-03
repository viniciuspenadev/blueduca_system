import { type FC, useEffect, useState } from 'react';
import { Button } from '../ui';
import { supabase } from '../../services/supabase';
import { Calendar, MapPin, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SchoolEvent {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
    location?: string;
    description?: string;
}

export const NextEvents: FC = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState<SchoolEvent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNextEvents();
    }, []);

    const fetchNextEvents = async () => {
        try {
            // Fetch tasks closer to now
            const now = new Date().toISOString();

            // Correct table name: 'events' (verified from Agenda.tsx)
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .gte('start_time', now)
                .order('start_time', { ascending: true })
                .limit(5);

            if (error) {
                console.error('Error fetching events:', error);
                setEvents([]);
                return;
            }

            // Transform data to match component state
            // Map event types to colors (logic from Agenda.tsx)
            const mappedEvents = data?.map(ev => ({
                id: ev.id,
                title: ev.title,
                start_time: ev.start_time,
                end_time: ev.start_time, // fallback
                location: ev.type === 'meeting' ? 'Sala de Reuniões' : undefined,
                color: ev.type === 'academic' ? '#3b82f6' :
                    ev.type === 'holiday' ? '#ef4444' :
                        ev.type === 'meeting' ? '#a855f7' : '#6b7280'
            })) || [];

            setEvents(mappedEvents);
        } catch (error) {
            console.error('Error in fetchNextEvents:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="h-full min-h-[300px] p-6 animate-pulse bg-gray-50/50">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
            <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-xl"></div>)}
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-3xl border border-gray-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4 px-6 pt-6 pb-2 border-b border-gray-50/50">
                <h3 className="text-sm lg:text-base font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
                        <Calendar className="w-4 h-4" />
                    </div>
                    Próximos Eventos
                </h3>
                <Button variant="ghost" size="sm" onClick={() => navigate('/agenda')} className="text-xs text-brand-600 hover:bg-brand-50 rounded-lg px-3">
                    Ver todos
                </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-6 pb-6 custom-scrollbar">
                {events.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col justify-center items-center">
                        <Calendar className="w-10 h-10 mb-3 opacity-20 text-gray-400" />
                        <p className="text-sm font-medium">Nenhum evento próximo</p>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/agenda')} className="mt-3 text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg">
                            Agendar nova data
                        </Button>
                    </div>
                ) : (
                    events.map(event => {
                        const date = new Date(event.start_time);
                        const day = date.getDate();
                        const month = date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
                        const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        return (
                            <div key={event.id} className="flex gap-4 group cursor-pointer bg-gray-50/40 border border-gray-100/60 p-3 rounded-2xl hover:bg-white hover:shadow-sm hover:border-gray-200 transition-all duration-300" onClick={() => navigate('/agenda')}>
                                <div className="flex flex-col items-center justify-center bg-brand-50 rounded-xl w-14 h-14 shrink-0 text-brand-700">
                                    <span className="text-xs font-bold uppercase">{month}</span>
                                    <span className="text-xl font-bold leading-none">{day}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                                        {event.title}
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {time}
                                        </span>
                                        {event.location && (
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {event.location}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className="w-1 self-stretch rounded-full my-1 opacity-50"
                                    style={{ backgroundColor: event.color || '#e2e8f0' }}
                                ></div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
