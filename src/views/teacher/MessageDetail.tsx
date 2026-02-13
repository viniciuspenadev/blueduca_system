// Teacher Message Detail View - Premium Chat Interface with Individual Threads
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Communication } from '../../types';
import { Loader2, ArrowLeft, Send, Smile, Zap, CheckCheck, Users, Eye, MessageSquare, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Icons from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

interface ReplyMessage {
    id: string;
    content: string;
    created_at: string;
    guardian_id: string;
    is_admin_reply?: boolean;
    read_at?: string;
    guardian?: {
        name: string;
        avatar_url?: string;
    };
}

interface Conversation {
    guardian_id: string;
    guardian_name: string;
    messages: ReplyMessage[];
    last_message_at: string;
    unread_count?: number;
}

const TeacherMessageDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [communication, setCommunication] = useState<Communication | null>(null);
    const [replies, setReplies] = useState<ReplyMessage[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
    const [recipientsStats, setRecipientsStats] = useState({ total: 0, read: 0 });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [viewportHeight, setViewportHeight] = useState('100dvh');

    useEffect(() => {
        const originalStyle = {
            overflow: document.body.style.overflow,
            height: document.body.style.height,
            position: document.body.style.position,
            width: document.body.style.width
        };

        document.body.style.overflow = 'hidden';
        document.body.style.height = '100dvh';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100dvh';

        return () => {
            document.body.style.overflow = originalStyle.overflow;
            document.body.style.height = originalStyle.height;
            document.body.style.position = originalStyle.position;
            document.body.style.width = originalStyle.width;
            document.documentElement.style.overflow = '';
            document.documentElement.style.height = '';
        };
    }, []);

    useEffect(() => {
        if (!window.visualViewport) return;
        const handleResize = () => {
            const height = window.visualViewport?.height;
            if (height !== undefined) {
                setViewportHeight(`${height}px`);
                window.scrollTo(0, 0);
                if (height < window.innerHeight * 0.8) {
                    setTimeout(() => {
                        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                }
            }
        };
        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
        handleResize();
        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    useEffect(() => {
        if (id && user) {
            fetchDetail(true);
        }
    }, [id, user]);



    const markAsRead = async (commId: string, guardianId?: string) => {
        try {
            if (!user) return;

            // 1. Mark the communication as read for the teacher/recipient
            // This works because users have permission to update their own rows in communication_recipients
            await supabase.from('communication_recipients')
                .update({ read_at: new Date().toISOString() })
                .eq('communication_id', commId)
                .eq('guardian_id', user.id)
                .is('read_at', null);

            // Note: We don't mark replies as read in the DB here because staff lacks UPDATE permission on communication_replies.
            // Instead, the system uses "Last Message" logic to determine if a thread is pending a return.

            // Update local state to reflect acknowledged status (optimistic cleanup)
            if (guardianId) {
                setConversations(prev => prev.map(c =>
                    c.guardian_id === guardianId ? { ...c, unread_count: 0 } : c
                ));
            } else {
                setConversations(prev => prev.map(c => ({ ...c, unread_count: 0 })));
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    useEffect(() => {
        if (!id || !user || !communication) return;
        const isAuthor = communication.sender_profile_id === user.id;
        if (isAuthor) {
            if (selectedGuardianId) {
                markAsRead(id, selectedGuardianId);
            }
        } else {
            markAsRead(id);
        }
    }, [id, user, communication, selectedGuardianId]);

    // Realtime Subscription
    useEffect(() => {
        if (!id) return;

        const channel = supabase.channel(`comm_detail_${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'communication_replies',
                    filter: `communication_id=eq.${id}`
                },
                async (payload) => {
                    console.log('⚡ [Realtime] Nova resposta no chat:', payload);
                    const newId = payload.new.id;
                    const { data, error } = await supabase
                        .from('communication_replies')
                        .select('*, guardian:profiles(name)')
                        .eq('id', newId)
                        .single();

                    if (!error && data) {
                        const newReply = data as ReplyMessage;

                        setReplies(prev => {
                            if (prev.some(r => r.id === newReply.id)) return prev;
                            return [...prev, newReply];
                        });

                        // Update conversations
                        setConversations(prev => {
                            const targetGuardianId = newReply.guardian_id;
                            // Check if conversation exists
                            const exists = prev.some(c => c.guardian_id === targetGuardianId);

                            if (exists) {
                                return prev.map(c =>
                                    c.guardian_id === targetGuardianId
                                        ? {
                                            ...c,
                                            messages: c.messages.some(m => m.id === newReply.id) ? c.messages : [...c.messages, newReply],
                                            last_message_at: newReply.created_at,
                                            unread_count: !newReply.is_admin_reply ? (c.unread_count || 0) + 1 : 0
                                        } : c
                                ).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
                            } else {
                                // Create new conversation entry if it doesn't exist (unlikely for reply but possible)
                                return [
                                    {
                                        guardian_id: targetGuardianId,
                                        guardian_name: (Array.isArray(newReply.guardian) ? newReply.guardian[0]?.name : newReply.guardian?.name) || 'Responsável',
                                        messages: [newReply],
                                        last_message_at: newReply.created_at,
                                        unread_count: !newReply.is_admin_reply ? 1 : 0
                                    },
                                    ...prev
                                ];
                            }
                        });

                        // If current view is this conversation, scroll to bottom
                        if (selectedGuardianId === newReply.guardian_id) {
                            setTimeout(() => {
                                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`📡 [Realtime] Chat ${id} status:`, status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id, selectedGuardianId]);

    const fetchDetail = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const { data: commData, error: commError } = await supabase
                .from('communications')
                .select(`
                    *,
                    channel:communication_channels (*),
                    sender_profile:profiles!sender_profile_id(name)
                `)
                .eq('id', id)
                .single();

            if (commError) throw commError;
            setCommunication(commData as Communication);

            // Simpler query: RLS handles the heavy lifting of security/privacy
            const { data: repliesData } = await supabase
                .from('communication_replies')
                .select('*, guardian:profiles(name)')
                .eq('communication_id', id)
                .order('created_at', { ascending: true });

            const allReplies = (repliesData || []) as ReplyMessage[];
            setReplies(allReplies);

            // Process Conversations if Author
            if (isAuthor) {
                const grouped: Record<string, Conversation> = {};

                // Name Resolution Map
                const guardianIds = Array.from(new Set(allReplies.map(r => r.guardian_id)));
                const nameMap: Record<string, string> = {};

                if (guardianIds.length > 0) {
                    const { data: relations } = await supabase
                        .from('student_guardians')
                        .select('guardian_id, student:students(name)')
                        .in('guardian_id', guardianIds);

                    relations?.forEach((rel: any) => {
                        if (rel.student && !nameMap[rel.guardian_id]) {
                            nameMap[rel.guardian_id] = `Responsável (${rel.student.name.split(' ')[0]})`;
                        }
                    });
                }

                allReplies.forEach(msg => {
                    const gId = msg.guardian_id;
                    if (!grouped[gId]) {
                        let gName = (Array.isArray(msg.guardian) ? msg.guardian[0]?.name : msg.guardian?.name) || 'Responsável';
                        if (gName === 'Responsável' && nameMap[gId]) {
                            gName = nameMap[gId];
                        }

                        grouped[gId] = {
                            guardian_id: gId,
                            guardian_name: gName,
                            messages: [],
                            last_message_at: msg.created_at
                        };
                    }
                    grouped[gId].messages.push(msg);
                    if (new Date(msg.created_at) > new Date(grouped[gId].last_message_at)) {
                        grouped[gId].last_message_at = msg.created_at;
                    }
                });
                setConversations(Object.values(grouped).map(c => {
                    // Use Last Message Logic: If last message is NOT from admin, it's unread/pending
                    const lastMsg = c.messages[c.messages.length - 1];
                    const pending = lastMsg && !lastMsg.is_admin_reply ? 1 : 0;
                    return { ...c, unread_count: pending };
                }).sort((a, b) =>
                    new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
                ));
            }

            const { data: statsData } = await supabase
                .from('communication_recipients')
                .select('read_at', { count: 'exact' })
                .eq('communication_id', id);

            if (statsData) {
                setRecipientsStats({
                    total: statsData.length,
                    read: statsData.filter(r => r.read_at).length
                });
            }

            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);

        } catch (error) {
            console.error('Error fetching details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !user || !id) return;

        // Determine target guardian_id
        let targetGuardianId = selectedGuardianId;
        const isAuthor = communication?.sender_profile_id === user?.id;

        // If not author, we use own user.id as guardian_id (thread key)
        if (!isAuthor) {
            targetGuardianId = user.id;
        }

        if (!targetGuardianId) return;

        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('communication_replies')
                .insert({
                    communication_id: id,
                    content: replyText,
                    is_admin_reply: true,
                    guardian_id: targetGuardianId
                })
                .select('*, guardian:profiles(name)')
                .single();

            if (error) throw error;

            const newReply = data as ReplyMessage;

            // Deduplicate replies state
            setReplies(prev => {
                if (prev.some(r => r.id === newReply.id)) return prev;
                return [...prev, newReply];
            });

            if (isAuthor) {
                // Deduplicate conversations state
                setConversations(prev => prev.map(c =>
                    c.guardian_id === targetGuardianId
                        ? {
                            ...c,
                            messages: c.messages.some(m => m.id === newReply.id)
                                ? c.messages
                                : [...c.messages, newReply],
                            last_message_at: newReply.created_at,
                            unread_count: 0 // Marking as acknowledged since we just replied
                        }
                        : c
                ));
            }

            setReplyText('');
            setIsEmojiPickerOpen(false);

            // Mark as read after replying (since we've just seen the thread)
            markAsRead(id, targetGuardianId);

            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (error) {
            console.error('Error sending reply:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleBack = () => {
        if (selectedGuardianId) {
            setSelectedGuardianId(null);
            return;
        }
        setIsExiting(true);
        setTimeout(() => navigate('/admin/comunicados'), 300);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-brand-600" size={40} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carregando Detalhes...</span>
                </div>
            </div>
        );
    }

    if (!communication) return null;

    const isAuthor = communication.sender_profile_id === user?.id;
    const activeConversation = isAuthor && selectedGuardianId
        ? conversations.find(c => c.guardian_id === selectedGuardianId)
        : null;

    const channelColor = communication.channel?.color || 'blue';
    const colorClasses: Record<string, string> = {
        blue: 'text-blue-500 bg-blue-50',
        emerald: 'text-emerald-500 bg-emerald-50',
        amber: 'text-amber-500 bg-amber-50',
        cyan: 'text-cyan-500 bg-cyan-50',
        indigo: 'text-indigo-500 bg-indigo-50',
        purple: 'text-purple-500 bg-purple-50',
        rose: 'text-rose-500 bg-rose-50',
    };
    const colorConfig = colorClasses[channelColor] || colorClasses.blue;

    return (
        <div
            className={`fixed inset-0 z-[100] bg-white flex flex-col transition-transform duration-300 ease-out ${isExiting ? 'translate-x-full' : 'translate-x-0'}`}
            style={{ height: viewportHeight }}
        >
            {/* Header */}
            <header className="shrink-0 flex items-center justify-between p-4 border-b border-slate-100 z-10 bg-white pt-safe-area">
                <button
                    onClick={handleBack}
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-600 active:scale-95 transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex flex-col items-center text-center px-4 min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate w-full">
                        {selectedGuardianId && activeConversation
                            ? activeConversation.guardian_name
                            : (communication.channel?.name || 'Mensagem')}
                    </span>
                    <h1 className="text-sm font-black text-slate-800 truncate w-full">
                        {communication.title}
                    </h1>
                </div>
                <div className="w-10" />
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 flex flex-col">
                <div className="max-w-xl mx-auto w-full p-4 space-y-6">

                    {/* Show Main Stats & Message only if no conversation is selected OR if not author */}
                    {(!selectedGuardianId) && (
                        <>
                            {/* Stats Card */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Destinatários</p>
                                        <p className="text-lg font-black text-slate-800">{recipientsStats.total}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <Eye size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Visualizações</p>
                                        <p className="text-lg font-black text-slate-800">{recipientsStats.read}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Original Message Card */}
                            <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 relative overflow-hidden">
                                <div className="flex gap-4 mb-6">
                                    <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${colorConfig}`}>
                                        {communication.channel && React.createElement((Icons as any)[communication.channel.icon_name.charAt(0).toUpperCase() + communication.channel.icon_name.slice(1)] || Icons.MessageSquare, { size: 24 })}
                                    </div>
                                    <div className="flex-1 pt-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">
                                                {communication.channel?.name}
                                            </span>
                                            {communication.priority === 2 && (
                                                <div className="flex items-center gap-1 bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-rose-100">
                                                    <Zap size={8} fill="currentColor" />
                                                    Urgente
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400">
                                            Enviado em {format(new Date(communication.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h2 className="text-xl font-black text-slate-800 leading-tight">{communication.title}</h2>
                                    <div className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: communication.content }} />
                                </div>
                            </div>

                            {/* Separator */}
                            <div className="flex items-center gap-4 py-4">
                                <div className="h-px flex-1 bg-slate-100" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                                    {isAuthor ? 'Retornos por Responsável' : 'Respostas'}
                                </span>
                                <div className="h-px flex-1 bg-slate-100" />
                            </div>
                        </>
                    )}

                    {/* Conversations List (if Author and no Selection) */}
                    {isAuthor && !selectedGuardianId && (
                        <div className="space-y-3 pb-20">
                            {conversations.length === 0 ? (
                                <div className="bg-white p-12 rounded-[32px] border border-dashed border-slate-200 text-center">
                                    <MessageSquare size={40} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-xs font-bold text-slate-400">Nenhum retorno recebido ainda.</p>
                                </div>
                            ) : (
                                conversations.map(conv => (
                                    <div
                                        key={conv.guardian_id}
                                        onClick={() => setSelectedGuardianId(conv.guardian_id)}
                                        className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 font-black text-lg">
                                                {conv.guardian_name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-800 truncate max-w-[180px]">{conv.guardian_name}</h4>
                                                <p className="text-[10px] text-slate-400 font-bold line-clamp-1">
                                                    {conv.messages[conv.messages.length - 1].content}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className="text-[8px] font-black text-slate-300 uppercase">
                                                {format(new Date(conv.last_message_at), 'HH:mm')}
                                            </span>
                                            {conv.unread_count && conv.unread_count > 0 ? (
                                                <div className="w-5 h-5 bg-brand-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                                    {conv.unread_count}
                                                </div>
                                            ) : (
                                                <ChevronRight size={16} className="text-slate-300" />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Chat Thread (Selection or Not Author) */}
                    {(selectedGuardianId || !isAuthor) && (
                        <div className="space-y-4 pb-24">
                            {(isAuthor ? activeConversation?.messages : replies)?.map((reply) => {
                                const isSelf = reply.is_admin_reply;
                                return (
                                    <div key={reply.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] ${isSelf ? 'order-1' : 'order-2'}`}>
                                            {!isSelf && !selectedGuardianId && (
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-2">
                                                    {reply.guardian?.name || 'Responsável'}
                                                </p>
                                            )}
                                            <div className={`p-4 rounded-3xl ${isSelf
                                                ? 'bg-brand-600 text-white rounded-tr-sm'
                                                : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm shadow-sm'}`}>
                                                <p className="text-sm font-semibold">{reply.content}</p>
                                                <div className="flex items-center justify-between gap-4 mt-1 opacity-60">
                                                    <span className="text-[8px] font-black uppercase tracking-widest">
                                                        {format(new Date(reply.created_at), 'HH:mm')}
                                                    </span>
                                                    {isSelf && <CheckCheck size={12} />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Input Bar (only if chatting) */}
            {(selectedGuardianId || !isAuthor) && (
                <div className="shrink-0 p-4 bg-white border-t border-slate-100 relative pb-safe-area">
                    {isEmojiPickerOpen && (
                        <div className="absolute bottom-full left-0 right-0 z-50 animate-slide-up">
                            <EmojiPicker
                                onEmojiClick={(emojiData) => setReplyText(prev => prev + emojiData.emoji)}
                                width="100%"
                                height={350}
                            />
                        </div>
                    )}
                    <div className="max-w-xl mx-auto flex items-end gap-3">
                        <button
                            onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                            className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${isEmojiPickerOpen ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-slate-400'}`}
                        >
                            <Smile size={24} />
                        </button>
                        <div className="flex-1 relative group">
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onFocus={() => setIsEmojiPickerOpen(false)}
                                placeholder="Escreva sua resposta..."
                                rows={1}
                                className="w-full bg-slate-50 border-none rounded-2xl py-3.5 px-4 pr-12 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-brand-100 transition-all outline-none resize-none max-h-32"
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                                }}
                            />
                        </div>
                        <button
                            onClick={handleSendReply}
                            disabled={submitting || !replyText.trim()}
                            className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${!replyText.trim() ? 'bg-slate-50 text-slate-300' : 'bg-brand-600 text-white shadow-lg shadow-brand-200 active:scale-90'}`}
                        >
                            {submitting ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherMessageDetail;
