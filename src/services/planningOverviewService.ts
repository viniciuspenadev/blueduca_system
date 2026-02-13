import { supabase } from './supabase';

export interface PlanningOverviewData {
    teacher_id: string;
    teacher_name: string;
    classes: {
        class_id: string;
        class_name: string;
        lesson_dates: string[]; // ['2023-12-01', '2023-12-02']
    }[];
}

export const planningOverviewService = {
    /**
     * Fetches the planning overview data by aggregating Teachers -> Classes -> Plans
     * This is a client-side implementation of what would be a DB RPC.
     */
    async getPlanningOverview(startDate: string, endDate: string): Promise<PlanningOverviewData[]> {

        // 1. Fetch Teachers (Profiles with role TEACHER)
        const { data: teachers, error: teachersError } = await supabase
            .from('profiles')
            .select('id, name')
            .eq('role', 'TEACHER')
            .order('name');

        if (teachersError) throw teachersError;

        // 2. Fetch Class Teachers (Links) & Classes
        // We get all links, then filter by the teachers we found
        const { data: classTeachers, error: ctError } = await supabase
            .from('class_teachers')
            .select(`
                teacher_id,
                class_id,
                class:classes(id, name, school_year)
            `);

        if (ctError) throw ctError;

        // 3. Fetch Lesson Plans in range
        // We fetch ALL plans in range for efficiency (instead of one query per class)
        // Optimization: Filter by class_ids if list is huge, but for now fetch all
        const { data: plans, error: plansError } = await supabase
            .from('lesson_plans')
            .select('class_id, date')
            .gte('date', startDate)
            .lte('date', endDate);

        if (plansError) throw plansError;

        // --- Aggregation Logic ---

        // Map plans by class_id for O(1) lookup
        // class_id -> Set of dates
        const plansMap: Record<string, Set<string>> = {};
        plans?.forEach(p => {
            if (!plansMap[p.class_id]) plansMap[p.class_id] = new Set();
            plansMap[p.class_id].add(p.date);
        });

        // Map class_teachers by teacher_id
        const classesByTeacher: Record<string, any[]> = {};
        classTeachers?.forEach((ct: any) => {
            if (ct.class && ct.teacher_id) {
                if (!classesByTeacher[ct.teacher_id]) classesByTeacher[ct.teacher_id] = [];
                classesByTeacher[ct.teacher_id].push({
                    class_id: ct.class.id,
                    class_name: ct.class.name,
                    lesson_dates: Array.from(plansMap[ct.class.id] || [])
                });
            }
        });

        // Construct Final Result
        const result: PlanningOverviewData[] = teachers.map(t => ({
            teacher_id: t.id,
            teacher_name: t.name || 'Sem Nome',
            classes: classesByTeacher[t.id] || []
        }));

        // Filter out teachers with no classes? Or keep them? 
        // Better keep them so Admin knows they have no classes assigned.
        return result;
    }
};
