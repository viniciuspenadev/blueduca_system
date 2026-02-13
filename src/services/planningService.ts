import { supabase } from './supabase';
import type { Subject, LessonPlan } from '../types';

export const planningService = {
    // Subjects (Catalog)
    async getSubjects(schoolId?: string) {
        if (!schoolId) return [];
        const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .eq('school_id', schoolId)
            .order('name');

        if (error) throw error;
        return data as Subject[];
    },

    async createSubject(subject: Omit<Subject, 'id'>, schoolId?: string) {
        if (!schoolId) throw new Error('School ID is required');
        const { data, error } = await supabase
            .from('subjects')
            .insert({ ...subject, school_id: schoolId })
            .select()
            .single();

        if (error) throw error;
        return data as Subject;
    },

    async updateSubject(id: string, subject: Partial<Subject>) {
        const { data, error } = await supabase
            .from('subjects')
            .update(subject)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Subject;
    },

    async deleteSubject(id: string) {
        const { error } = await supabase
            .from('subjects')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Lesson Plans
    async getLessonPlans(classId: string, startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('lesson_plans')
            .select(`
                *,
                subject:subjects(*),
                teacher:profiles(*)
            `)
            .eq('class_id', classId)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date')
            .order('start_time');

        if (error) throw error;
        return data as LessonPlan[];
    },

    async getLessonDates(classId: string, startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('lesson_plans')
            .select('date')
            .eq('class_id', classId)
            .gte('date', startDate)
            .lte('date', endDate);

        if (error) throw error;
        // Return unique dates
        const dates = data?.map(d => d.date) || [];
        return [...new Set(dates)];
    },

    async createLessonPlan(plan: Omit<LessonPlan, 'id' | 'is_modified'>, schoolId?: string) {
        // Automatically set is_modified to false (or true if needed logic later)
        // For now trusting DB default

        // Ensure school_id is passed if table has it
        const payload = { ...plan };
        if (schoolId) {
            // @ts-ignore
            payload.school_id = schoolId;
        }

        const user = (await supabase.auth.getUser()).data.user;
        if (user) {
            // @ts-ignore
            payload.teacher_id = user.id;
            // @ts-ignore
            payload.created_by = user.id;
        }

        const { data, error } = await supabase
            .from('lesson_plans')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;
        return data as LessonPlan;
    },

    async updateLessonPlan(id: string, updates: Partial<LessonPlan>, reason?: string, notifyParents: boolean = false) {
        // Logic to record change could be here or via Trigger. 
        // For MVP, if we want to log change, we can do it manually or rely on DB trigger.
        // The requirement implies explicit "notify parents", so we might handle that here.

        // 1. Update Plan
        const { data: updatedPlan, error } = await supabase
            .from('lesson_plans')
            .update({ ...updates, is_modified: true })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // 2. Log Change (Client-side logging for MVP flexibility)
        if (reason || notifyParents) {
            await supabase.from('lesson_plan_changes').insert({
                lesson_plan_id: id,
                change_type: 'updated',
                reason,
                parents_notified: notifyParents,
                changed_by: (await supabase.auth.getUser()).data.user?.id
            });
        }

        return updatedPlan as LessonPlan;
    },

    async deleteLessonPlan(id: string) {
        const { error } = await supabase
            .from('lesson_plans')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
