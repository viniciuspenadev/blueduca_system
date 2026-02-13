import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

// Planning configuration stored in database
export interface PlanningConfig {
    id: string;
    deadline_day: number;        // 0=Sun, 4=Thu
    deadline_time: string;        // "23:59"
    workdays: boolean[];          // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    alert_level: 'strict' | 'moderate' | 'disabled';
    grace_period_days: number;    // 0-7
}

const DEFAULT_CONFIG: PlanningConfig = {
    id: '00000000-0000-0000-0000-000000000001',
    deadline_day: 4,
    deadline_time: '23:59',
    workdays: [true, true, true, true, true, false, false],
    alert_level: 'strict',
    grace_period_days: 0
};

export const usePlanningSettings = () => {
    const { currentSchool } = useAuth(); // Get current school context
    const [config, setConfig] = useState<PlanningConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    // Fetch configuration from database
    const fetchConfig = async () => {
        if (!currentSchool) return;

        try {
            const { data, error } = await supabase
                .from('planning_config')
                .select('*')
                .eq('school_id', currentSchool.id) // Filter by school
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setConfig(data);
            } else {
                // No config yet, use defaults but DON'T save automatically yet to save writes
                // setConfig(DEFAULT_CONFIG); // Already default
            }
        } catch (error) {
            console.error('Failed to fetch planning config:', error);
            setConfig(DEFAULT_CONFIG);
        } finally {
            setLoading(false);
        }
    };

    // Subscribe to realtime changes
    useEffect(() => {
        if (!currentSchool) return;

        fetchConfig();

        const subscription = supabase
            .channel(`planning_config_${currentSchool.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'planning_config',
                    filter: `school_id=eq.${currentSchool.id}` // Scope subscription
                },
                (payload: any) => {
                    setConfig(payload.new as PlanningConfig);
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [currentSchool?.id]);

    // Save configuration (admin only)
    const saveConfig = async (newConfig: Partial<PlanningConfig>) => {
        if (!currentSchool) return { success: false, error: 'No school selected' };

        try {
            const payload = {
                ...config,
                ...newConfig,
                school_id: currentSchool.id, // Enforce school ownership
                // Remove hardcoded ID logic. Let DB handle ID generation on insert, or update by school_id match.
            };

            // Clean payload to prevent 'id: 000...001' from DEFAULT_CONFIG from being sent as an override if it's new
            const { id, ...cleanPayload } = payload;

            // Upsert based on school_id constraint we created
            const { data, error } = await supabase
                .from('planning_config')
                .upsert(cleanPayload, { onConflict: 'school_id' })
                .select()
                .single();

            if (error) throw error;

            setConfig(data);
            return { success: true };
        } catch (error) {
            console.error('Failed to save planning config:', error);
            return { success: false, error };
        }
    };

    return { config, loading, saveConfig };
};
