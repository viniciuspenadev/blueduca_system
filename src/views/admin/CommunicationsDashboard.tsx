import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Icons from 'lucide-react';
import { Loader2, Plus, CheckCircle2, XCircle, Send, MessageSquare, FileText, Users, Search, AlertCircle, Sparkles, Smile, Filter } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface CommunicationStats {
    id: string;
    title: string;
    created_at: string;
    content: string;
    channel: { name: string; color: string; icon_name: string };
    total_recipients: number;
    read_count: number;
    responses?: {
        response: any;
        guardian: { name: string; avatar_url?: string };
        answered_at?: string;
    }[];
    metadata?: any;
    reply_count?: number;
    priority?: number;
    sender_profile?: { name: string };
    pending_count?: number;
    target_type?: string;
    target_ids?: string[];
    target_names?: string[];
}

interface Conversation {
    guardian_id: string;
    guardian_name: string;
    avatar_url?: string;
    last_message_at: string;
    messages: {
        id: string;
        content: string;
        created_at: string;
        is_admin_reply: boolean;
        sender_name?: string;
    }[];
    needs_reply?: boolean;
    unread_count?: number;
}

const CommunicationsDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, currentSchool } = useAuth();
    const [stats, setStats] = useState<CommunicationStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedComm, setSelectedComm] = useState<CommunicationStats | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'messages'>('overview');


    const [studentNames, setStudentNames] = useState<Record<string, string>>({}); // Store student names

    // Conversation State
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [responseMessage, setResponseMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchDebounce, setSearchDebounce] = useState('');
    const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Auto-scroll ref
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Scroll effect
    useEffect(() => {
        scrollToBottom();
    }, [conversations, selectedConversationId, activeTab]); // Re-run when list changes or active conversation changes



    // RSVP Modal State
    const [isRSVPModalOpen, setIsRSVPModalOpen] = useState(false);
    const [rsvpSort, setRsvpSort] = useState<'name' | 'status' | 'date'>('date');
    const [rsvpSortDir, setRsvpSortDir] = useState<'asc' | 'desc'>('desc');

    const handleExportCSV = () => {
        if (!selectedComm?.responses) return;

        const headers = ['Responsável', 'Resposta', 'Data'];
        const rows = selectedComm.responses.map(r => [
            r.guardian.name,
            r.response.selected_option,
            format(new Date(r.answered_at || ''), "dd/MM/yyyy HH:mm", { locale: ptBR })
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `rsvp_lista_${selectedComm.title.replace(/\s+/g, '_').toLowerCase()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getSortedRSVP = () => {
        if (!selectedComm?.responses) return [];

        return [...selectedComm.responses].sort((a, b) => {
            let valA: any, valB: any;

            switch (rsvpSort) {
                case 'name':
                    valA = a.guardian.name.toLowerCase();
                    valB = b.guardian.name.toLowerCase();
                    break;
                case 'status':
                    valA = a.response.selected_option === 'Estarei Presente' ? 1 : 0;
                    valB = b.response.selected_option === 'Estarei Presente' ? 1 : 0;
                    break;
                case 'date':
                default:
                    valA = new Date(a.answered_at || '').getTime();
                    valB = new Date(b.answered_at || '').getTime();
                    break;
            }

            if (valA < valB) return rsvpSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return rsvpSortDir === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const fetchChannels = async () => {
        if (!currentSchool) return;
        const { data } = await supabase
            .from('communication_channels')
            .select('id, name')
            .or(`school_id.eq.${currentSchool.id},school_id.is.null`);

        if (data) setChannels(data);
    };

    useEffect(() => {
        if (currentSchool) {
            setStats([]);
            setPage(1);
            setHasMore(true);
            fetchChannels();
            loadCommunications(1, true); // Initial Load
        }
    }, [currentSchool, selectedChannelId, searchDebounce]); // Reload on filter change

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchDebounce(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const loadCommunications = async (pageToLoad: number, refresh = false) => {
        if (!currentSchool) return;
        if (pageToLoad === 1) setLoading(true);

        try {
            console.log('⚡ [Optimized] Buscando comunicados via RPC...');
            const { data, error } = await supabase.rpc('get_communications_dashboard_metrics', {
                p_school_id: currentSchool.id,
                p_page: pageToLoad,
                p_limit: 15,
                p_search: searchDebounce,
                p_channel_id: selectedChannelId || undefined
            });

            if (error) throw error;

            const newItems = data || [];
            if (newItems.length < 15) setHasMore(false);
            else setHasMore(true);

            // Transform RPC result to match interface if needed (RPC returns responses_json as jsonb)
            const formattedItems: CommunicationStats[] = newItems.map((item: any) => ({
                ...item,
                channel: item.channel_json,
                responses: item.responses_json ? (typeof item.responses_json === 'string' ? JSON.parse(item.responses_json) : item.responses_json) : [],
                sender_profile: { name: item.sender_name }
            }));

            if (refresh || pageToLoad === 1) {
                setStats(formattedItems);
            } else {
                setStats(prev => [...prev, ...formattedItems]);
            }

            // Fetch Student Names (Client-side augmentation for specific student targets)
            const studentIds = formattedItems
                .filter(c => c.target_type === 'STUDENT' && c.target_ids?.[0])
                .map(c => c.target_ids![0]);

            if (studentIds.length > 0) {
                const { data: students } = await supabase
                    .from('students')
                    .select('id, name')
                    .in('id', Array.from(new Set(studentIds)));

                if (students) {
                    const namesMap: Record<string, string> = {};
                    students.forEach(s => namesMap[s.id] = s.name);
                    setStudentNames(prev => ({ ...prev, ...namesMap }));
                }
            }

        } catch (err) {
            console.error('Erro ao carregar comunicados:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        loadCommunications(nextPage);
    };

    // Subscribe to Realtime Updates
    useEffect(() => {
        if (!currentSchool) return;

        const channel = supabase.channel('admin_communications_dashboard')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'communication_replies'
                },
                async (payload) => {
                    console.log('⚡ [Realtime Admin] Nova resposta recebida:', payload);
                    const newReply = payload.new;

                    // Update stats (pending count)
                    setStats(prev => prev.map(s => {
                        if (s.id === newReply.communication_id) {
                            return {
                                ...s,
                                pending_count: !newReply.is_admin_reply ? (s.pending_count || 0) + 1 : s.pending_count,
                                reply_count: !newReply.is_admin_reply ? (s.reply_count || 0) : s.reply_count
                            };
                        }
                        return s;
                    }));

                    // Update conversations if we are viewing this communication
                    if (selectedComm?.id === newReply.communication_id) {
                        // Refetch to be safe or use payload
                        const { data: fullReply, error } = await supabase
                            .from('communication_replies')
                            .select('*, guardian:profiles(name)')
                            .eq('id', newReply.id)
                            .single();

                        console.log('⚡ [Realtime Admin] Dados completos da resposta:', fullReply);

                        if (!error && fullReply) {
                            setConversations(prev => {
                                const targetGuardianId = fullReply.guardian_id;
                                const exists = prev.some(c => c.guardian_id === targetGuardianId);

                                const guardianName = (Array.isArray(fullReply.guardian) ? fullReply.guardian[0]?.name : fullReply.guardian?.name) || 'Responsável';

                                if (exists) {
                                    return prev.map(c =>
                                        c.guardian_id === targetGuardianId
                                            ? {
                                                ...c,
                                                messages: c.messages.some(m => m.id === fullReply.id) ? c.messages : [...c.messages, {
                                                    id: fullReply.id,
                                                    content: fullReply.content,
                                                    created_at: fullReply.created_at,
                                                    is_admin_reply: fullReply.is_admin_reply,
                                                    sender_name: fullReply.is_admin_reply ? 'Escola' : guardianName
                                                }],
                                                last_message_at: fullReply.created_at,
                                                unread_count: !fullReply.is_admin_reply ? (c.unread_count || 0) + 1 : 0,
                                                needs_reply: !fullReply.is_admin_reply
                                            } : c
                                    ).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
                                } else {
                                    // New Conversation
                                    return [{
                                        guardian_id: targetGuardianId,
                                        guardian_name: guardianName,
                                        avatar_url: undefined,
                                        last_message_at: fullReply.created_at,
                                        messages: [{
                                            id: fullReply.id,
                                            content: fullReply.content,
                                            created_at: fullReply.created_at,
                                            is_admin_reply: fullReply.is_admin_reply,
                                            sender_name: fullReply.is_admin_reply ? 'Escola' : guardianName
                                        }],
                                        unread_count: !fullReply.is_admin_reply ? 1 : 0,
                                        needs_reply: !fullReply.is_admin_reply
                                    }, ...prev];
                                }
                            });
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'communications',
                    filter: `school_id=eq.${currentSchool.id}`
                },
                async (payload) => {
                    console.log('⚡ [Realtime Admin] Comunicação atualizada (Global Trigger):', payload);
                    const commId = payload.new.id;
                    setStats(prev => prev.map(s => {
                        if (s.id === commId) {
                            return { ...s, _force_refresh: Date.now() };
                        }
                        return s;
                    }));

                    // Calculate correct Pending Count (Threads needing reply)
                    const { data: allReplies } = await supabase
                        .from('communication_replies')
                        .select('guardian_id, is_admin_reply, created_at')
                        .eq('communication_id', commId)
                        .order('created_at', { ascending: true });

                    if (allReplies) {
                        const threads: Record<string, any[]> = {};
                        allReplies.forEach(r => {
                            if (!threads[r.guardian_id]) threads[r.guardian_id] = [];
                            threads[r.guardian_id].push(r);
                        });

                        let newPendingCount = 0;
                        Object.values(threads).forEach(threadMsgs => {
                            const lastMsg = threadMsgs[threadMsgs.length - 1];
                            if (!lastMsg.is_admin_reply) newPendingCount++;
                        });

                        // Count unique chats (guardians that have replied)
                        const uniqueGuardians = new Set(allReplies.map(r => r.guardian_id)).size;

                        setStats(prev => prev.map(s => s.id === commId ? { ...s, reply_count: uniqueGuardians, pending_count: newPendingCount } : s));
                    }
                }
            )

            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'communication_replies',
                    filter: 'is_admin_reply=eq.false'
                },
                async (payload) => {
                    console.log('⚡ [Realtime Admin] Nova resposta recebida (Direct Listener):', payload);
                    const newReply = payload.new;

                    // Direct update: Re-fetch stats to ensure Uniqueness logic
                    if (newReply.communication_id) {
                        const { data: allReplies } = await supabase
                            .from('communication_replies')
                            .select('guardian_id, is_admin_reply, created_at')
                            .eq('communication_id', newReply.communication_id)
                            .order('created_at', { ascending: true });

                        if (allReplies) {
                            const threads: Record<string, any[]> = {};
                            allReplies.forEach(r => {
                                if (!threads[r.guardian_id]) threads[r.guardian_id] = [];
                                threads[r.guardian_id].push(r);
                            });

                            let newPendingCount = 0;
                            Object.values(threads).forEach(threadMsgs => {
                                const lastMsg = threadMsgs[threadMsgs.length - 1];
                                if (!lastMsg.is_admin_reply) newPendingCount++;
                            });

                            const uniqueGuardians = new Set(allReplies.map(r => r.guardian_id)).size;

                            setStats(prev => prev.map(s => s.id === newReply.communication_id ? {
                                ...s,
                                reply_count: uniqueGuardians,
                                pending_count: newPendingCount
                            } : s));
                        }
                    }

                    // If selected, refresh conversations
                    if (selectedComm?.id === newReply.communication_id) {
                        console.log('⚡ [Realtime Admin] Refreshing conversations (Direct)...');
                        await fetchConversations(newReply.communication_id);
                    }
                }
            )
            .subscribe((status) => {
                console.log('📡 [Realtime Admin] Status da conexão:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentSchool, selectedComm]);

    // Dedicated listener for Selected Communication (Robust Chat Updates)
    useEffect(() => {
        if (!selectedComm?.id) return;

        console.log('📡 [Realtime Admin] Conectando ao canal específico:', selectedComm.id);
        const channel = supabase.channel(`comm_specific_${selectedComm.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'communications',
                    filter: `id=eq.${selectedComm.id}`
                },
                async (payload) => {
                    console.log('⚡ [Realtime Admin] Chat Atualizado (ID Trigger):', payload);
                    // Force fetch conversations
                    await fetchConversations(selectedComm.id);
                }
            )
            .subscribe((status) => {
                console.log(`📡 [Realtime Admin] Status conexão chat ${selectedComm.id}:`, status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedComm?.id]);

    useEffect(() => {
        if (selectedComm) {
            fetchConversations(selectedComm.id);
            setActiveTab('overview');
        } else {
            setConversations([]);
            setSelectedConversationId(null);
        }
    }, [selectedComm]);



    const fetchConversations = async (commId: string) => {
        setLoadingConversations(true);
        try {
            const { data, error } = await supabase
                .from('communication_replies')
                .select(`
                    id, content, created_at, guardian_id, is_admin_reply,
                    guardian: profiles!guardian_id!inner(name)
                `)
                .eq('communication_id', commId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const grouped: Record<string, Conversation> = {};

            data?.forEach((msg: any) => {
                if (!grouped[msg.guardian_id]) {
                    grouped[msg.guardian_id] = {
                        guardian_id: msg.guardian_id,
                        guardian_name: (Array.isArray(msg.guardian) ? msg.guardian[0]?.name : msg.guardian?.name) || 'Responsável',
                        avatar_url: undefined,
                        last_message_at: msg.created_at,
                        messages: []
                    };
                }
                const guardianName = Array.isArray(msg.guardian) ? msg.guardian[0]?.name : msg.guardian?.name;
                grouped[msg.guardian_id].messages.push({
                    id: msg.id,
                    content: msg.content,
                    created_at: msg.created_at,
                    is_admin_reply: msg.is_admin_reply,
                    sender_name: msg.is_admin_reply ? 'Escola' : (guardianName || 'Responsável')
                });
                if (new Date(msg.created_at) > new Date(grouped[msg.guardian_id].last_message_at)) {
                    grouped[msg.guardian_id].last_message_at = msg.created_at;
                }
            });

            const sorted = Object.values(grouped).sort((a, b) =>
                new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
            );

            const conversationsWithReplyStatus = sorted.map(conv => {
                const lastMessage = conv.messages[conv.messages.length - 1];
                let lastAdminIndex = -1;
                for (let i = conv.messages.length - 1; i >= 0; i--) {
                    if (conv.messages[i].is_admin_reply) {
                        lastAdminIndex = i;
                        break;
                    }
                }
                const unreadCount = conv.messages.length - 1 - lastAdminIndex;
                const needsReply = lastMessage ? !lastMessage.is_admin_reply : false;
                return { ...conv, needs_reply: needsReply, unread_count: Math.max(0, unreadCount) };
            });

            // Resolve Real Names for Guardians
            const guardianIds = conversationsWithReplyStatus.map(c => c.guardian_id);
            if (guardianIds.length > 0) {
                const { data: relations } = await supabase
                    .from('student_guardians')
                    .select('guardian_id, student:students(id, name, financial_responsible)')
                    .in('guardian_id', guardianIds);

                if (relations) {
                    const nameMap: Record<string, string> = {};
                    relations.forEach((rel: any) => {
                        // Try to find a better name
                        if (!nameMap[rel.guardian_id]) {
                            const student = rel.student;
                            if (student) {
                                // Check if this guardian is the financial responsible
                                // We don't have exact link, but we can try to trust the name if it's generic
                                nameMap[rel.guardian_id] = `Responsável (${student.name.split(' ')[0]})`;

                                // If financial responsible name exists, maybe use it? 
                                // But we can't be sure THIS guardian is THAT person without more checks.
                                // Safest bet for now -> "Responsável (Student Name)" which is always true.
                            }
                        }
                    });

                    // Update conversations with better names
                    conversationsWithReplyStatus.forEach(conv => {
                        if (conv.guardian_name === 'Responsável' && nameMap[conv.guardian_id]) {
                            conv.guardian_name = nameMap[conv.guardian_id];
                            // Also update sender_name in messages
                            conv.messages.forEach(m => {
                                if (!m.is_admin_reply && m.sender_name === 'Responsável') {
                                    m.sender_name = nameMap[conv.guardian_id];
                                }
                            });
                        }
                    });
                }
            }

            setConversations(conversationsWithReplyStatus);

            if (conversationsWithReplyStatus.length > 0 && !selectedConversationId) {
                const needsReplyConv = conversationsWithReplyStatus.find(c => c.needs_reply);
                setSelectedConversationId(needsReplyConv ? needsReplyConv.guardian_id : conversationsWithReplyStatus[0].guardian_id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingConversations(false);
        }
    };

    const handleSendReply = async () => {
        if (!selectedComm || !selectedConversationId || !responseMessage.trim() || !user) return;
        setSendingReply(true);
        try {
            const { data, error } = await supabase.from('communication_replies').insert({
                communication_id: selectedComm.id,
                guardian_id: selectedConversationId,
                content: responseMessage,
                is_admin_reply: true
            }).select('id, content, created_at, is_admin_reply').single();

            if (error) throw error;

            // OPTIMISTIC UI: Add real message directly
            const newReply = {
                ...data,
                sender_name: 'Escola'
            };

            setConversations(prev => prev.map(c =>
                c.guardian_id === selectedConversationId
                    ? {
                        ...c,
                        messages: c.messages.some(m => m.id === newReply.id)
                            ? c.messages
                            : [...c.messages, newReply],
                        last_message_at: newReply.created_at,
                        needs_reply: false,
                        unread_count: 0
                    }
                    : c
            ));

            setStats(prev => prev.map(s =>
                s.id === selectedComm.id
                    ? { ...s, pending_count: Math.max(0, (s.pending_count || 0) - 1) }
                    : s
            ));

            setResponseMessage('');
            setIsEmojiPickerOpen(false);


        } catch (err) {
            console.error(err);
            alert('Erro ao enviar resposta.');
        } finally {
            setSendingReply(false);
        }
    };

    const calculatePercentage = (part: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((part / total) * 100);
    };

    const activeConversation = conversations.find(c => c.guardian_id === selectedConversationId);

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden font-sans">
            {/* LEFT SIDEBAR: LIST */}
            <div className="w-80 flex flex-col border-r border-gray-200 bg-slate-50 shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20">
                {/* Header */}
                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
                    <h2 className="font-outfit font-bold text-xl text-gray-900 tracking-tight">Comunicados</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => navigate('/admin/comunicados/novo')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-blue-200 shadow-md"
                        >
                            <Plus size={18} />
                            Novo
                        </button>
                    </div>
                </div>

                {/* Search Bar & Filters */}
                <div className="px-5 py-4 flex flex-col gap-3 bg-slate-50">
                    <div className="flex gap-2">
                        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center px-3.5 py-2.5 transition-all focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50 shadow-sm">
                            <Search size={16} className="text-gray-400" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none text-sm w-full focus:ring-0 ml-2.5 placeholder-gray-400 text-gray-700 outline-none"
                                placeholder="Buscar título..."
                            />
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`h-full aspect-square flex items-center justify-center rounded-xl border transition-all ${selectedChannelId
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                                    : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'}`}
                            >
                                <Filter size={18} />
                            </button>

                            {isFilterOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setIsFilterOpen(false)}
                                    />
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-2 space-y-1">
                                            <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Filtrar por Canal</div>
                                            <button
                                                onClick={() => { setSelectedChannelId(null); setIsFilterOpen(false); }}
                                                className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-between ${!selectedChannelId ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                            >
                                                Todos
                                                {!selectedChannelId && <CheckCircle2 size={14} />}
                                            </button>
                                            {channels.map(ch => (
                                                <button
                                                    key={ch.id}
                                                    onClick={() => { setSelectedChannelId(ch.id); setIsFilterOpen(false); }}
                                                    className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-between ${selectedChannelId === ch.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                                >
                                                    {ch.name}
                                                    {selectedChannelId === ch.id && <CheckCircle2 size={14} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>


                </div>

                {/* List Items */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
                    {loading && page === 1 ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
                    ) : (
                        <div className="space-y-3">
                            {stats.map(item => {
                                // @ts-ignore
                                const Icon = Icons[item.channel.icon_name.charAt(0).toUpperCase() + item.channel.icon_name.slice(1)] || Icons.MessageSquare;
                                const isSelected = selectedComm?.id === item.id;
                                const readRate = calculatePercentage(item.read_count, item.total_recipients);
                                const isUrgent = item.priority === 2;
                                const isInteractive = item.metadata?.template;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedComm(item)}
                                        className={`group p-4 rounded-xl cursor-pointer transition-all border relative overflow-hidden flex flex-col gap-2 ${isSelected
                                            ? 'bg-white border-blue-500 shadow-md ring-4 ring-blue-50/50 z-10'
                                            : 'bg-white border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 bg-${item.channel.color}-50 text-${item.channel.color}-700 border border-${item.channel.color}-100`}>
                                                    <Icon size={10} strokeWidth={3} />
                                                    {item.channel.name}
                                                </div>
                                                {isUrgent && (
                                                    <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-red-600 animate-pulse">
                                                        <AlertCircle size={10} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-0.5 text-[10px] font-medium text-gray-400">
                                                <div className="flex items-center gap-1.5 truncate">

                                                    <span className="text-gray-600 font-bold truncate max-w-[120px]">
                                                        {item.target_type === 'STUDENT' && item.target_ids?.[0] && studentNames[item.target_ids[0]]
                                                            ? `Para: ${studentNames[item.target_ids[0]]}`
                                                            : (item.sender_profile?.name?.split(' ')[0] || 'Escola')}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{format(new Date(item.created_at), "dd MMM", { locale: ptBR })}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <h3 className={`text-sm font-bold leading-snug line-clamp-2 ${isSelected ? 'text-gray-900' : 'text-gray-700 group-hover:text-blue-700 transition-colors'}`}>
                                            {item.title}
                                        </h3>

                                        {/* Target Badge for List */}
                                        {/* Target Badge for List */}
                                        <div className="flex flex-wrap gap-1 mt-2 min-h-[20px]">
                                            {item.target_type === 'SCHOOL' && (
                                                <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-blue-100 flex items-center gap-1">
                                                    <Users size={8} />
                                                    Todas as Turmas
                                                </span>
                                            )}

                                            {item.target_names && item.target_names.length > 0 && (
                                                <>
                                                    {item.target_names.slice(0, 2).map((name, idx) => (
                                                        <span key={idx} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold border border-slate-200">
                                                            {name}
                                                        </span>
                                                    ))}
                                                    {item.target_names.length > 2 && (
                                                        <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-bold border border-slate-200">
                                                            +{item.target_names.length - 2}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-50 mt-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div style={{ width: `${readRate}%` }} className={`h-full rounded-full ${readRate > 50 ? 'bg-green-500' : 'bg-blue-500'}`} />
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-500">{readRate}% lido</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {isInteractive && (
                                                    <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-bold border border-purple-100">
                                                        <Sparkles size={10} />
                                                        {item.metadata.template === 'rsvp' ? 'RSVP' : 'Interação'}
                                                    </div>
                                                )}
                                                {(item.pending_count || 0) > 0 ? (
                                                    <div className="flex items-center gap-1.5 text-white bg-red-500 px-2 py-0.5 rounded-full text-[10px] shadow-sm animate-pulse font-bold">
                                                        <MessageSquare size={10} strokeWidth={3} />
                                                        {item.pending_count}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                                        <MessageSquare size={12} />
                                                        <span className="font-bold">{item.reply_count}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && hasMore && (
                        <div className="mt-4 flex justify-center pb-4">
                            <button
                                onClick={handleLoadMore}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-full transition-colors flex items-center gap-2"
                            >
                                Ver mais
                                {loading && <Loader2 size={12} className="animate-spin" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
                {selectedComm ? (
                    <>
                        {/* Detail Header */}
                        <div className="bg-white px-8 py-6 flex justify-between items-start shrink-0 border-b border-gray-200 z-10 shadow-sm">
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${selectedComm.channel.name === 'Urgente' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                        {/* @ts-ignore */}
                                        {React.createElement((Icons as any)[selectedComm.channel.icon_name.charAt(0).toUpperCase() + selectedComm.channel.icon_name.slice(1)] || Icons.MessageSquare, { size: 12 })}
                                        {selectedComm.channel.name}
                                    </span>
                                    {selectedComm.target_type && (
                                        <>
                                            <span className="text-gray-400 text-sm">•</span>
                                            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold uppercase tracking-tight border border-slate-200">
                                                {selectedComm.target_type === 'SCHOOL' && <Users size={10} />}
                                                {selectedComm.target_type === 'CLASS' && <Icons.GraduationCap size={10} />}
                                                {selectedComm.target_type === 'STUDENT' && <Icons.User size={10} />}
                                                {selectedComm.target_type === 'SCHOOL' ? 'Escola Toda' :
                                                    selectedComm.target_type === 'CLASS' ? (
                                                        selectedComm.target_names && selectedComm.target_names.length > 0
                                                            ? selectedComm.target_names.join(', ')
                                                            : 'Por Turma'
                                                    ) :
                                                        'Individual'}
                                            </span>
                                        </>
                                    )}
                                    <span className="text-gray-400 text-sm">•</span>
                                    <span className="text-gray-500 text-sm font-medium">{format(new Date(selectedComm.created_at), "dd 'de' MMMM, yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                </div>
                                <h1 className="text-3xl font-bold text-slate-900 leading-tight tracking-tight">{selectedComm.title}</h1>
                            </div>

                            {/* Tabs Switcher */}
                            <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Painel Geral
                                </button>
                                <button
                                    onClick={() => setActiveTab('messages')}
                                    className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'messages' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Conversas
                                    {conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0) > 0 && (
                                        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm animate-pulse min-w-[20px] text-center">
                                            {conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* TAB CONTENT */}
                        <div className="flex-1 overflow-auto bg-slate-50/50">
                            {activeTab === 'overview' && (
                                <div className="p-8 max-w-[1600px] mx-auto animate-fade-in space-y-8">
                                    {/* Metrics */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                            <span className="text-slate-500 text-sm font-medium mb-1">Destinatários</span>
                                            <span className="text-3xl font-extrabold text-slate-900">{selectedComm.total_recipients}</span>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                                            <span className="text-slate-500 text-sm font-medium mb-1">Leituras</span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-extrabold text-blue-600">{selectedComm.read_count}</span>
                                                <span className="text-sm font-bold text-slate-400">({calculatePercentage(selectedComm.read_count, selectedComm.total_recipients)}%)</span>
                                            </div>
                                        </div>
                                        {selectedComm.metadata?.template === 'rsvp' && (
                                            <>
                                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
                                                    <div className="absolute right-0 top-0 p-4 opacity-10 font-black"><CheckCircle2 size={40} className="text-green-500" /></div>
                                                    <span className="text-slate-500 text-sm font-medium mb-1">Confirmados</span>
                                                    <span className="text-3xl font-extrabold text-green-600">
                                                        {selectedComm.responses?.filter(r => r.response.selected_option === 'Estarei Presente').length || 0}
                                                    </span>
                                                </div>
                                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
                                                    <div className="absolute right-0 top-0 p-4 opacity-10"><XCircle size={40} className="text-red-500" /></div>
                                                    <span className="text-slate-500 text-sm font-medium mb-1">Ausentes</span>
                                                    <span className="text-3xl font-extrabold text-red-600">
                                                        {selectedComm.responses?.filter(r => r.response.selected_option === 'Não Poderei Comparecer').length || 0}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 text-left">
                                        {/* Content */}
                                        <div className="xl:col-span-2 space-y-6">
                                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                                                <div className="bg-gray-50/80 px-8 py-6 border-b border-gray-100 flex items-start justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg shadow-sm bg-${selectedComm.channel.color}-100 text-${selectedComm.channel.color}-600`}>
                                                            {/* @ts-ignore */}
                                                            {React.createElement((Icons as any)[selectedComm.channel.icon_name.charAt(0).toUpperCase() + selectedComm.channel.icon_name.slice(1)] || Icons.MessageSquare, { size: 24 })}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="font-bold text-gray-900 text-base">Escola</span>
                                                                <span className="text-gray-400 text-xs">•</span>
                                                                <span className="text-sm text-gray-500 font-medium">para Pais e Responsáveis</span>
                                                            </div>
                                                            <span className="text-xs text-gray-400">
                                                                {format(new Date(selectedComm.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-10 flex-1">
                                                    <div
                                                        className="prose prose-lg prose-slate max-w-none font-sans text-gray-700 leading-loose"
                                                        dangerouslySetInnerHTML={{ __html: selectedComm.content }}
                                                    />
                                                    {selectedComm.metadata?.template === 'rsvp' && (
                                                        <div className="mt-8 pt-8 border-t border-gray-100 bg-blue-50/30 p-6 rounded-2xl border border-blue-100">
                                                            <div className="flex items-center gap-2 text-blue-900 font-bold mb-2">
                                                                <Sparkles size={20} />
                                                                Painel RSVP Interativo Ativado
                                                            </div>
                                                            <p className="text-sm text-blue-700/70 font-medium">Os pais visualizam as opções de confirmação diretamente no aplicativo.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* RSVP Sidebar */}
                                        <div className="space-y-6">
                                            {selectedComm.metadata?.template === 'rsvp' && (
                                                <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col h-full">
                                                    <div className="flex justify-between items-center mb-8">
                                                        <div>
                                                            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-xl">
                                                                <Users size={24} className="text-blue-600" />
                                                                Presenças
                                                            </h3>
                                                            <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">RSVP Dashboard</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setIsRSVPModalOpen(true)}
                                                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-2.5 rounded-xl transition-all"
                                                        >
                                                            <Icons.Maximize2 size={18} />
                                                        </button>
                                                    </div>

                                                    <div className="mb-8">
                                                        <div className="flex justify-between items-end mb-2">
                                                            <span className="text-sm font-bold text-slate-700">Taxa de Presença</span>
                                                            <span className="text-sm font-black text-blue-600">
                                                                {calculatePercentage(selectedComm.responses?.filter(r => r.response.selected_option === 'Estarei Presente').length || 0, selectedComm.total_recipients)}%
                                                            </span>
                                                        </div>
                                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                                            <div
                                                                className="h-full bg-emerald-500 transition-all duration-700"
                                                                style={{ width: `${calculatePercentage(selectedComm.responses?.filter(r => r.response.selected_option === 'Estarei Presente').length || 0, selectedComm.total_recipients)}%` }}
                                                            />
                                                            <div
                                                                className="h-full bg-rose-500 transition-all duration-700"
                                                                style={{ width: `${calculatePercentage(selectedComm.responses?.filter(r => r.response.selected_option === 'Não Poderei Comparecer').length || 0, selectedComm.total_recipients)}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex gap-4 mt-3">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sim</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-rose-500" />
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Não</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 space-y-4">
                                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-50 pb-2">Últimas Respostas</div>
                                                        <div className="space-y-3">
                                                            {(selectedComm.responses || []).slice(0, 5).map((r, idx) => (
                                                                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 border-transparent hover:border-blue-200 transition-all">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${r.response.selected_option === 'Estarei Presente' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                                            {r.guardian.name.charAt(0)}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{r.guardian.name}</p>
                                                                            <p className="text-[10px] text-slate-400">{format(new Date(r.answered_at || new Date()), "HH:mm")}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className={r.response.selected_option === 'Estarei Presente' ? 'text-emerald-500' : 'text-rose-500'}>
                                                                        {r.response.selected_option === 'Estarei Presente' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button onClick={() => setIsRSVPModalOpen(true)} className="w-full text-center text-[10px] font-bold text-blue-600 uppercase tracking-widest p-2 hover:bg-blue-50 rounded-lg transition-colors">
                                                            Expandir Lista Completa
                                                        </button>
                                                    </div>
                                                </section>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'messages' && (
                                <div className="flex h-full animate-fade-in bg-white">
                                    {/* Sidebar de Conversas */}
                                    <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
                                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conversas Ativas</h3>
                                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">{conversations.length}</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto">
                                            {loadingConversations ? (
                                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-slate-400" /></div>
                                            ) : conversations.length === 0 ? (
                                                <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                                        <MessageSquare size={24} className="opacity-40" />
                                                    </div>
                                                    <p className="text-sm font-medium">Nenhuma mensagem ainda.</p>
                                                </div>
                                            ) : (
                                                conversations.map(conv => (
                                                    <div
                                                        key={conv.guardian_id}
                                                        onClick={() => setSelectedConversationId(conv.guardian_id)}
                                                        className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-all relative group ${selectedConversationId === conv.guardian_id ? 'bg-blue-50/60' : ''}`}
                                                    >
                                                        {selectedConversationId === conv.guardian_id && (
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full" />
                                                        )}

                                                        {(conv.unread_count || 0) > 0 && (
                                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 shadow-lg shadow-blue-500/30 font-bold text-[10px] text-white">
                                                                {conv.unread_count}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-3">
                                                            <div className="w-11 h-11 rounded-2xl bg-slate-200 overflow-hidden shrink-0 border-2 border-white shadow-sm relative">
                                                                {conv.avatar_url ? (
                                                                    <img src={conv.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100 font-bold text-lg leading-none">
                                                                        {conv.guardian_name.charAt(0)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex justify-between items-baseline mb-0.5">
                                                                    <span className={`text-sm truncate ${conv.needs_reply ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`}>{conv.guardian_name}</span>
                                                                    <span className="text-[10px] text-slate-400 font-medium shrink-0">{format(new Date(conv.last_message_at), "HH:mm")}</span>
                                                                </div>
                                                                <p className={`text-xs truncate line-clamp-1 ${conv.needs_reply ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                                                                    {conv.messages[conv.messages.length - 1]?.is_admin_reply && <span className="font-bold text-slate-400/80 mr-1">Você:</span>}
                                                                    {conv.messages[conv.messages.length - 1]?.content}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Area do Chat Comercial */}
                                    <div className="flex-1 flex flex-col bg-slate-50/30 relative">
                                        {selectedConversationId && activeConversation ? (
                                            <>
                                                {/* Header do Chat */}
                                                <div className="bg-white px-6 py-4 border-b border-slate-200 shadow-sm flex justify-between items-center z-10">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-slate-100">
                                                            {activeConversation.avatar_url ? (
                                                                <img src={activeConversation.avatar_url} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-slate-500 bg-slate-100 font-bold">
                                                                    {activeConversation.guardian_name.charAt(0)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-900 text-base leading-none mb-1">{activeConversation.guardian_name}</h3>
                                                            <div className="text-[10px] text-green-600 flex items-center gap-1 font-black uppercase tracking-widest">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                                Online
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Mensagens */}
                                                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
                                                    {activeConversation.messages.map((msg, idx) => (
                                                        <div key={msg.id || idx} className={`flex flex-col ${msg.is_admin_reply ? 'items-end' : 'items-start'}`}>
                                                            <div className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-sm relative group ${msg.is_admin_reply
                                                                ? 'bg-blue-600 text-white rounded-tr-none'
                                                                : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                                                                }`}>
                                                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                                <div className={`text-[9px] mt-1 font-bold uppercase tracking-tighter opacity-70 ${msg.is_admin_reply ? 'text-blue-100' : 'text-slate-400'}`}>
                                                                    {format(new Date(msg.created_at), "HH:mm")}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div ref={messagesEndRef} />
                                                </div>

                                                {/* Input de Mensagem */}
                                                <div className="bg-white p-5 border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex flex-col gap-3">
                                                    {isEmojiPickerOpen && (
                                                        <div className="absolute bottom-24 right-6 shadow-2xl rounded-2xl overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-5">
                                                            <EmojiPicker onEmojiClick={(emoji) => setResponseMessage(prev => prev + emoji.emoji)} />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-3">
                                                        <button
                                                            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                                            className={`p-2.5 rounded-xl transition-all ${isEmojiPickerOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                                                        >
                                                            <Smile size={24} />
                                                        </button>
                                                        <div className="flex-1 relative">
                                                            <textarea
                                                                rows={1}
                                                                value={responseMessage}
                                                                onChange={(e) => setResponseMessage(e.target.value)}
                                                                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendReply())}
                                                                placeholder="Escreva uma resposta..."
                                                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm resize-none focus:ring-2 focus:ring-blue-100 placeholder-slate-400"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={handleSendReply}
                                                            disabled={sendingReply || !responseMessage.trim()}
                                                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3.5 rounded-2xl shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                                                        >
                                                            {sendingReply ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                                                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center p-6 shadow-xl border border-slate-100 mb-6 animate-bounce-slow">
                                                    <MessageSquare size={48} className="text-blue-100" />
                                                </div>
                                                <h3 className="font-bold text-slate-800 text-xl mb-2">Selecione uma conversa</h3>
                                                <p className="max-w-xs text-sm font-medium opacity-60">Escolha um responsável na lista ao lado para iniciar o atendimento escolar.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center bg-white space-y-6">
                        <div className="w-32 h-32 bg-blue-50/50 rounded-full flex items-center justify-center text-blue-200 animate-pulse">
                            <FileText size={64} strokeWidth={1} />
                        </div>
                        <div className="max-w-md">
                            <h2 className="text-2xl font-black text-slate-900 mb-2">Selecione um Comunicado</h2>
                            <p className="text-slate-500 font-medium">Escolha um envio na barra lateral para analisar as métricas de leitura, respostas RSVP e gerenciar conversas com os pais.</p>
                        </div>
                        <button
                            onClick={() => navigate('/admin/comunicados/novo')}
                            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Criar Comunicado
                        </button>
                    </div>
                )}
            </div>

            {/* RSVP FULL MODAL */}
            {isRSVPModalOpen && selectedComm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="bg-slate-50 px-10 py-8 border-b border-gray-100 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-widest mb-3">
                                    <Icons.ListChecks size={18} />
                                    Gerenciamento RSVP
                                </div>
                                <h2 className="text-3xl font-black text-slate-900">{selectedComm.title}</h2>
                                <p className="text-slate-400 mt-1 font-medium italic">Confirmações de presença para este evento</p>
                            </div>
                            <button
                                onClick={() => setIsRSVPModalOpen(false)}
                                className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
                            >
                                <Icons.X size={24} />
                            </button>
                        </div>

                        {/* Filters & Actions */}
                        <div className="px-10 py-6 bg-white border-b border-gray-50 flex flex-wrap gap-6 items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex bg-slate-100 p-1 rounded-2xl">
                                    <button
                                        onClick={() => { setRsvpSort('date'); setRsvpSortDir(rsvpSortDir === 'asc' ? 'desc' : 'asc'); }}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${rsvpSort === 'date' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                                    >
                                        Data
                                    </button>
                                    <button
                                        onClick={() => { setRsvpSort('name'); setRsvpSortDir(rsvpSortDir === 'asc' ? 'desc' : 'asc'); }}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${rsvpSort === 'name' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                                    >
                                        Nome
                                    </button>
                                    <button
                                        onClick={() => { setRsvpSort('status'); setRsvpSortDir(rsvpSortDir === 'asc' ? 'desc' : 'asc'); }}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${rsvpSort === 'status' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                                    >
                                        Status
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-3 px-6 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100"
                            >
                                <Icons.FileDown size={18} />
                                Exportar Lista (CSV)
                            </button>
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-10 bg-slate-50/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {getSortedRSVP().map((r, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-purple-200 transition-all group/modal-item">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-sm transition-transform group-hover/modal-item:rotate-3
                                                ${r.response.selected_option === 'Estarei Presente' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {r.guardian.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-base font-black text-slate-900 leading-tight">{r.guardian.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${r.response.selected_option === 'Estarei Presente' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {r.response.selected_option === 'Estarei Presente' ? 'Presente' : 'Ausente'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold">• {format(new Date(r.answered_at || new Date()), "dd/MM 'às' HH:mm")}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`p-2 rounded-full border-2 ${r.response.selected_option === 'Estarei Presente' ? 'text-emerald-500 border-emerald-50 bg-emerald-50/20' : 'text-rose-500 border-rose-50 bg-rose-50/20'}`}>
                                            {r.response.selected_option === 'Estarei Presente' ? <Icons.Check size={24} strokeWidth={3} /> : <Icons.X size={24} strokeWidth={3} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer Summary */}
                        <div className="bg-slate-900 border-t border-slate-800 px-10 py-6 flex items-center justify-between text-white">
                            <div className="flex gap-10">
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block mb-1">Métrica Sim</span>
                                    <span className="text-xl font-black text-emerald-400">{selectedComm.responses?.filter(r => r.response.selected_option === 'Estarei Presente').length || 0}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block mb-1">Métrica Não</span>
                                    <span className="text-xl font-black text-rose-400">{selectedComm.responses?.filter(r => r.response.selected_option === 'Não Poderei Comparecer').length || 0}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block mb-1">Total de Respostas</span>
                                <span className="text-xl font-black">{selectedComm.responses?.length || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CommunicationsDashboard;
