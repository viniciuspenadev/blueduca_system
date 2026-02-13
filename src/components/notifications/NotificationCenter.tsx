import type { FC } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';

export const NotificationCenter: FC = () => {
    const { unreadCount } = useNotifications();
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate('/pais/notificacoes')}
            className="p-2.5 hover:bg-white/10 rounded-full relative transition-all active:scale-95"
            aria-label="Ver Notificações"
        >
            <Bell className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
                <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-brand-600 animate-bounce shadow-sm"></span>
            )}
        </button>
    );
};

