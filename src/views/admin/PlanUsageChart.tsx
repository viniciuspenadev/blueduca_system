import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { usePlan } from '../../hooks/usePlan';
import {
    Activity,
    MessageSquare,
    HardDrive,
    Users,
    Loader2
} from 'lucide-react';

export const PlanUsageChart: React.FC = () => {
    const { currentSchool } = useAuth();
    const { config } = usePlan();
    const [loading, setLoading] = useState(true);
    const [usage, setUsage] = useState<any>({
        messages: 0,
        storage: 0,
        users: 0
    });

    useEffect(() => {
        if (currentSchool?.id) fetchData();
    }, [currentSchool?.id]);

    const fetchData = async () => {
        try {
            // 1. Get Usage Trackers (Messages & Storage)
            const { data: usageData } = await supabase
                .from('school_usage_trackers')
                .select('*')
                .eq('school_id', currentSchool?.id)
                .single();

            // 2. Get Real User Count
            const { data: userStats } = await supabase
                .rpc('get_school_user_count', { school_id_param: currentSchool?.id });

            setUsage({
                messages: usageData?.messages_sent_count || 0,
                start_date: usageData?.current_period_start,
                users: (userStats?.staff || 0) + (userStats?.guardians || 0) // Logins only (Staff + Guardians)
            });
        } catch (error) {
            console.error('Error fetching usage:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to calculate percentage and color
    const getProgress = (used: number, max: number) => {
        if (!max) return { percent: 0, color: 'bg-gray-300' };
        const percent = Math.min(Math.round((used / max) * 100), 100);
        let color = 'bg-green-500';
        if (percent > 80) color = 'bg-amber-500';
        if (percent > 95) color = 'bg-red-500';
        return { percent, color };
    };

    // Limits from Hook (Override or Plan)
    const maxMessages = config.limits.max_messages_month || 1000;
    const maxUsers = config.limits.max_users || 5; // Default fallback
    const maxStorage = 5 * 1024 * 1024 * 1024; // 5GB default (Mocked)

    const msgProgress = getProgress(usage.messages, maxMessages);
    const storageProgress = getProgress(usage.storage, maxStorage);
    const usersProgress = getProgress(usage.users, maxUsers);
    // Users might be unlimited in some contexts, but let's show progress against "Plan Limit"
    // If limit is super high (unlimited), progress will be tiny, which is correct.

    if (loading) return <div className="p-4 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>;

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Activity className="text-brand-600" size={20} />
                Consumo de Recursos
            </h3>

            <div className="space-y-6">
                {/* Messages */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <MessageSquare size={16} className="text-gray-400" />
                            Mensagens (Mês)
                        </label>
                        <span className="text-xs font-bold text-gray-600">
                            {usage.messages} / {maxMessages >= 999999 ? '∞' : maxMessages}
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${msgProgress.color}`}
                            style={{ width: `${msgProgress.percent}%` }}
                        ></div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 text-right">Renova dia 1º</p>
                </div>

                {/* Storage */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <HardDrive size={16} className="text-gray-400" />
                            Armazenamento
                        </label>
                        <span className="text-xs font-bold text-gray-600">
                            {(usage.storage / 1024 / 1024).toFixed(1)}MB / {(maxStorage / 1024 / 1024 / 1024).toFixed(1)}GB
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${storageProgress.color}`}
                            style={{ width: `${storageProgress.percent}%` }}
                        ></div>
                    </div>
                </div>

                {/* Users (Total) */}
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Users size={16} className="text-gray-400" />
                            Usuários (Logins)
                        </label>
                        <span className="text-xs font-bold text-gray-600">
                            {usage.users} / {maxUsers}
                        </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${usersProgress.color}`}
                            style={{ width: `${usersProgress.percent}%` }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
