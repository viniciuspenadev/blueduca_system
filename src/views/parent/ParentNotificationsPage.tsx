import { type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, Calendar, CreditCard, Megaphone, Bus, DoorOpen, CheckCircle2, Clock } from 'lucide-react';
import { useNotifications, type Notification } from '../../contexts/NotificationContext';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';

export const ParentNotificationsPage: FC = () => {
    const { notifications, markAsRead, markAllAsRead } = useNotifications();
    const navigate = useNavigate();

    const groupedNotifications = {
        today: notifications.filter(n => isToday(new Date(n.created_at))),
        yesterday: notifications.filter(n => isYesterday(new Date(n.created_at))),
        week: notifications.filter(n => !isToday(new Date(n.created_at)) && !isYesterday(new Date(n.created_at)) && isThisWeek(new Date(n.created_at))),
        older: notifications.filter(n => !isThisWeek(new Date(n.created_at))),
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        switch (notification.type) {
            case 'diary': navigate('/pais/diario'); break;
            case 'finance': navigate('/pais/financeiro'); break;
            case 'event': navigate('/pais/agenda'); break;
            case 'notice':
            case 'gate':
            case 'bus':
                navigate('/pais/home');
                break;
            default: break;
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'diary': return { icon: <BookOpen className="w-6 h-6 text-brand-600" />, bg: "bg-brand-50" };
            case 'finance': return { icon: <CreditCard className="w-6 h-6 text-rose-600" />, bg: "bg-rose-50" };
            case 'event': return { icon: <Calendar className="w-6 h-6 text-indigo-600" />, bg: "bg-indigo-50" };
            case 'gate': return { icon: <DoorOpen className="w-6 h-6 text-emerald-600" />, bg: "bg-emerald-50" };
            case 'bus': return { icon: <Bus className="w-6 h-6 text-amber-600" />, bg: "bg-amber-50" };
            case 'notice': return { icon: <Megaphone className="w-6 h-6 text-orange-600" />, bg: "bg-orange-50" };
            default: return { icon: <Bell className="w-6 h-6 text-slate-600" />, bg: "bg-slate-50" };
        }
    };

    return (
        <div className="space-y-8 pb-32">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-100 rounded-xl text-brand-600">
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Notificações</h2>
                            <p className="text-xs text-gray-400 font-medium">Acompanhe as últimas atualizações</p>
                        </div>
                    </div>

                    {notifications.some(n => !n.read) && (
                        <button
                            onClick={() => markAllAsRead()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-100 text-brand-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-brand-200 transition-colors"
                        >
                            <CheckCircle2 size={12} strokeWidth={3} />
                            Limpar Tudo
                        </button>
                    )}
                </div>
            </div>

            <div className="px-1 max-w-2xl mx-auto space-y-8">
                {notifications.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                            <Bell className="w-10 h-10 text-gray-200" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Tudo em dia!</h3>
                        <p className="text-gray-500 text-sm max-w-xs mx-auto">
                            Você não tem notificações novas no momento.
                        </p>
                    </div>
                )}

                {Object.entries(groupedNotifications).map(([key, items]) => {
                    if (items.length === 0) return null;

                    const title = {
                        today: 'Hoje',
                        yesterday: 'Ontem',
                        week: 'Esta Semana',
                        older: 'Anteriores'
                    }[key];

                    return (
                        <div key={key} className="space-y-4">
                            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                                {title}
                            </h2>

                            <div className="space-y-3">
                                {items.map((notification) => {
                                    const style = getIcon(notification.type);
                                    return (
                                        <button
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`w-full text-left p-4 rounded-2xl flex items-start gap-4 transition-all active:scale-[0.98] border
                                                ${!notification.read
                                                    ? 'bg-white border-brand-100 shadow-md shadow-brand-50'
                                                    : 'bg-white opacity-70 border-gray-100 shadow-sm'}
                                            `}
                                        >
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${style.bg} border-2 border-white shadow-inner mt-0.5`}>
                                                {style.icon}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-3">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-900 leading-tight">
                                                            {notification.title}
                                                        </h4>
                                                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                                            {notification.message}
                                                        </p>
                                                    </div>
                                                    {!notification.read && (
                                                        <div className="w-2.5 h-2.5 rounded-full bg-brand-500 shrink-0 mt-1 animate-pulse" />
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-gray-400 uppercase">
                                                    <Clock size={10} />
                                                    {format(new Date(notification.created_at), "HH:mm")}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
