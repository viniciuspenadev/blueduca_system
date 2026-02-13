import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { usePlan } from '../hooks/usePlan';

export interface Notification {
    id: string;
    type: 'diary' | 'finance' | 'event' | 'bus' | 'gate' | 'notice';
    title: string;
    message: string;
    read: boolean;
    data: any;
    created_at: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, currentSchool } = useAuth();
    const { hasModule } = usePlan();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        if (!user || !currentSchool) return;
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .eq('school_id', currentSchool?.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) {
            setNotifications([]);
            return;
        }

        fetchNotifications();

        // Realtime Subscription
        const channel = supabase
            .channel('notifications-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const newNotification = payload.new as Notification;
                    setNotifications(prev => [newNotification, ...prev]);

                    // Optional: Play sound or show browser notification here
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, currentSchool]);

    const markAsRead = async (id: string) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            // Revert on error? For now, we keep optimistic UI for better UX
        }
    };

    const markAllAsRead = async () => {
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user!.id)
                .eq('read', false); // Only update unread ones

            if (error) throw error;
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    // Unified Filter Logic
    const visibleNotifications = notifications.filter(n => {
        if (n.type === 'finance' && !hasModule('finance')) return false;
        if ((n.type === 'diary' || n.type === 'notice') && !hasModule('academic')) return false;
        if (n.type === 'event' && !hasModule('communications')) return false;
        return true;
    });

    const unreadCount = visibleNotifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{
            notifications: visibleNotifications,
            unreadCount,
            loading,
            markAsRead,
            markAllAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
