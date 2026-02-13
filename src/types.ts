
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SECRETARY' | 'COORDINATOR' | 'TEACHER' | 'PARENT';

export const UserRole = {
    ADMIN: 'ADMIN' as UserRole,
    SECRETARY: 'SECRETARY' as UserRole,
    COORDINATOR: 'COORDINATOR' as UserRole,
    TEACHER: 'TEACHER' as UserRole,
    PARENT: 'PARENT' as UserRole
};

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatar_url?: string;
}

export interface School {
    id: string;
    name: string;
    slug: string;
    plan_tier: 'FREE' | 'START' | 'GOLD' | 'ENTERPRISE';
    config_modules: {
        finance?: boolean;
        academic?: boolean;
        communications?: boolean;
        crm?: boolean;
        library?: boolean;
        menu?: boolean;
    };
    config_limits: {
        max_students?: number;
        max_messages?: number;
    };
    theme_colors?: {
        primary?: string;
        secondary?: string;
    };
    logo_url?: string;
    plan_id?: string;
    active?: boolean;
    [key: string]: any;
}

export interface SchoolMember {
    id: string;
    school_id: string;
    user_id: string;
    role: UserRole;
    school?: School;
}

export interface Student {
    id: string;
    name: string;
    birth_date: string;
    photo_url?: string;
}

export interface Class {
    id: string;
    name: string;
    school_year: number;
    shift: 'morning' | 'afternoon' | 'full' | 'night';
    capacity: number;
    status: 'active' | 'archived';
    created_at?: string;
    daily_timeline_id?: string | null;
    _count?: {
        enrollments: number;
    };
}

export interface ClassEnrollment {
    id: string;
    class_id: string;
    student_id: string;
    enrollment_id: string;
    created_at: string;
    student?: Student;
}

export interface ClassSchedule {
    id: string;
    class_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    subject: string;
    teacher_id?: string;
    teacher?: {
        name: string;
    };
}

export interface Subject {
    id: string;
    name: string;
    emoji: string;
    color: string;
    description?: string;
}

export interface LessonPlan {
    id: string;
    class_id: string;
    teacher_id?: string;
    subject_id: string;
    subject?: Subject;

    date: string;
    start_time: string;
    end_time: string;

    topic?: string;
    objective?: string;
    materials?: string;
    notes?: string;
    homework?: string;

    status: 'planned' | 'completed' | 'cancelled' | 'rescheduled';
    is_modified: boolean;
}

export interface LessonPlanChange {
    id: string;
    lesson_plan_id: string;
    change_type: 'created' | 'updated' | 'cancelled';
    field_changed?: string;
    old_value?: string;
    new_value?: string;
    reason?: string;
    changed_by: string;
    changed_at: string;
    parents_notified: boolean;
}

export interface Event {
    id?: string;
    title: string;
    description?: string;
    start_time: string;
    end_time?: string;
    type: 'academic' | 'holiday' | 'meeting' | 'generic';
    category?: 'event' | 'notice' | 'alert' | 'mural';
    is_pinned?: boolean;
    class_id?: string | null;
    image_url?: string;
    show_on_mural?: boolean;
    created_at?: string;
    created_by?: string;
}

export interface CommunicationChannel {
    id: string;
    name: string;
    icon_name: string;
    color: string;
    is_system_default: boolean;
}

export interface Communication {
    id: string;
    channel_id: string;
    channel?: CommunicationChannel;
    sender_profile_id?: string;
    title: string;
    preview_text?: string;
    content: string;
    priority: number; // 1=Normal, 2=High
    allow_reply: boolean;
    attachments: string[]; // JSONB URLs
    metadata: Record<string, any>;
    created_at: string;
    target_type?: string;
    target_ids?: string[];
    sender_profile?: {
        name: string;
    };
}

export interface CommunicationRecipient {
    id: string;
    communication_id: string;
    student_id: string;
    guardian_id: string;
    read_at?: string;
    is_archived: boolean;
    created_at: string;
    response?: {
        selected_option: string;
        answered_at: string;
    };
    communication?: Communication;
    student?: {
        id: string;
        name: string;
        class_enrollments: {
            class: {
                id: string;
                name: string;
            };
        }[];
    };
}

export interface CommunicationReply {
    id: string;
    communication_id: string;
    guardian_id: string;
    content: string;
    created_at: string;
    guardian?: User; // Joined profile
}
