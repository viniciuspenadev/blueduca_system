import React from 'react';
import type { CommunicationRecipient } from '../../types';
import { format, isToday } from 'date-fns';
import * as Icons from 'lucide-react';
import { Sparkles, CalendarCheck, BarChart2, MailOpen } from 'lucide-react';

interface CommunicationCardProps {
    recipient: CommunicationRecipient;
    onClick: () => void;
}

const CommunicationCard: React.FC<CommunicationCardProps> = ({ recipient, onClick }) => {
    const { communication } = recipient;
    if (!communication || !communication.channel) return null;

    const { channel, title, created_at, priority } = communication;
    const isUnread = !recipient.read_at;
    const isActionRequired = (communication.metadata?.template === 'rsvp' || communication.metadata?.template === 'poll') && !recipient.response;

    const dateObj = new Date(created_at);
    const displayDate = isToday(dateObj) ? 'Hoje' : format(dateObj, "dd/MM");

    const getIcon = (name: string, props: any = {}) => {
        const iconName = name.charAt(0).toUpperCase() + name.slice(1);
        const Icon = (Icons as any)[iconName] || Icons.MessageSquare;
        return <Icon {...props} />;
    };

    const channelColor = channel.color || 'blue';

    // Static mapping to ensure Tailwind classes are bundled
    const colorClasses: Record<string, string> = {
        blue: 'text-blue-500 bg-blue-50 text-blue-600',
        emerald: 'text-emerald-500 bg-emerald-50 text-emerald-600',
        amber: 'text-amber-500 bg-amber-50 text-amber-600',
        cyan: 'text-cyan-500 bg-cyan-50 text-cyan-600',
        indigo: 'text-indigo-500 bg-indigo-50 text-indigo-600',
        purple: 'text-purple-500 bg-purple-50 text-purple-600',
        rose: 'text-rose-500 bg-rose-50 text-rose-600',
        orange: 'text-orange-500 bg-orange-50 text-orange-600',
        green: 'text-green-500 bg-green-50 text-green-600',
        red: 'text-red-500 bg-red-50 text-red-600',
        yellow: 'text-yellow-500 bg-yellow-50 text-yellow-600',
    };

    const colorConfig = colorClasses[channelColor] || colorClasses.blue;

    return (
        <div
            onClick={onClick}
            className={`group relative p-3.5 mb-2 cursor-pointer transition-all active:scale-[0.98] rounded-2xl overflow-hidden ${isUnread
                ? 'bg-white shadow-md shadow-slate-200/50 border border-slate-100'
                : 'bg-white border border-slate-100/50 hover:bg-slate-50'
                }`}
        >
            {/* Status Indicator - BOTTOM RIGHT */}
            {isUnread ? (
                <div className="absolute bottom-0 right-0 p-3.5">
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full shadow-[0_0_12px_rgba(37,99,235,0.6)] animate-pulse" />
                </div>
            ) : (
                <div className="absolute bottom-0 right-0 p-3.5">
                    <MailOpen size={18} strokeWidth={2} className="text-slate-200" />
                </div>
            )}

            <div className="flex gap-4 items-start">
                {/* Icon Area - Enhanced with Background */}
                <div className={`relative shrink-0 transition-transform duration-300 group-hover:scale-110 w-14 h-14 rounded-2xl flex items-center justify-center ${colorConfig.split(' ')[1]} ${colorConfig.split(' ')[0]}`}>
                    {getIcon(channel.icon_name, { size: 28, strokeWidth: 1.5 })}
                    {isActionRequired && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-lg flex items-center justify-center text-white shadow-sm animate-bounce-slow">
                            <Sparkles size={10} fill="white" />
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0 flex flex-col pt-1">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${colorConfig.split(' ')[2]}`}>
                                {channel.name}
                            </span>

                            {/* Class Badge moved here */}
                            {communication.target_type === 'CLASS' && recipient.student?.class_enrollments?.[0]?.class?.name && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest border border-slate-200/50">
                                    <Icons.Users size={8} />
                                    {recipient.student.class_enrollments[0].class.name}
                                </div>
                            )}

                            {isActionRequired && (
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1">
                                    <Icons.Flame size={10} strokeWidth={3} />
                                    Ação Pendente
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                            {displayDate}
                        </span>
                    </div>

                    <h3 className={`text-base leading-snug mb-0.5 truncate pr-6 ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                        {title}
                    </h3>


                    {/* Metadata Footer */}
                    <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 opacity-40">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {recipient.student?.name || (Array.isArray(communication.sender_profile) ? communication.sender_profile[0]?.name : communication.sender_profile?.name) || 'Direção'}
                            </span>
                        </div>

                        {/* Actionable items */}
                        {(communication.metadata?.template === 'rsvp' || communication.metadata?.template === 'poll') && (
                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] border ${recipient.response
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : 'bg-amber-50 text-amber-600 border-amber-100'
                                }`}>
                                {communication.metadata.template === 'rsvp' ? <CalendarCheck size={10} /> : <BarChart2 size={10} />}
                                {communication.metadata.template === 'rsvp' ? (recipient.response ? 'Confirmado' : 'Responder RSVP') : (recipient.response ? 'Votado' : 'Votar Agora')}
                            </div>
                        )}

                        {priority === 2 && (
                            <div className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-lg border border-rose-100 text-[9px] font-black uppercase tracking-widest">
                                <Icons.Zap size={10} strokeWidth={3} className="fill-rose-600" />
                                Urgente
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommunicationCard;
