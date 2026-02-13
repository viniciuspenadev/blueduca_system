import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

export const useAppSettings = (key: string, defaultValue: string = '') => {
    const [value, setValue] = useState(defaultValue);
    const [loading, setLoading] = useState(true);
    const { currentSchool, user } = useAuth(); // Get school context

    useEffect(() => {
        if (!currentSchool) return;

        const fetchSetting = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('school_id', currentSchool.id)
                    .eq('key', key)
                    .maybeSingle(); // Changed to maybeSingle to avoid 406 errors

                if (data) {
                    setValue(data.value);
                }
            } catch (err) {
                console.error(`Error fetching setting ${key}:`, err);
            } finally {
                setLoading(false);
            }
        };

        fetchSetting();
    }, [key, currentSchool]);

    const updateSetting = async (newValue: string) => {
        if (!currentSchool) return false;

        try {
            const { error } = await supabase
                .from('app_settings')
                .upsert({
                    school_id: currentSchool.id,
                    key,
                    value: newValue,
                    updated_at: new Date().toISOString(),
                    updated_by: user?.id
                }, { onConflict: 'key,school_id' });

            if (error) throw error;

            setValue(newValue);
            return true;
        } catch (err) {
            console.error(`Error updating setting ${key}:`, err);
            return false;
        }
    };

    return { value, loading, updateSetting };
};
