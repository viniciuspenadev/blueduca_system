export type TimelineItemType = 'academic' | 'food' | 'rest' | 'transport' | 'other';

export interface DailyTimelineItem {
    id: string;
    timeline_id: string;
    title: string;
    description?: string;
    start_time?: string; // Format "HH:mm"
    end_time?: string;   // Format "HH:mm"
    order_index: number;
    icon?: string;       // Lucide icon name
    color?: string;      // Hex or Tailwind class
    type: TimelineItemType;
    created_at?: string;
    // Enhanced Fields for Lesson Plans
    lesson_plan_id?: string;
    topic?: string;
    objective?: string;
    materials?: string; // or string[]? DB says string usually. The query showed empty string which implies TEXT column.
    homework?: string;
    teacher_name?: string;
    attachments?: any[]; // Keep flexible for now
}

export interface DailyTimeline {
    id: string;
    name: string;
    description?: string;
    is_default: boolean;
    active?: boolean; // UI helper
    items?: DailyTimelineItem[]; // Joined data
    created_at?: string;
    updated_at?: string;
}
