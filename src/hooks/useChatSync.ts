import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useChatSync = () => {
    const { user, currentSchool } = useAuth();
    const [unreadTotal, setUnreadTotal] = useState(0);

    const fetchUnreadTotal = async () => {
        if (!user || !currentSchool) return;

        try {
            // 1. Fetch user permissions first
            let allowedChannels: string[] = [];
            let myClasses: string[] = [];

            if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
                const { data: perms } = await supabase
                    .from('chat_channel_permissions')
                    .select('channel_type')
                    .eq('school_id', currentSchool.id)
                    .eq('staff_id', user.id);
                allowedChannels = perms ? perms.map(p => p.channel_type) : [];

                if (user.role === 'TEACHER' || user.role === 'COORDINATOR') {
                    const { data: classes } = await supabase
                        .from('class_teachers')
                        .select('class_id')
                        .eq('teacher_id', user.id);
                    myClasses = classes ? classes.map(c => c.class_id) : [];
                }
            }

            // 2. Fetch all unread threads
            const { data, error } = await supabase
                .from('chat_threads')
                .select('unread_count_school, channel_type, class_id')
                .eq('school_id', currentSchool.id)
                .gt('unread_count_school', 0);

            if (error) throw error;

            // 3. Filter and calculate total
            const filteredData = data.filter(t => {
                if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
                if (t.channel_type === 'CLASS') return myClasses.includes(t.class_id);
                return allowedChannels.includes(t.channel_type);
            });

            const total = filteredData.reduce((acc, curr) => acc + (curr.unread_count_school || 0), 0);
            setUnreadTotal(total);
        } catch (error) {
            console.error('Error fetching unread chat total:', error);
        }
    };

    useEffect(() => {
        if (!user || !currentSchool) return;

        fetchUnreadTotal();

        const channel = supabase
            .channel('global-chat-sync')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_threads',
                    filter: `school_id=eq.${currentSchool.id}`
                },
                () => {
                    fetchUnreadTotal();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, currentSchool?.id]);

    return { unreadTotal, hasUnread: unreadTotal > 0, refresh: fetchUnreadTotal };
};
