import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { AlertTriangle, Info, X } from 'lucide-react';

interface Announcement {
    active: boolean;
    message: string;
    type: 'info' | 'warning' | 'error';
}

export const SystemBanner = () => {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        fetchAnnouncement();

        // Realtime subscription
        const channel = supabase
            .channel('sys_config_change')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sys_config', filter: "key=eq.global_announcement" },
                (payload) => {
                    if (payload.new) {
                        setAnnouncement((payload.new as any).value);
                        setVisible(true);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchAnnouncement = async () => {
        const { data } = await supabase
            .from('sys_config')
            .select('value')
            .eq('key', 'global_announcement')
            .single();

        if (data?.value) {
            setAnnouncement(data.value);
        }
    };

    if (!announcement || !announcement.active || !visible) return null;

    const styles = {
        info: 'bg-blue-600 text-white',
        warning: 'bg-amber-500 text-white',
        error: 'bg-red-600 text-white'
    };

    const icons = {
        info: Info,
        warning: AlertTriangle,
        error: AlertTriangle
    };

    const Icon = icons[announcement.type] || Info;

    return (
        <div className={`${styles[announcement.type]} px-4 py-2 shadow-md flex items-center justify-between relative z-50`}>
            <div className="flex items-center gap-3 text-sm font-medium mx-auto">
                <Icon size={18} />
                <span>{announcement.message}</span>
            </div>
            <button
                onClick={() => setVisible(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    );
};
