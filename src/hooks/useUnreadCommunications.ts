import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useUnreadCommunications = () => {
    const { user } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnreadCount = async () => {
        if (!user) return;

        const { count, error } = await supabase
            .from('communication_recipients')
            .select('*', { count: 'exact', head: true })
            .eq('guardian_id', user.id)
            .is('read_at', null)
            .eq('is_archived', false);

        if (!error && count !== null) {
            setUnreadCount(count);
        }
    };

    useEffect(() => {
        fetchUnreadCount();

        // Optional: Realtime subscription could go here
        const channel = supabase
            .channel('unread-count-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'communication_recipients',
                    filter: `guardian_id=eq.${user?.id}`
                },
                () => {
                    fetchUnreadCount();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return { unreadCount, refresh: fetchUnreadCount };
};
