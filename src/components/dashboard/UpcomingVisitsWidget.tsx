import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { Calendar, Clock, User, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Visit {
    id: string;
    name: string;
    visit_date: string;
    phone?: string;
}

export const UpcomingVisitsWidget: React.FC = () => {
    const [visits, setVisits] = useState<Visit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchVisits();
    }, []);

    const fetchVisits = async () => {
        const { data } = await supabase
            .from('leads')
            .select('id, name, visit_date, phone')
            .not('visit_date', 'is', null)
            .gte('visit_date', new Date().toISOString())
            .order('visit_date', { ascending: true })
            .limit(5);

        setVisits(data || []);
        setLoading(false);
    };

    if (loading) return <div className="h-40 flex items-center justify-center text-gray-400">Carregando...</div>;

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="text-purple-600" size={18} />
                    Próximas Visitas
                </h3>
                <Link to="/admin/leads" className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline">
                    Ver Agenda
                </Link>
            </div>

            <div className="space-y-3">
                {visits.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg">
                        Nenhuma visita agendada.
                    </div>
                ) : (
                    visits.map(visit => (
                        <div key={visit.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all group">
                            <div className="bg-purple-50 text-purple-600 w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0">
                                <span className="text-xs font-bold">{new Date(visit.visit_date).getDate()}</span>
                                <span className="text-[10px] uppercase">{new Date(visit.visit_date).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-800 text-sm truncate">{visit.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(visit.visit_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    {visit.phone && <span className="flex items-center gap-1"><User size={12} /> {visit.phone}</span>}
                                </div>
                            </div>

                            <Link
                                to={`/admin/leads?id=${visit.id}`} // We'll need to handle this query param in Kanban later if we want deep linking
                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors"
                            >
                                <ArrowRight size={16} />
                            </Link>
                        </div>
                    ))
                )}
            </div>

            {visits.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 text-center">
                    <Link to="/admin/leads" className="text-xs text-gray-500 hover:text-gray-800 font-medium">
                        Ver todas as visitas
                    </Link>
                </div>
            )}
        </div>
    );
};
