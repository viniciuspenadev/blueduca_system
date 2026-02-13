import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { CommunicationRecipient } from '../../types';
import CommunicationCard from '../../components/communications/CommunicationCard';
import { Loader2, Search, Filter, MessageCircle } from 'lucide-react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import CommunicationDetail from './CommunicationDetail';

// Simple global cache to prevent reload flash
let cachedRecipients: CommunicationRecipient[] | null = null;

const CommunicationsInbox: React.FC = () => {
    const { user, currentSchool } = useAuth();
    const navigate = useNavigate();
    const [recipients, setRecipients] = useState<CommunicationRecipient[]>(cachedRecipients || []);
    const [loading, setLoading] = useState(!cachedRecipients);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (user && currentSchool) {
            fetchCommunications();
        }
    }, [user, currentSchool]);



    const fetchCommunications = async () => {
        try {
            if (!cachedRecipients) {
                setLoading(true);
            }
            const { data, error } = await supabase
                .from('communication_recipients')
                .select(`
                    *,
                    communication:communications (
                        *,
                        channel:communication_channels (*),
                        sender_profile:profiles!sender_profile_id(name)
                    ),
                    student:students (
                        id,
                        name,
                        class_enrollments (
                            class:classes (id, name)
                        )
                    )
                `)
                .eq('guardian_id', user?.id)
                .eq('is_archived', false)
                .eq('communication.school_id', currentSchool?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const dataWithCast = data as CommunicationRecipient[];
            setRecipients(dataWithCast);
            cachedRecipients = dataWithCast; // Update cache
        } catch (error) {
            console.error('Error fetching communications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCardClick = (recipient: CommunicationRecipient) => {
        // OPTIMISTIC UI: Hide badge immediately
        setRecipients(prev => prev.map(r =>
            r.id === recipient.id ? { ...r, read_at: new Date().toISOString() } : r
        ));
        navigate(`/pais/comunicados/${recipient.communication_id}`);
    };

    const filteredRecipients = recipients.filter((r, index, self) => {
        const title = r.communication?.title.toLowerCase() || '';
        const channelName = r.communication?.channel?.name.toLowerCase() || '';
        const search = searchTerm.toLowerCase();

        // Deduplicate by communication_id
        const isFirstOccurrence = self.findIndex(t => t.communication_id === r.communication_id) === index;
        return isFirstOccurrence && (title.includes(search) || channelName.includes(search));
    });


    return (
        <div className="flex flex-col relative">

            {/* BACKGROUND PATTERN */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-[0.03] pointer-events-none" />

            {/* FILTER BAR - CARD STYLE */}
            <div className="shrink-0 z-10 mb-6">
                <div className="max-w-5xl mx-auto">
                    <div className="bg-white rounded-[24px] p-4 shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="flex-1 relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="text-slate-400 group-focus-within:text-brand-600 transition-colors" size={20} />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar nos comunicados..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-xl py-3 pl-12 pr-4 text-sm font-bold placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all outline-none text-slate-700"
                            />
                        </div>
                        <button className="p-3 bg-slate-50 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all">
                            <Filter size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* LIST AREA */}
            <div className="flex-1 pb-32 relative z-0">
                <div className="max-w-5xl mx-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                            <Loader2 className="animate-spin text-blue-600" size={40} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando Mensagens</span>
                        </div>
                    ) : filteredRecipients.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                            <div className="w-24 h-24 bg-white rounded-[32px] shadow-xl flex items-center justify-center text-slate-100">
                                <MessageCircle size={48} strokeWidth={1} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-slate-800">Tudo em dia!</h3>
                                <p className="text-sm text-slate-400 font-medium">Nenhuma mensagem nova encontrada no momento.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {filteredRecipients.map(recipient => (
                                <CommunicationCard
                                    key={recipient.id}
                                    recipient={recipient}
                                    onClick={() => handleCardClick(recipient)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* STACK NAVIGATION OVERLAY */}
            <Routes>
                <Route path=":id" element={<CommunicationDetail />} />
            </Routes>
        </div>
    );
};

export default CommunicationsInbox;
