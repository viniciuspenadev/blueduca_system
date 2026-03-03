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
        const fetchVisits = async () => {
            try {
                const { data, error } = await supabase
                    .from('leads')
                    .select('id, name, visit_date, phone')
                    .not('visit_date', 'is', null)
                    .gte('visit_date', new Date().toISOString())
                    .order('visit_date', { ascending: true })
                    .limit(5);

                if (error) throw error;
                setVisits(data || []);
            } catch (err) {
                console.error("Erro listando visitas", err);
            } finally {
                setLoading(false);
            }
        };

        fetchVisits();
    }, []);

    if (loading) return <div className="h-64 bg-gray-50 rounded-3xl animate-pulse"></div>;

    return (
        <div className="bg-white rounded-3xl border border-gray-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4 px-6 pt-6 pb-2 border-b border-gray-50/50">
                <h3 className="text-sm lg:text-base font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                        <Calendar className="w-4 h-4" />
                    </div>
                    Próximas Visitas
                </h3>
                <Link to="/admin/leads" className="text-xs font-semibold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors">
                    Ver CRM
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
                {visits.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col justify-center items-center">
                        <Calendar className="w-10 h-10 mb-3 opacity-20 text-gray-400" />
                        <p className="text-sm font-medium">Agenda livre hoje</p>
                        <Link to="/admin/leads" className="mt-3 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg px-3 py-1 text-sm transition-colors">
                            Ir para o funil
                        </Link>
                    </div>
                ) : (
                    visits.map(visit => {
                        const dateObj = new Date(visit.visit_date);
                        const day = dateObj.getDate();
                        const month = dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
                        const time = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                        return (
                            <div key={visit.id} className="flex gap-4 group bg-gray-50/40 border border-gray-100/60 p-3 rounded-2xl hover:bg-white hover:shadow-sm hover:border-gray-200 transition-all duration-300">
                                <div className="bg-white border border-gray-100 shadow-sm text-purple-600 w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 group-hover:border-purple-200 group-hover:bg-purple-50/50 transition-colors">
                                    <span className="text-[10px] uppercase font-semibold text-gray-500 group-hover:text-purple-600">{month}</span>
                                    <span className="text-xl font-bold leading-none">{day}</span>
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <h4 className="font-bold text-gray-900 text-sm truncate group-hover:text-purple-600 transition-colors">{visit.name}</h4>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                                            {time}
                                        </span>
                                        {visit.phone && (
                                            <span className="flex items-center gap-1">
                                                <User className="w-3.5 h-3.5 text-gray-400" />
                                                {visit.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <Link
                                    to={`/admin/leads?id=${visit.id}`}
                                    className="self-center p-2 text-gray-400 hover:text-white hover:bg-purple-600 rounded-xl transition-all shadow-sm border border-transparent hover:border-purple-500 opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100"
                                >
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    );
};
