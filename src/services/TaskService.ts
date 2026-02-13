import { supabase } from './supabase';

export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskType = 'manual' | 'system_alert' | 'document_review' | 'financial_followup';

export interface Task {
    id: string;
    title: string;
    description?: string;
    type: TaskType;
    priority: TaskPriority;
    status: TaskStatus;
    due_date?: string;
    related_entity_id?: string;
    created_by?: string;
    created_at: string;
}

export const TaskService = {
    async list() {
        // Fetch tasks, order by priority (critical first) then due_date
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .neq('status', 'done') // Only current tasks by default
            .order('priority', { ascending: false }) // Critical/High first (assuming enum order or we sort client side if enum is alphabetic)
            .order('due_date', { ascending: true });

        if (error) throw error;

        // Custom sort because Postgres enums might not sort semantically by default if not defined carefully
        // We defined: 'low', 'normal', 'high', 'critical' -> if we want Critical top, we can sort in JS
        const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };

        return (data as Task[]).sort((a, b) => {
            const pA = priorityOrder[a.priority] || 0;
            const pB = priorityOrder[b.priority] || 0;
            if (pA !== pB) return pB - pA; // Descending priority
            return new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
        });
    },

    async create(task: Omit<Task, 'id' | 'created_at'>) {
        const { data, error } = await supabase
            .from('tasks')
            .insert(task)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<Task>) {
        const { data, error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async complete(id: string) {
        return this.update(id, { status: 'done' });
    }
};
