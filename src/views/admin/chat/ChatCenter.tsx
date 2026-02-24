import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { format } from 'date-fns';
import {
    Search,
    Send,
    Paperclip,
    MoreVertical,
    Smile,
    MessageSquare,
    CheckCheck,
    Loader2,
    Filter,
    Building,
    DollarSign,
    Users
} from 'lucide-react';
import { Button } from '../../../components/ui';

interface ChatThread {
    id: string; // The UUID from db, or "new-STUDENT_ID-CHANNEL-CLASS_ID"
    student_id: string;
    student_name: string;
    student_photo: string | null;
    class_name: string | null;
    class_id: string | null;
    channel_type: string;
    last_message: string | null;
    last_message_at: string | null;
    last_sender_role?: string;
    unread_count_school?: number;
    exists?: boolean;
}

interface ChatMessage {
    id: string;
    sender_id: string;
    sender_name?: string;
    sender_role?: string;
    content: string;
    type: string;
    created_at: string;
}

const CHANNELS = [
    { id: 'CLASS', label: 'Turmas', icon: Users },
    { id: 'SECRETARIAT', label: 'Secretaria', icon: Building },
    { id: 'FINANCE', label: 'Financeiro', icon: DollarSign },
];

export const ChatCenter: React.FC = () => {
    const { user, currentSchool } = useAuth();

    // Tab and Permission State
    const [allowedChannels, setAllowedChannels] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string>('');
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);

    // Chat State
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeImage, setActiveImage] = useState<string | null>(null);
    const [unreadPerChannel, setUnreadPerChannel] = useState<Record<string, number>>({});

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 1. Fetch User permissions
    useEffect(() => {
        const loadPermissions = async () => {
            if (!currentSchool || !user) return;

            try {
                if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
                    setAllowedChannels(['CLASS', 'SECRETARIAT', 'FINANCE']);
                    setActiveTab('CLASS');
                } else {
                    const channels = [];
                    // Check generic channels
                    const { data: perms } = await supabase
                        .from('chat_channel_permissions')
                        .select('channel_type')
                        .eq('school_id', currentSchool.id)
                        .eq('staff_id', user.id);

                    if (perms) {
                        perms.forEach(p => channels.push(p.channel_type));
                    }

                    // Check if teacher
                    if (user.role === 'TEACHER' || user.role === 'COORDINATOR') {
                        const { data: classes } = await supabase
                            .from('class_teachers')
                            .select('id')
                            .eq('teacher_id', user.id)
                            .limit(1);
                        if (classes && classes.length > 0) {
                            channels.push('CLASS');
                        }
                    }

                    // Remove duplicates
                    const uniqueChannels = Array.from(new Set(channels));
                    setAllowedChannels(uniqueChannels);

                    if (uniqueChannels.length > 0) {
                        setActiveTab(uniqueChannels[0]);
                    }
                }
            } catch (error) {
                console.error("Error loading permissions", error);
            } finally {
                setPermissionsLoaded(true);
            }
        };

        loadPermissions();
    }, [currentSchool, user]);

    // 2. Fetch Threads based on activeTab
    useEffect(() => {
        if (permissionsLoaded && activeTab) {
            fetchThreads();
            setSelectedThread(null); // Reset selection when changing channel
        }
    }, [activeTab, permissionsLoaded, currentSchool]);

    useEffect(() => {
        if (selectedThread) {
            fetchMessages(selectedThread.id);
        }
    }, [selectedThread]);

    useEffect(() => {
        scrollToBottom();
        // If thread is selected, mark it as read
        if (selectedThread && selectedThread.exists) {
            markThreadAsRead(selectedThread.id);
        }
    }, [messages, selectedThread]);

    const markThreadAsRead = async (threadId: string) => {
        if (threadId.startsWith('new-')) return;
        try {
            await supabase
                .from('chat_threads')
                .update({ unread_count_school: 0 })
                .eq('id', threadId);
        } catch (error) {
            console.error('Error marking thread as read:', error);
        }
    };

    const fetchThreads = async () => {
        if (!currentSchool || !user) return;
        setLoading(true);
        try {
            let studentsQuery = supabase
                .from('class_enrollments')
                .select(`
                    id,
                    student:students(
                        id, 
                        name, 
                        photo_url
                    ),
                    class:classes!inner(id, name, school_id),
                    enrollment:enrollments!inner(status)
                `)
                .eq('class.school_id', currentSchool.id)
                .in('enrollment.status', ['ACTIVE', 'approved']); // Only active students

            // If not admin and tab is CLASS, filter by teacher's classes
            if (activeTab === 'CLASS' && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
                const { data: myClasses } = await supabase
                    .from('class_teachers')
                    .select('class_id')
                    .eq('teacher_id', user.id);

                if (myClasses && myClasses.length > 0) {
                    const classIds = myClasses.map(c => c.class_id);
                    studentsQuery = studentsQuery.in('class_id', classIds);
                } else {
                    setThreads([]); // Should not happen if permissions are right, but safe
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await studentsQuery;
            if (error) throw error;

            // Fetch existing threads for this channel
            const { data: threadData } = await supabase
                .from('chat_threads')
                .select(`
                    *,
                    last_sender:profiles!last_sender_id(role)
                `)
                .eq('school_id', currentSchool.id)
                .eq('channel_type', activeTab);

            // Create maps for fast lookup
            // Key depends on the tab type:
            // - CLASS: student_id + class_id
            // - OTHER: student_id
            const threadMap = new Map();
            threadData?.forEach(t => {
                const key = t.channel_type === 'CLASS' ? `${t.student_id}-${t.class_id}` : t.student_id;
                threadMap.set(key, t);
            });

            const uniqueThreads = new Map();

            data?.forEach((item: any) => {
                if (!item.student || !item.class) return;

                const studentId = item.student.id;
                const classId = item.class.id;

                // For non-CLASS channels, we just group by student (ignoring multiple classes)
                // For CLASS channels, we want a distinct thread per class the student is in
                const key = activeTab === 'CLASS' ? `${studentId}-${classId}` : studentId;

                if (!uniqueThreads.has(key)) {
                    const thread = threadMap.get(key);
                    uniqueThreads.set(key, {
                        id: thread?.id || `new-${key}-${activeTab}`,
                        student_id: studentId,
                        student_name: item.student.name,
                        student_photo: item.student.photo_url,
                        class_name: item.class.name,
                        class_id: classId,
                        channel_type: activeTab,
                        last_message: thread?.last_message || 'Clique para iniciar...',
                        last_message_at: thread?.last_message_at || null,
                        last_sender_role: thread?.last_sender?.role,
                        unread_count_school: thread?.unread_count_school || 0,
                        exists: !!thread
                    });
                }
            });

            // Calculate unread counts per channel globally to show badges on tabs
            const { data: allUnreadData } = await supabase
                .from('chat_threads')
                .select('channel_type, unread_count_school')
                .eq('school_id', currentSchool.id)
                .gt('unread_count_school', 0);

            if (allUnreadData) {
                const counts: Record<string, number> = {};
                allUnreadData.forEach(t => {
                    counts[t.channel_type] = (counts[t.channel_type] || 0) + (t.unread_count_school || 0);
                });
                setUnreadPerChannel(counts);
            }

            // Sort by most recent activity
            const sortedThreads = Array.from(uniqueThreads.values()).sort((a, b) => {
                if (!a.last_message_at) return 1;
                if (!b.last_message_at) return -1;
                return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
            });

            setThreads(sortedThreads);
        } catch (error) {
            console.error('Error fetching threads:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (threadId: string) => {
        if (threadId.startsWith('new-')) {
            setMessages([]);
            return;
        }
        setLoadingMessages(true);
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*, sender:profiles!sender_id(name)')
                .eq('thread_id', threadId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const processedMessages = data?.map((msg: any) => ({
                ...msg,
                sender_name: msg.sender?.name
            })) || [];

            setMessages(processedMessages);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    // Realtime subscription setup for messages
    useEffect(() => {
        if (!selectedThread || selectedThread.id.startsWith('new-')) return;

        const channel = supabase
            .channel(`chat:${selectedThread.id}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `thread_id=eq.${selectedThread.id}`
            }, async (payload) => {
                const msg = payload.new as ChatMessage;

                if (msg.sender_id !== user?.id) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('name')
                        .eq('id', msg.sender_id)
                        .single();

                    if (profile) msg.sender_name = profile.name;
                } else {
                    msg.sender_name = user?.name;
                }

                setMessages(prev => [...prev, msg]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedThread?.id, user?.id, user?.name]);

    // Realtime subscription setup for threads (sidebar sync for active tab only)
    useEffect(() => {
        if (!currentSchool || !activeTab) return;

        const channel = supabase
            .channel(`admin-threads-sync-${activeTab}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_threads',
                filter: `school_id=eq.${currentSchool.id}` // Supabase filter doesn't support AND very well natively in channel config, so we filter below
            }, (payload) => {
                const updatedThread = payload.new as any;

                // Only process threads belonging to the currently active tab
                if (updatedThread.channel_type === activeTab) {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        setThreads(prev => {
                            // Find matching thread. Same logic as mapping: depends on CLASS vs other
                            let existsIndex = -1;
                            if (activeTab === 'CLASS') {
                                existsIndex = prev.findIndex(t => t.student_id === updatedThread.student_id && t.class_id === updatedThread.class_id);
                            } else {
                                existsIndex = prev.findIndex(t => t.student_id === updatedThread.student_id);
                            }

                            if (existsIndex >= 0) {
                                const newThreads = [...prev];
                                newThreads[existsIndex] = {
                                    ...newThreads[existsIndex],
                                    id: updatedThread.id,
                                    last_message: updatedThread.last_message,
                                    last_message_at: updatedThread.last_message_at,
                                    last_sender_role: updatedThread.last_sender_id === updatedThread.student_id ? 'PARENT' : 'STAFF',
                                    exists: true,
                                    unread_count_school: updatedThread.unread_count_school
                                };
                                return newThreads.sort((a, b) => {
                                    if (!a.last_message_at) return 1;
                                    if (!b.last_message_at) return -1;
                                    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
                                });
                            } else if (payload.eventType === 'INSERT') {
                                // Full refresh if new thread comes in that we didn't have mapped
                                fetchThreads();
                            }
                            return prev;
                        });
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentSchool?.id, activeTab]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedThread || !currentSchool || !user) return;

        setLoadingMessages(true);
        try {
            let threadId = selectedThread.id;

            // 1. Create thread if new
            if (threadId.startsWith('new-')) {
                const { data: newThread } = await supabase
                    .from('chat_threads')
                    .insert({
                        school_id: currentSchool.id,
                        student_id: selectedThread.student_id,
                        channel_type: selectedThread.channel_type,
                        class_id: selectedThread.channel_type === 'CLASS' ? selectedThread.class_id : null
                    })
                    .select()
                    .single();

                if (newThread) {
                    threadId = newThread.id;
                    setThreads(prev => prev.map(t =>
                        t.id === selectedThread.id ? { ...t, id: threadId, exists: true } : t
                    ));
                    setSelectedThread(prev => prev ? { ...prev, id: threadId, exists: true } : null);
                }
            }

            const filename = `chat_admin_${Date.now()}_${file.name}`;
            const filePath = `chat/${threadId}/${filename}`;

            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('photos')
                .getPublicUrl(filePath);

            const { error: msgError } = await supabase
                .from('chat_messages')
                .insert({
                    thread_id: threadId,
                    sender_id: user.id,
                    content: publicUrl,
                    type: 'image'
                });

            if (msgError) throw msgError;

        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Erro ao enviar imagem.');
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedThread || !currentSchool || !user) return;

        let threadId = selectedThread.id;

        try {
            if (threadId.startsWith('new-')) {
                const { data: newThread, error: threadError } = await supabase
                    .from('chat_threads')
                    .insert({
                        school_id: currentSchool.id,
                        student_id: selectedThread.student_id,
                        channel_type: selectedThread.channel_type,
                        class_id: selectedThread.channel_type === 'CLASS' ? selectedThread.class_id : null
                    })
                    .select()
                    .single();

                if (threadError) throw threadError;
                threadId = newThread.id;

                setThreads(prev => prev.map(t =>
                    t.id === selectedThread.id
                        ? { ...t, id: threadId, exists: true }
                        : t
                ));
                setSelectedThread(prev => prev ? { ...prev, id: threadId, exists: true } : null);
            }

            const { error: msgError } = await supabase
                .from('chat_messages')
                .insert({
                    thread_id: threadId,
                    sender_id: user.id,
                    content: newMessage.trim(),
                    type: 'text'
                });

            if (msgError) throw msgError;

            setNewMessage('');
        } catch (error: any) {
            console.error('Error sending message:', error);
        }
    };

    if (!permissionsLoaded) {
        return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
    }

    if (allowedChannels.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-white rounded-2xl border border-slate-200">
                <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">Sem Acesso aos Canais</h2>
                <p>Você não possui permissão para visualizar nenhum canal de atendimento.</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-120px)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
            {/* Sidebar */}
            <div className="w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50">
                <div className="p-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-900">Atendimento</h2>
                        <Button variant="ghost" size="sm" className="p-2">
                            <MoreVertical className="w-5 h-5 text-slate-500" />
                        </Button>
                    </div>

                    {/* Channel Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-3 mb-2 pt-2 px-1 -mx-1 custom-scrollbar">
                        {CHANNELS.filter(c => allowedChannels.includes(c.id)).map(channel => {
                            const Icon = channel.icon;
                            const isActive = activeTab === channel.id;
                            const unreadCount = unreadPerChannel[channel.id] || 0;
                            return (
                                <button
                                    key={channel.id}
                                    onClick={() => setActiveTab(channel.id)}
                                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${isActive
                                        ? 'bg-brand-100 text-brand-700'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                >
                                    <Icon size={14} />
                                    {channel.label}
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-white"></span>
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'CLASS' ? "Buscar aluno ou turma..." : "Buscar atendimento..."}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-20">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="text-center p-8 text-slate-500 text-sm">
                            Nenhum aluno ou conversa encontrada neste canal.
                        </div>
                    ) : (
                        threads
                            .filter(t => t.student_name.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map((thread) => (
                                <button
                                    key={thread.id}
                                    onClick={() => setSelectedThread(thread)}
                                    className={`w-full p-4 flex items-center gap-3 transition-colors border-b border-slate-100/50 relative ${selectedThread?.id === thread.id
                                        ? 'bg-white shadow-sm ring-1 ring-slate-200 z-10'
                                        : (thread.unread_count_school && thread.unread_count_school > 0 ? 'bg-brand-50/80 hover:bg-brand-100' : 'hover:bg-slate-100')
                                        }`}
                                >
                                    {/* Indicator Bar for Unread */}
                                    {(thread.unread_count_school ?? 0) > 0 && selectedThread?.id !== thread.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-600 rounded-r-full" />
                                    )}

                                    <div className="relative">
                                        {thread.student_photo ? (
                                            <img
                                                src={thread.student_photo}
                                                alt={thread.student_name}
                                                className={`w-12 h-12 rounded-full object-cover border-2 transition-all ${(thread.unread_count_school ?? 0) > 0 || thread.last_sender_role === 'PARENT'
                                                    ? 'border-brand-500 scale-105 shadow-md ring-2 ring-brand-100 ' + (((thread.unread_count_school ?? 0) > 0 && selectedThread?.id !== thread.id) ? 'ring-offset-2 ring-offset-brand-50 animate-pulse' : '')
                                                    : 'border-transparent'
                                                    }`}
                                            />
                                        ) : (
                                            <div className={`w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold border-2 transition-all ${(thread.unread_count_school ?? 0) > 0 || thread.last_sender_role === 'PARENT'
                                                ? 'border-brand-500 scale-105 shadow-md ring-2 ring-brand-100 ' + (((thread.unread_count_school ?? 0) > 0 && selectedThread?.id !== thread.id) ? 'ring-offset-2 ring-offset-brand-50 animate-pulse' : '')
                                                : 'border-transparent'
                                                }`}>
                                                {thread.student_name.charAt(0)}
                                            </div>
                                        )}
                                        <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-slate-50 rounded-full ${(thread.unread_count_school ?? 0) > 0 || thread.last_sender_role === 'PARENT' ? 'bg-brand-500' : 'bg-green-500'
                                            }`}></div>
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-baseline mb-0.5">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`truncate leading-tight ${((thread.unread_count_school ?? 0) > 0 && selectedThread?.id !== thread.id) ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
                                                        {thread.student_name}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter truncate">{thread.class_name}</span>
                                            </div>
                                            {thread.last_message_at && (
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[10px] ${((thread.unread_count_school ?? 0) > 0 && selectedThread?.id !== thread.id) ? 'font-bold text-brand-600' : 'text-slate-400'}`}>
                                                        {format(new Date(thread.last_message_at), 'HH:mm')}
                                                    </span>
                                                    {((thread.unread_count_school ?? 0) > 0 && selectedThread?.id !== thread.id) ? (
                                                        <span className="flex items-center justify-center min-w-[20px] h-[20px] px-1.5 bg-red-500 text-[11px] font-black text-white rounded-full shadow-sm animate-bounce">
                                                            {thread.unread_count_school}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                        <p className={`text-xs truncate w-full mt-0.5 ${((thread.unread_count_school ?? 0) > 0 && selectedThread?.id !== thread.id) ? 'font-bold text-slate-900' : 'italic text-slate-500'}`}>
                                            {thread.last_sender_role === 'PARENT' ? <span className="text-brand-600 font-bold mr-1">Resp:</span> : <span className="text-slate-400 mr-1">Você:</span>}
                                            {thread.last_message}
                                        </p>
                                    </div>
                                </button>
                            ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedThread ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white z-10">
                            <div className="flex items-center gap-3">
                                {selectedThread.student_photo ? (
                                    <img src={selectedThread.student_photo} alt={selectedThread.student_name} className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold">
                                        {selectedThread.student_name.charAt(0)}
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-bold text-slate-900 leading-none mb-1">{selectedThread.student_name}</h3>
                                    <span className="text-[11px] text-green-500 font-medium">Online (Visualizando) - {CHANNELS.find(c => c.id === selectedThread.channel_type)?.label}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" className="p-2">
                                    <Search className="w-5 h-5 text-slate-400" />
                                </Button>
                                <Button variant="ghost" size="sm" className="p-2">
                                    <Filter className="w-5 h-5 text-slate-400" />
                                </Button>
                                <Button variant="ghost" size="sm" className="p-2">
                                    <MoreVertical className="w-5 h-5 text-slate-400" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#f8fafc] style-scroll">
                            {loadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                                    <MessageSquare className="w-12 h-12 opacity-20" />
                                    <p className="text-sm">Nenhuma mensagem ainda neste canal.</p>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}
                                    >
                                        <span className="text-[10px] text-slate-400 mb-1 px-1">
                                            {msg.sender_id === user?.id ? 'Você' : msg.sender_name || 'Carregando...'}
                                        </span>
                                        <div className={`max-w-[70%] p-1.5 rounded-2xl shadow-sm ${msg.sender_id === user?.id
                                            ? 'bg-brand-600 text-white rounded-tr-none'
                                            : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
                                            }`}>
                                            {msg.type === 'image' ? (
                                                <div className="relative group">
                                                    <img
                                                        src={msg.content}
                                                        alt="Chat attachment"
                                                        className="max-h-48 w-auto rounded-xl cursor-pointer hover:opacity-95 transition-opacity object-contain bg-slate-50"
                                                        onClick={() => setActiveImage(msg.content)}
                                                    />
                                                    <div
                                                        className="absolute bottom-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                        onClick={() => setActiveImage(msg.content)}
                                                    >
                                                        <Search className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm leading-relaxed px-1.5 py-0.5">{msg.content}</p>
                                            )}
                                            <div className={`flex items-center justify-end gap-1 mt-1 px-1.5 pb-0.5 ${msg.sender_id === user?.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                                <span className="text-[10px]">
                                                    {format(new Date(msg.created_at), 'HH:mm')}
                                                </span>
                                                {msg.sender_id === user?.id && <CheckCheck className="w-3 h-3" />}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-slate-200">
                            <div className="flex items-center gap-2 max-w-6xl mx-auto">
                                <Button variant="ghost" size="sm" className="p-2.5 rounded-full hover:bg-slate-100">
                                    <Smile className="w-6 h-6 text-slate-500" />
                                </Button>
                                <input
                                    type="file"
                                    id="admin-image-upload"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-2.5 rounded-full hover:bg-slate-100"
                                    onClick={() => document.getElementById('admin-image-upload')?.click()}
                                >
                                    <Paperclip className="w-6 h-6 text-slate-500" />
                                </Button>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        placeholder={`Enviar mensagem no canal de ${CHANNELS.find(c => c.id === selectedThread.channel_type)?.label}...`}
                                        className="w-full py-3 px-4 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-brand-500 transition-all outline-none"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    />
                                </div>
                                <button
                                    onClick={handleSendMessage}
                                    className="p-3 bg-brand-600 text-white rounded-2xl hover:bg-brand-700 shadow-md shadow-brand-600/20 active:scale-95 transition-all"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/30 p-8 text-center">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                            <MessageSquare className="w-10 h-10 text-brand-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Seu Centro de Chat</h3>
                        <p className="max-w-xs text-sm">Selecione um aluno na lista à esquerda para começar a conversar no canal de atendimento.</p>
                        <div className="mt-8 flex gap-4 text-xs font-medium uppercase tracking-widest opacity-50">
                            <span className="flex items-center gap-1.5"><CheckCheck className="w-4 h-4" /> Múltiplos Canais</span>
                            <span>•</span>
                            <span>Multi-tenancy</span>
                        </div>
                    </div>
                )}
            </div>
            {/* Lightbox Modal */}
            {activeImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-200"
                    onClick={() => setActiveImage(null)}
                >
                    <button
                        className="absolute top-6 right-6 text-white hover:text-slate-300 transition-colors"
                        onClick={() => setActiveImage(null)}
                    >
                        <Search className="w-8 h-8 rotate-45" /> {/* Use search as close icon rotated */}
                    </button>
                    <img
                        src={activeImage}
                        alt="Full size"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                    />
                </div>
            )}
        </div>
    );
};
