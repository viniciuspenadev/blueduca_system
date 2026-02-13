import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { DailyTimeline } from '../types/timeline';

interface UseDailyTimelineProps {
    classId?: string;
    enrollmentId?: string;
}

// Basic global cache for timelines keyed by ID
const timelineCache: Record<string, DailyTimeline> = {};

export const useDailyTimeline = ({ classId, enrollmentId }: UseDailyTimelineProps) => {
    const cacheKey = enrollmentId || classId || 'default';
    const [timeline, setTimeline] = useState<DailyTimeline | null>(timelineCache[cacheKey] || null);
    const [loading, setLoading] = useState(!timelineCache[cacheKey]);

    useEffect(() => {
        const fetchTimeline = async () => {
            try {
                // 1. Try to get override OR class_id from enrollment
                let resolvedClassId = classId;
                let timelineId: string | null = null;

                if (enrollmentId) {
                    const { data: enrollment } = await supabase
                        .from('class_enrollments')
                        .select('daily_timeline_id, class_id')
                        .eq('enrollment_id', enrollmentId)
                        .maybeSingle();

                    if (enrollment) {
                        if (enrollment.daily_timeline_id) {
                            timelineId = enrollment.daily_timeline_id;
                        }
                        if (!resolvedClassId && enrollment.class_id) {
                            resolvedClassId = enrollment.class_id;
                        }
                    }
                }

                // 2. If no override, get from class (using resolvedClassId)
                if (!timelineId && resolvedClassId) {
                    const { data: classData } = await supabase
                        .from('classes')
                        .select('daily_timeline_id')
                        .eq('id', resolvedClassId)
                        .single();

                    if (classData?.daily_timeline_id) {
                        timelineId = classData.daily_timeline_id;
                    }
                }

                if (!timelineId) {
                    setLoading(false);
                    return;
                }

                // 3. Fetch full timeline
                const { data: timelineData, error } = await supabase
                    .from('daily_timelines')
                    .select('*, items:daily_timeline_items(*)')
                    .eq('id', timelineId)
                    .single();

                if (error) throw error;

                // Sort items
                if (timelineData.items) {
                    timelineData.items.sort((a: any, b: any) => a.order_index - b.order_index);
                }

                setTimeline(timelineData);
                timelineCache[cacheKey] = timelineData; // Update Cache

            } catch (err) {
                console.error('Error loading timeline', err);
            } finally {
                setLoading(false);
            }
        };

        if (classId || enrollmentId) {
            fetchTimeline();
        }
    }, [classId, enrollmentId]);

    return { timeline, loading };
};
