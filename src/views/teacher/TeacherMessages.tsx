import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Communication, CommunicationRecipient } from '../../types';
import CommunicationCard from '../../components/communications/CommunicationCard';
import { Loader2, Search, Filter, Plus, MessageSquare, Send, Inbox } from 'lucide-react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import MessageDetail from './MessageDetail';

const TeacherMessages: React.FC = () => {
    const { user, currentSchool } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [communications, setCommunications] = useState<Communication[]>([]);
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
    const [studentNames, setStudentNames] = useState<Record<string, string>>({});
    const [classNames, setClassNames] = useState<Record<string, string>>({});
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const PAGE_SIZE = 10;

    useEffect(() => {
        if (!user || !currentSchool) return;

        // Realtime Subscription - Communications
        const commChannel = supabase.channel('teacher_communications_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'communications',
                    filter: `school_id=eq.${currentSchool.id}`
                },
                async (payload) => {
                    console.log('⚡ [Realtime] Nova comunicação recebida:', payload);
                    const newCommId = payload.new.id;
                    // Fetch full data for the new message
                    const { data: fullComm, error } = await supabase
                        .from('communications')
                        .select(`
                            *,
                            channel:communication_channels (*),
                            sender_profile:profiles!sender_profile_id(name)
                        `)
                        .eq('id', newCommId)
                        .single();

                    if (!error && fullComm) {
                        const comm = fullComm as Communication;
                        // Determine if we should show it based on activeTab
                        const isSent = comm.sender_profile_id === user.id;

                        if ((activeTab === 'sent' && isSent) || (activeTab === 'received' && !isSent)) {
                            // Check filters (e.g. class permissions) if needed, but for now append
                            setCommunications(prev => [comm, ...prev]);

                            // If it's individual, we might need the name
                            if (comm.target_type === 'student' && comm.target_ids?.[0]) {
                                const { data: student } = await supabase
                                    .from('students')
                                    .select('name')
                                    .eq('id', comm.target_ids[0])
                                    .single();

                                if (student) {
                                    setStudentNames(prev => ({ ...prev, [comm.target_ids![0]]: student.name }));
                                }
                            }
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log('📡 [Realtime] Status da conexão Communications:', status);
            });

        // Separate Channel for Replies (Global listener for relevant updates)
        const repliesChannel = supabase.channel('teacher_replies_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'communication_replies'
                },
                (payload) => {
                    console.log('⚡ [Realtime] Nova resposta recebida:', payload);
                    const reply = payload.new;
                    // Optimistically update counts
                    if (!reply.is_admin_reply) {
                        setUnreadCounts(prev => ({
                            ...prev,
                            [reply.communication_id]: (prev[reply.communication_id] || 0) + 1
                        }));
                    }
                }
            )
            .subscribe((status) => {
                console.log('📡 [Realtime] Status da conexão Replies:', status);
            });

        return () => {
            supabase.removeChannel(commChannel);
            supabase.removeChannel(repliesChannel);
        };
    }, [user, currentSchool, activeTab]);

    useEffect(() => {
        if (user && currentSchool) {
            setOffset(0);
            fetchData(true);
        }
    }, [user, currentSchool, activeTab, location.pathname]);



    const fetchCounts = async (commIds: string[]) => {
        if (commIds.length === 0) return;
        try {
            // Fetch all replies for these communications to determine thread status
            const { data: replies } = await supabase
                .from('communication_replies')
                .select('communication_id, guardian_id, is_admin_reply, created_at')
                .in('communication_id', commIds)
                .order('created_at', { ascending: true });

            if (!replies) return;

            const counts: Record<string, number> = {};

            // Group by communication, then by guardian, finding the last message of each thread
            const commThreads: Record<string, Record<string, any>> = {};

            replies.forEach(r => {
                if (!commThreads[r.communication_id]) commThreads[r.communication_id] = {};
                // Overwriting ensures we keep the last message due to order('created_at', ascending)
                commThreads[r.communication_id][r.guardian_id] = r;
            });

            // Count how many threads in each communication have the last message from a parent
            Object.keys(commThreads).forEach(commId => {
                let pendingCount = 0;
                Object.values(commThreads[commId]).forEach(lastMsg => {
                    // If the last message in this thread is NOT from an admin, it's pending a reply
                    if (!lastMsg.is_admin_reply) pendingCount++;
                });
                counts[commId] = pendingCount;
            });

            setUnreadCounts(counts);
        } catch (error) {
            console.error('Error fetching unread counts:', error);
        }
    };

    const fetchData = async (reset = false) => {
        try {
            if (reset) {
                setLoading(true);
                setOffset(0);
            } else {
                setLoadingMore(true);
            }

            const currentOffset = reset ? 0 : offset;
            let fetchedComms: Communication[] = [];

            if (activeTab === 'sent') {
                const { data, error } = await supabase
                    .from('communications')
                    .select(`
                        *,
                        channel:communication_channels (*),
                        sender_profile:profiles!sender_profile_id(name)
                    `)
                    .eq('sender_profile_id', user?.id)
                    .eq('school_id', currentSchool?.id)
                    .order('created_at', { ascending: false })
                    .range(currentOffset, currentOffset + PAGE_SIZE - 1);

                if (error) throw error;
                fetchedComms = data as Communication[];
            } else {
                const { data: teacherClasses } = await supabase
                    .from('class_teachers')
                    .select('class_id')
                    .eq('teacher_id', user?.id)
                    .eq('status', 'ACTIVE');

                const classIds = teacherClasses?.map(c => c.class_id) || [];
                let orConditions = ["target_type.eq.SCHOOL"];
                if (classIds.length > 0) {
                    orConditions.push(`and(target_type.eq.CLASS,target_ids.ov.{${classIds.join(',')}})`);
                }

                const { data, error } = await supabase
                    .from('communications')
                    .select(`
                        *,
                        channel:communication_channels (*),
                        sender_profile:profiles!sender_profile_id(name)
                    `)
                    .eq('school_id', currentSchool?.id)
                    .or(orConditions.join(','))
                    .neq('sender_profile_id', user?.id)
                    .order('created_at', { ascending: false })
                    .range(currentOffset, currentOffset + PAGE_SIZE - 1);

                if (error) throw error;
                fetchedComms = data as Communication[];
            }

            setHasMore(fetchedComms.length === PAGE_SIZE);

            if (reset) {
                setCommunications(fetchedComms);
            } else {
                setCommunications(prev => [...prev, ...fetchedComms]);
            }

            setOffset(currentOffset + fetchedComms.length);
            fetchCounts(fetchedComms.map(c => c.id));

            // Fetch Student Names for Individual Messages
            const studentIds = fetchedComms
                .filter(c => c.target_type === 'student' && c.target_ids?.[0])
                .map(c => c.target_ids![0]);

            if (studentIds.length > 0) {
                const uniqueIds = Array.from(new Set(studentIds));
                const { data: students } = await supabase
                    .from('students')
                    .select('id, name')
                    .in('id', uniqueIds);

                if (students) {
                    const namesMap: Record<string, string> = {};
                    students.forEach(s => {
                        namesMap[s.id] = s.name;
                    });
                    setStudentNames(prev => ({ ...prev, ...namesMap }));
                }
            }

            // Fetch Class Names for Class Messages
            const classIdsToFetch = fetchedComms
                .filter(c => c.target_type === 'CLASS' && c.target_ids && c.target_ids.length > 0)
                .flatMap(c => c.target_ids!);

            if (classIdsToFetch.length > 0) {
                const uniqueClassIds = Array.from(new Set(classIdsToFetch));
                const { data: classes } = await supabase
                    .from('classes')
                    .select('id, name')
                    .in('id', uniqueClassIds);

                if (classes) {
                    const classNamesMap: Record<string, string> = {};
                    classes.forEach(c => {
                        classNamesMap[c.id] = c.name;
                    });
                    setClassNames(prev => ({ ...prev, ...classNamesMap }));
                }
            }
        } catch (error) {
            console.error('Error fetching teacher communications:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleCardClick = (comm: Communication) => {
        setUnreadCounts(prev => ({ ...prev, [comm.id]: 0 }));
        navigate(`${comm.id}`);
    };

    const filteredComms = communications.filter(comm => {
        const title = comm.title.toLowerCase();
        const search = searchTerm.toLowerCase();
        return title.includes(search);
    });

    const wrapAsRecipient = (comm: Communication): CommunicationRecipient => {
        let recipientLabel = '';
        if (comm.target_type === 'SCHOOL') {
            recipientLabel = 'Escola Toda';
        } else if (comm.target_type === 'CLASS') {
            const cIds = comm.target_ids || [];
            recipientLabel = cIds.map(id => classNames[id] || 'Turma').join(', ');
        } else if (comm.target_type === 'student') {
            // Use fetched name or fallback
            const studentId = comm.target_ids?.[0] || '';
            const studentName = studentNames[studentId] || 'Individual';
            recipientLabel = studentName;
        }

        return {
            id: comm.id,
            communication_id: comm.id,
            communication: comm,
            read_at: new Date().toISOString(),
            is_archived: false,
            created_at: comm.created_at,
            student_id: comm.target_ids?.[0] || '',
            guardian_id: '',
            student: recipientLabel ? {
                id: comm.target_ids?.[0] || '',
                name: recipientLabel, // Pass the name here
                class_enrollments: [
                    {
                        class: {
                            id: '',
                            name: comm.target_type === 'student' ? 'Individual' : recipientLabel
                        }
                    }
                ]
            } : undefined
        } as CommunicationRecipient;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <div className="p-4 md:p-6 bg-white border-b border-slate-100 sticky top-0 z-20 pt-safe-area">
                <div className="max-w-5xl mx-auto flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <MessageSquare className="text-brand-600" size={24} />
                                Mensagens
                            </h1>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Portal de Comunicação do Professor
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/comunicados/novo')}
                            className="w-12 h-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-200 active:scale-90 transition-all"
                        >
                            <Plus size={24} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar conversas..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-4 pl-12 text-sm font-bold text-slate-600 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all outline-none"
                            />
                        </div>
                        <button className="p-3 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                            <Filter size={20} />
                        </button>
                    </div>

                    <div className="flex p-1 bg-slate-100 rounded-2xl">
                        <button
                            onClick={() => setActiveTab('sent')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'sent' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            <Send size={14} />
                            Enviadas
                        </button>
                        <button
                            onClick={() => setActiveTab('received')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'received' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400'}`}
                        >
                            <Inbox size={14} />
                            Recebidas
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
                <div className="max-w-5xl mx-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                            <Loader2 className="animate-spin text-brand-600" size={40} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Carregando Mensagens...</span>
                        </div>
                    ) : filteredComms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                            <div className="w-24 h-24 bg-white rounded-[32px] shadow-sm flex items-center justify-center text-slate-200">
                                <MessageSquare size={48} strokeWidth={1} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-slate-800">Silêncio por aqui...</h3>
                                <p className="text-sm text-slate-400 font-medium">Você ainda não tem mensagens nesta categoria.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredComms.map(comm => (
                                <div key={comm.id} className="relative group">
                                    <CommunicationCard
                                        recipient={wrapAsRecipient(comm)}
                                        onClick={() => handleCardClick(comm)}
                                    />
                                    {unreadCounts[comm.id] > 0 && (
                                        <div className="absolute top-1/2 -translate-y-1/2 right-4 w-6 h-6 bg-brand-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce-subtle z-10">
                                            {unreadCounts[comm.id]}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {hasMore && (
                                <div className="pt-4 pb-8 flex justify-center">
                                    <button
                                        onClick={() => fetchData(false)}
                                        disabled={loadingMore}
                                        className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {loadingMore ? (
                                            <>
                                                <Loader2 className="animate-spin" size={14} />
                                                Carregando...
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={14} />
                                                Carregar Mais
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <Routes>
                <Route path=":id" element={<MessageDetail />} />
            </Routes>
        </div>
    );
};

export default TeacherMessages;
