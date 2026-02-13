import { type FC, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MuralEvent {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    image_url?: string;
    category?: 'event' | 'notice' | 'alert' | 'mural';
    location?: string;
    type?: string;
}

export const MuralDetails: FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentSchool } = useAuth();
    const [event, setEvent] = useState<MuralEvent | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchEvent();
    }, [id, currentSchool]);

    const fetchEvent = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('id', id)
                .eq('school_id', currentSchool?.id)
                .single();

            if (error) throw error;
            setEvent(data);
        } catch (error) {
            console.error('Error fetching event:', error);
            navigate('/pais/home');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>;
    }

    if (!event) return null;

    const eventDate = new Date(event.start_time);

    return (
        <div className="pb-24">
            <div className="flex items-center gap-3 mb-6 px-1">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl font-bold text-gray-800">Detalhes</h2>
            </div>
            {event.image_url && (
                <div className="w-full h-64 md:h-96 relative">
                    <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            <div className="px-5 py-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <span className={`
                                text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider
                                ${event.category === 'alert' ? 'bg-red-100 text-red-700' :
                                event.category === 'notice' ? 'bg-brand-100 text-brand-700' :
                                    'bg-gray-100 text-gray-700'}
                            `}>
                            {event.category === 'alert' ? 'Alerta' :
                                event.category === 'notice' ? 'Aviso' : 'Cursos e Eventos'}
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-4">
                        {event.title}
                    </h2>

                    <div className="flex flex-col gap-3 text-gray-500 text-sm mb-6 pb-6 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-brand-500" />
                            <span>{format(eventDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
                        </div>
                        {event.category === 'event' && (
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-brand-500" />
                                <span>Horário: {format(eventDate, 'HH:mm')}</span>
                            </div>
                        )}
                        {event.location && (
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-brand-500" />
                                <span>Local: {event.location}</span>
                            </div>
                        )}
                    </div>

                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap font-medium text-lg">
                        {event.description || 'Sem descrição detalhada disponível.'}
                    </div>
                </div>
            </div>
        </div>
    );
};
