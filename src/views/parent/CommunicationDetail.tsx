import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { CommunicationRecipient } from '../../types';
import { Loader2, ArrowLeft, Send, Smile, CalendarCheck, BarChart2, Check, Zap, CheckCheck } from 'lucide-react';
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
}

// Global cache for communication details by ID
const detailCache: Record<string, { recipient: CommunicationRecipient, replies: ReplyMessage[] }> = {};

const CommunicationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, currentSchool } = useAuth();
    const cached = id ? detailCache[id] : null;

    const [recipient, setRecipient] = useState<CommunicationRecipient | null>(cached?.recipient || null);
    const [replies, setReplies] = useState<ReplyMessage[]>(cached?.replies || []);
    const [loading, setLoading] = useState(!cached);
    const [submitting, setSubmitting] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [viewportHeight, setViewportHeight] = useState('100dvh');

    // Lock body scroll and prevent bounce globally while in this view
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
        if (id && user) {
            fetchDetail(true);
        }
    }, [id, user, currentSchool]);



    // Keyboard and Viewport handling for PWA/Mobile
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            const height = window.visualViewport?.height;

            if (height !== undefined) {
                setViewportHeight(`${height}px`);

                // CRITICAL: Prevent browser-level scroll drift
                window.scrollTo(0, 0);

                // Scroll to bottom if keyboard opens
                if (height < window.innerHeight * 0.8) {
                    setTimeout(() => {
                        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                }
            }
        };

        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
        handleResize(); // Initial check

        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    // Scroll to bottom when replies update
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [replies]);

    const fetchDetail = async (showLoading = true) => {
        try {
            if (!cached && showLoading) {
                setLoading(true);
            }
            const { data: recipientData, error: recipientError } = await supabase
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
                .eq('communication_id', id)
                .eq('guardian_id', user?.id)
                .limit(1);

            if (recipientError) throw recipientError;

            const item = recipientData && recipientData.length > 0 ? recipientData[0] : null;
            setRecipient(item as CommunicationRecipient);

            if (item) {
                const { data: repliesData, error: repliesError } = await supabase
                    .from('communication_replies')
                    .select('*')
                    .eq('communication_id', id)
                    .order('created_at', { ascending: true });

                if (repliesError) console.error("Error fetching replies:", repliesError);
                else setReplies(repliesData || []);

                if (id) {
                    detailCache[id] = { recipient: item as CommunicationRecipient, replies: repliesData || [] };
                }

                if (!item.read_at) {
                    await supabase.from('communication_recipients')
                        .update({ read_at: new Date().toISOString() })
                        .eq('communication_id', item.communication_id)
                        .eq('guardian_id', user?.id);
                }
            }

        } catch (err) {
            console.error('Error loading communication:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleWidgetResponse = async (option: string) => {
        if (!recipient) return;
        setSubmitting(true);
        try {
            const responsePayload = {
                selected_option: option,
                answered_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('communication_recipients')
                .update({ response: responsePayload })
                .eq('communication_id', recipient.communication_id)
                .eq('guardian_id', user?.id)
                .select();

            if (error) throw error;

            if (!data || data.length === 0) {
                if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
                    alert('Como administrador, sua resposta não é registrada como destinatário.');
                    return;
                }
                alert('Erro ao registrar resposta.');
                return;
            }

            setRecipient(prev => prev ? { ...prev, response: responsePayload } : null);
        } catch (error) {
            console.error('Error saving response:', error);
            alert('Erro ao salvar resposta.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !user || !id) return;
        setSubmitting(true);
        try {
            const { data, error } = await supabase
                .from('communication_replies')
                .insert({
                    communication_id: id,
                    guardian_id: user.id,
                    content: replyText
                })
                .select()
                .single();

            if (error) throw error;
            const newReply = data as ReplyMessage;
            setReplies(prev => prev.some(r => r.id === newReply.id) ? prev : [...prev, newReply]);
            setReplyText('');
            setIsEmojiPickerOpen(false);

            // Trigger Push Notification for Teacher
            if (recipient?.communication?.sender_profile_id) {
                const teacherId = recipient.communication.sender_profile_id;
                const parentName = user?.name || 'Responsável';

                await supabase.functions.invoke('send-push', {
                    body: {
                        user_id: teacherId,
                        title: `💬 Nova Resposta: ${parentName}`,
                        body: `Referente a: ${recipient.communication.title}\n"${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}"`,
                        tag: `reply-${id}`,
                        url: `/professor/mensagens/${id}`
                    }
                });
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            alert('Erro ao enviar mensagem.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[100dvh] flex items-center justify-center bg-white overscroll-none">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    if (!recipient || !recipient.communication) {
        return (
            <div className="h-[100dvh] flex flex-col items-center justify-center bg-white p-6 text-center overscroll-none">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Icons.FileX className="w-10 h-10 text-slate-300" />
                </div>
                <h2 className="text-xl font-black text-slate-800 mb-2">Mensagem não encontrada</h2>
                <button onClick={() => navigate(-1)} className="text-blue-600 font-bold uppercase tracking-wider text-sm">Voltar</button>
            </div>
        );
    }

    const handleBack = () => {
        setIsExiting(true);
        setTimeout(() => {
            navigate(-1);
        }, 400);
    };

    const { communication } = recipient;
    const channel = communication.channel;
    const channelColor = channel?.color || 'blue';

    const colorClasses: Record<string, any> = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100', btn: 'bg-blue-600', shadow: 'shadow-blue-200', textDark: 'text-blue-700' },
        green: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', btn: 'bg-emerald-600', shadow: 'shadow-emerald-200', textDark: 'text-emerald-700' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', btn: 'bg-orange-600', shadow: 'shadow-orange-200', textDark: 'text-orange-700' },
        red: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', btn: 'bg-rose-600', shadow: 'shadow-rose-200', textDark: 'text-rose-700' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100', btn: 'bg-purple-600', shadow: 'shadow-purple-200', textDark: 'text-purple-700' }
    };

    const colorScheme = colorClasses[channelColor] || colorClasses.blue;

    return (
        <div
            className={`fixed inset-0 bg-white flex flex-col overflow-hidden overscroll-none shadow-2xl z-50 ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
            style={{
                height: viewportHeight,
                top: 0
            }}
        >
            {/* Header Compacto */}
            <div className="bg-white border-b border-gray-100 shrink-0 z-20 px-6 py-4 pt-safe-area shadow-sm flex items-center gap-3 touch-none select-none">
                <button
                    onClick={handleBack}
                    className="p-2 -ml-1 text-gray-600 hover:bg-gray-100 rounded-xl transition-all active:scale-90"
                >
                    <ArrowLeft size={20} strokeWidth={2.5} />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-black text-slate-800 truncate tracking-tight">{communication.title}</h1>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <span className="uppercase tracking-widest">{channel?.name}</span>
                        <span>•</span>
                        <span>{replies.length} mensagens</span>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto overscroll-none touch-pan-y bg-gray-50/50 relative z-0 scroll-smooth">
                <div className="max-w-3xl mx-auto p-4 space-y-6 pb-4">

                    {/* MAIN CONTENT CARD */}
                    <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-5 flex gap-4 items-start border-b border-slate-50 bg-slate-50/30">
                            <div className={`relative shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${colorScheme.bg} ${colorScheme.text}`}>
                                {(() => {
                                    const Icon = (Icons as any)[channel?.icon_name || 'MessageSquare'] || Icons.MessageSquare;
                                    return <Icon size={28} strokeWidth={1.5} />;
                                })()}
                            </div>

                            <div className="flex-1 min-w-0 pt-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${colorScheme.textDark}`}>
                                        {channel?.name}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                                        {format(new Date(communication.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                                    </span>
                                </div>
                                <h2 className="text-xl font-black text-slate-900 leading-tight mb-2 pr-6">
                                    {communication.title}
                                </h2>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-1 opacity-40">
                                        <span className="text-[9px] font-black uppercase text-slate-500">{(communication as any).sender_profile?.name || 'Escola'}</span>
                                    </div>
                                    {communication.priority === 2 && (
                                        <div className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg border border-rose-100 text-[9px] font-black uppercase tracking-widest">
                                            <Zap size={10} strokeWidth={3} className="fill-rose-600" />
                                            Urgente
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            {communication.target_type === 'CLASS' && recipient.student?.class_enrollments?.[0]?.class?.name && (
                                <div className="mb-6 flex">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-100 shadow-sm">
                                        <Icons.Users size={14} className="text-slate-400" />
                                        <span>Turma: {recipient.student.class_enrollments[0].class.name}</span>
                                    </div>
                                </div>
                            )}
                            <div
                                className="prose prose-slate prose-lg max-w-none text-slate-700 font-sans leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: communication.content }}
                            />
                        </div>

                        {/* Interactive Widgets */}
                        {(communication.metadata?.template === 'rsvp' || communication.metadata?.template === 'poll') && (
                            <div className="px-8 pb-8 pt-2">
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200/50 flex flex-col gap-5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 flex items-center justify-center text-${channelColor}-500 shadow-sm bg-white rounded-xl`}>
                                            {communication.metadata.template === 'rsvp' ? <CalendarCheck size={24} /> : <BarChart2 size={24} />}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                                {communication.metadata.template === 'rsvp' ? 'Confirmação de Evento' : 'Votação Interativa'}
                                            </h3>
                                            <p className="text-xs text-slate-400 font-medium">Sua resposta é importante</p>
                                        </div>
                                    </div>

                                    {communication.metadata.template === 'rsvp' && (
                                        recipient.response ? (
                                            <div className="flex items-center justify-center gap-3 py-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                                                <Check size={20} className="bg-emerald-500 text-white rounded-full p-0.5" strokeWidth={4} />
                                                <span className="text-sm font-black uppercase">Confirmado: {recipient.response.selected_option}</span>
                                            </div>
                                        ) : (
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => handleWidgetResponse('Estarei Presente')}
                                                    disabled={submitting}
                                                    className={`flex-1 py-4 ${colorScheme.btn} text-white rounded-2xl text-sm font-black shadow-lg ${colorScheme.shadow} hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2`}
                                                >
                                                    {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Estarei Presente'}
                                                </button>
                                                <button
                                                    onClick={() => handleWidgetResponse('Não Poderei Comparecer')}
                                                    disabled={submitting}
                                                    className="flex-1 py-4 bg-white text-slate-600 border border-slate-200 rounded-2xl text-sm font-black"
                                                >
                                                    Ausente
                                                </button>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat History */}
                    {replies.length > 0 && (
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-3 py-2 opacity-50">
                                <div className="h-px flex-1 bg-slate-200" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Atendimento</span>
                                <div className="h-px flex-1 bg-slate-200" />
                            </div>

                            {replies.map(reply => {
                                const isMe = !reply.is_admin_reply && reply.guardian_id === user?.id;
                                return (
                                    <div key={reply.id} className={`flex ${isMe ? 'justify-end pl-8' : 'justify-start pr-8'}`}>
                                        <div
                                            className={`px-4 py-2.5 rounded-2xl shadow-sm border text-sm ${isMe
                                                ? `${colorScheme.btn} text-white border-transparent rounded-tr-none shadow-${channelColor}-200`
                                                : 'bg-white text-slate-800 border-slate-100 rounded-tl-none'
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap">{reply.content}</p>
                                            <div className={`text-[8px] mt-1 font-bold italic opacity-60 flex items-center justify-end gap-1 ${isMe ? 'text-white/80' : 'text-slate-400'}`}>
                                                {format(new Date(reply.created_at), "HH:mm")}
                                                {isMe && <CheckCheck size={10} className="opacity-80" />}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div ref={bottomRef} className="h-2" />
                </div>
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-100 p-3 pb-safe-area shrink-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] relative">
                {isEmojiPickerOpen && (
                    <div className="absolute bottom-[100%] left-0 right-0 p-4 z-50 animate-slide-up">
                        <div className="max-w-md mx-auto shadow-2xl rounded-2xl overflow-hidden border border-slate-200">
                            <EmojiPicker
                                onEmojiClick={(emoji) => setReplyText(prev => prev + emoji.emoji)}
                                width="100%"
                                height={350}
                            />
                        </div>
                    </div>
                )}

                <div className="max-w-3xl mx-auto flex items-end gap-2">
                    <button
                        onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                        className={`p-2.5 rounded-xl transition-all active:scale-95 ${isEmojiPickerOpen ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}
                    >
                        <Smile size={22} strokeWidth={2.5} />
                    </button>

                    <div className="flex-1 relative bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-blue-400 focus-within:bg-white transition-all flex items-end p-1 shadow-inner">
                        <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onFocus={() => {
                                window.scrollTo(0, 0);
                                setTimeout(() => {
                                    window.scrollTo(0, 0);
                                    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                                }, 300);
                            }}
                            placeholder="Escreva uma resposta..."
                            className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-24 min-h-[36px] px-3 py-2 text-sm text-slate-800 placeholder-slate-400 font-medium"
                            rows={1}
                        />
                    </div>

                    <button
                        onClick={handleSendReply}
                        disabled={submitting || !replyText.trim()}
                        className={`p-3 ${colorScheme.btn} text-white rounded-xl shadow-lg ${colorScheme.shadow} hover:brightness-110 disabled:opacity-40 disabled:shadow-none transition-all active:scale-95`}
                    >
                        {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} strokeWidth={2.5} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CommunicationDetail;
