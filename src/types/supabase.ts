export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            app_settings: {
                Row: {
                    description: string | null
                    key: string
                    updated_at: string | null
                    updated_by: string | null
                    value: string
                }
                Insert: {
                    description?: string | null
                    key: string
                    updated_at?: string | null
                    updated_by?: string | null
                    value: string
                }
                Update: {
                    description?: string | null
                    key?: string
                    updated_at?: string | null
                    updated_by?: string | null
                    value?: string
                }
                Relationships: []
            }
            class_attendance_sheets: {
                Row: {
                    class_id: string | null
                    created_at: string | null
                    date: string
                    id: string
                    taken_by: string | null
                }
                Insert: {
                    class_id?: string | null
                    created_at?: string | null
                    date: string
                    id?: string
                    taken_by?: string | null
                }
                Update: {
                    class_id?: string | null
                    created_at?: string | null
                    date?: string
                    id?: string
                    taken_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "class_attendance_sheets_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "attendance_dashboard_view"
                        referencedColumns: ["class_id"]
                    },
                    {
                        foreignKeyName: "class_attendance_sheets_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "classes"
                        referencedColumns: ["id"]
                    },
                ]
            }
            class_monthly_plans: {
                Row: {
                    approved_at: string | null
                    approved_by: string | null
                    class_id: string
                    content: string
                    created_at: string | null
                    feedback: string | null
                    id: string
                    month_year: string
                    status: string | null
                    teacher_id: string | null
                    updated_at: string | null
                }
                Insert: {
                    approved_at?: string | null
                    approved_by?: string | null
                    class_id: string
                    content: string
                    created_at?: string | null
                    feedback?: string | null
                    id?: string
                    month_year: string
                    status?: string | null
                    teacher_id?: string | null
                    updated_at?: string | null
                }
                Update: {
                    approved_at?: string | null
                    approved_by?: string | null
                    class_id?: string
                    content?: string
                    created_at?: string | null
                    feedback?: string | null
                    id?: string
                    month_year?: string
                    status?: string | null
                    teacher_id?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "class_monthly_plans_approved_by_fkey"
                        columns: ["approved_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "class_monthly_plans_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "attendance_dashboard_view"
                        referencedColumns: ["class_id"]
                    },
                    {
                        foreignKeyName: "class_monthly_plans_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "classes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "class_monthly_plans_teacher_id_fkey"
                        columns: ["teacher_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            class_schedules: {
                Row: {
                    class_id: string
                    created_at: string | null
                    day_of_week: number
                    end_time: string
                    id: string
                    start_time: string
                    subject: string
                    teacher_id: string | null
                }
                Insert: {
                    class_id: string
                    created_at?: string | null
                    day_of_week: number
                    end_time: string
                    id?: string
                    start_time: string
                    subject: string
                    teacher_id?: string | null
                }
                Update: {
                    class_id?: string
                    created_at?: string | null
                    day_of_week?: number
                    end_time?: string
                    id?: string
                    start_time?: string
                    subject?: string
                    teacher_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "class_schedules_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "attendance_dashboard_view"
                        referencedColumns: ["class_id"]
                    },
                    {
                        foreignKeyName: "class_schedules_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "classes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "class_schedules_teacher_id_fkey"
                        columns: ["teacher_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            class_teachers: {
                Row: {
                    class_id: string
                    created_at: string
                    id: string
                    role: string
                    teacher_id: string
                }
                Insert: {
                    class_id: string
                    created_at?: string
                    id?: string
                    role?: string
                    teacher_id: string
                }
                Update: {
                    class_id?: string
                    created_at?: string
                    id?: string
                    role?: string
                    teacher_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "class_teachers_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "attendance_dashboard_view"
                        referencedColumns: ["class_id"]
                    },
                    {
                        foreignKeyName: "class_teachers_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "classes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "class_teachers_teacher_id_fkey"
                        columns: ["teacher_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            classes: {
                Row: {
                    capacity: number
                    created_at: string | null
                    daily_timeline_id: string | null
                    id: string
                    name: string
                    school_year: number
                    shift: string
                    status: string
                }
                Insert: {
                    capacity?: number
                    created_at?: string | null
                    daily_timeline_id?: string | null
                    id?: string
                    name: string
                    school_year: number
                    shift: string
                    status?: string
                }
                Update: {
                    capacity?: number
                    created_at?: string | null
                    daily_timeline_id?: string | null
                    id?: string
                    name?: string
                    school_year?: number
                    shift?: string
                    status?: string
                }
                Relationships: []
            }
            communication_channels: {
                Row: {
                    color: string
                    created_at: string | null
                    icon_name: string
                    id: string
                    is_system_default: boolean | null
                    name: string
                }
                Insert: {
                    color?: string
                    created_at?: string | null
                    icon_name: string
                    id?: string
                    is_system_default?: boolean | null
                    name: string
                }
                Update: {
                    color?: string
                    created_at?: string | null
                    icon_name?: string
                    id?: string
                    is_system_default?: boolean | null
                    name?: string
                }
                Relationships: []
            }
            communications: {
                Row: {
                    allow_reply: boolean | null
                    attachments: string[] | null
                    channel_id: string | null
                    content: string
                    created_at: string | null
                    id: string
                    metadata: Json | null
                    priority: number | null
                    sender_profile_id: string | null
                    status: string | null
                    title: string
                    updated_at: string | null
                }
                Insert: {
                    allow_reply?: boolean | null
                    attachments?: string[] | null
                    channel_id?: string | null
                    content: string
                    created_at?: string | null
                    id?: string
                    metadata?: Json | null
                    priority?: number | null
                    sender_profile_id?: string | null
                    status?: string | null
                    title: string
                    updated_at?: string | null
                }
                Update: {
                    allow_reply?: boolean | null
                    attachments?: string[] | null
                    channel_id?: string | null
                    content?: string
                    created_at?: string | null
                    id?: string
                    metadata?: Json | null
                    priority?: number | null
                    sender_profile_id?: string | null
                    status?: string | null
                    title?: string
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "communications_channel_id_fkey"
                        columns: ["channel_id"]
                        isOneToOne: false
                        referencedRelation: "communication_channels"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "communications_sender_profile_id_fkey"
                        columns: ["sender_profile_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "communications_status_check"
                        columns: ["status"]
                        isOneToOne: false
                        referencedRelation: "communications"
                        referencedColumns: ["status"]
                    },
                ]
            }
            events: {
                Row: {
                    category: string | null
                    class_id: string | null
                    created_at: string | null
                    created_by: string | null
                    description: string | null
                    end_time: string | null
                    id: string
                    image_url: string | null
                    is_pinned: boolean | null
                    show_on_mural: boolean | null
                    start_time: string
                    title: string
                    type: string
                }
                Insert: {
                    category?: string | null
                    class_id?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    description?: string | null
                    end_time?: string | null
                    id?: string
                    image_url?: string | null
                    is_pinned?: boolean | null
                    show_on_mural?: boolean | null
                    start_time: string
                    title: string
                    type: string
                }
                Update: {
                    category?: string | null
                    class_id?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    description?: string | null
                    end_time?: string | null
                    id?: string
                    image_url?: string | null
                    is_pinned?: boolean | null
                    show_on_mural?: boolean | null
                    start_time?: string
                    title?: string
                    type?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "events_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "attendance_dashboard_view"
                        referencedColumns: ["class_id"]
                    },
                    {
                        foreignKeyName: "events_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "classes"
                        referencedColumns: ["id"]
                    },
                ]
            }
            leads: {
                Row: {
                    assigned_to: string | null
                    created_at: string | null
                    email: string | null
                    id: string
                    name: string
                    notes: string | null
                    phone: string | null
                    priority: string
                    source: string
                    status: string
                    updated_at: string | null
                }
                Insert: {
                    assigned_to?: string | null
                    created_at?: string | null
                    email?: string | null
                    id?: string
                    name: string
                    notes?: string | null
                    phone?: string | null
                    priority?: string
                    source?: string
                    status?: string
                    updated_at?: string | null
                }
                Update: {
                    assigned_to?: string | null
                    created_at?: string | null
                    email?: string | null
                    id?: string
                    name?: string
                    notes?: string | null
                    phone?: string | null
                    priority?: string
                    source?: string
                    status?: string
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "leads_assigned_to_fkey"
                        columns: ["assigned_to"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            lead_children: {
                Row: {
                    birth_date: string | null
                    created_at: string | null
                    id: string
                    intended_grade: string | null
                    lead_id: string
                    name: string
                    previous_school: string | null
                }
                Insert: {
                    birth_date?: string | null
                    created_at?: string | null
                    id?: string
                    intended_grade?: string | null
                    lead_id: string
                    name: string
                    previous_school?: string | null
                }
                Update: {
                    birth_date?: string | null
                    created_at?: string | null
                    id?: string
                    intended_grade?: string | null
                    lead_id?: string
                    name?: string
                    previous_school?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "lead_children_lead_id_fkey"
                        columns: ["lead_id"]
                        isOneToOne: false
                        referencedRelation: "leads"
                        referencedColumns: ["id"]
                    },
                ]
            }
            lead_interactions: {
                Row: {
                    content: string | null
                    created_at: string | null
                    created_by: string | null
                    id: string
                    lead_id: string
                    type: string
                }
                Insert: {
                    content?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    id?: string
                    lead_id: string
                    type: string
                }
                Update: {
                    content?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    id?: string
                    lead_id?: string
                    type?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "lead_interactions_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "lead_interactions_lead_id_fkey"
                        columns: ["lead_id"]
                        isOneToOne: false
                        referencedRelation: "leads"
                        referencedColumns: ["id"]
                    },
                ]
            }
            lesson_plans: {
                Row: {
                    class_id: string
                    created_at: string | null
                    date: string
                    end_time: string
                    homework: string | null
                    id: string
                    is_modified: boolean | null
                    materials: string | null
                    notes: string | null
                    objective: string | null
                    start_time: string
                    status: string
                    subject_id: string
                    teacher_id: string | null
                    topic: string | null
                    updated_at: string | null
                }
                Insert: {
                    class_id: string
                    created_at?: string | null
                    date: string
                    end_time: string
                    homework?: string | null
                    id?: string
                    is_modified?: boolean | null
                    materials?: string | null
                    notes?: string | null
                    objective?: string | null
                    start_time: string
                    status?: string
                    subject_id: string
                    teacher_id?: string | null
                    topic?: string | null
                    updated_at?: string | null
                }
                Update: {
                    class_id?: string
                    created_at?: string | null
                    date?: string
                    end_time?: string
                    homework?: string | null
                    id?: string
                    is_modified?: boolean | null
                    materials?: string | null
                    notes?: string | null
                    objective?: string | null
                    start_time?: string
                    status?: string
                    subject_id?: string
                    teacher_id?: string | null
                    topic?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "lesson_plans_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "attendance_dashboard_view"
                        referencedColumns: ["class_id"]
                    },
                    {
                        foreignKeyName: "lesson_plans_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "classes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "lesson_plans_subject_id_fkey"
                        columns: ["subject_id"]
                        isOneToOne: false
                        referencedRelation: "subjects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "lesson_plans_teacher_id_fkey"
                        columns: ["teacher_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    created_at: string | null
                    email: string
                    id: string
                    name: string | null
                    role: Database["public"]["Enums"]["user_role"] | null
                }
                Insert: {
                    created_at?: string | null
                    email: string
                    id: string
                    name?: string | null
                    role?: Database["public"]["Enums"]["user_role"] | null
                }
                Update: {
                    created_at?: string | null
                    email?: string
                    id?: string
                    name?: string | null
                    role?: Database["public"]["Enums"]["user_role"] | null
                }
                Relationships: []
            }
            student_guardians: {
                Row: {
                    can_pickup: boolean
                    created_at: string | null
                    guardian_id: string
                    id: string
                    is_primary: boolean
                    kinship: string
                    student_id: string
                }
                Insert: {
                    can_pickup?: boolean
                    created_at?: string | null
                    guardian_id: string
                    id?: string
                    is_primary?: boolean
                    kinship: string
                    student_id: string
                }
                Update: {
                    can_pickup?: boolean
                    created_at?: string | null
                    guardian_id?: string
                    id?: string
                    is_primary?: boolean
                    kinship?: string
                    student_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "student_guardians_guardian_id_fkey"
                        columns: ["guardian_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "student_guardians_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["id"]
                    },
                ]
            }
            students: {
                Row: {
                    active: boolean
                    address: string | null
                    allergies: string | null
                    birth_date: string
                    blood_type: string | null
                    created_at: string | null
                    emergency_contact: string | null
                    emergency_phone: string | null
                    gender: string | null
                    health_insurance: string | null
                    id: string
                    medical_conditions: string | null
                    medications: string | null
                    name: string
                    parent_id: string | null
                    photo_url: string | null
                }
                Insert: {
                    active?: boolean
                    address?: string | null
                    allergies?: string | null
                    birth_date: string
                    blood_type?: string | null
                    created_at?: string | null
                    emergency_contact?: string | null
                    emergency_phone?: string | null
                    gender?: string | null
                    health_insurance?: string | null
                    id?: string
                    medical_conditions?: string | null
                    medications?: string | null
                    name: string
                    parent_id?: string | null
                    photo_url?: string | null
                }
                Update: {
                    active?: boolean
                    address?: string | null
                    allergies?: string | null
                    birth_date?: string
                    blood_type?: string | null
                    created_at?: string | null
                    emergency_contact?: string | null
                    emergency_phone?: string | null
                    gender?: string | null
                    health_insurance?: string | null
                    id?: string
                    medical_conditions?: string | null
                    medications?: string | null
                    name?: string
                    parent_id?: string | null
                    photo_url?: string | null
                }
                Relationships: []
            }
            subjects: {
                Row: {
                    color: string
                    created_at: string
                    description: string | null
                    emoji: string
                    id: string
                    name: string
                }
                Insert: {
                    color?: string
                    created_at?: string
                    description?: string | null
                    emoji: string
                    id?: string
                    name: string
                }
                Update: {
                    color?: string
                    created_at?: string
                    description?: string | null
                    emoji: string
                    id?: string
                    name: string
                }
                Relationships: []
            }
        }
        Views: {
            attendance_dashboard_view: {
                Row: {
                    attendance_rate: number | null
                    class_id: string | null
                    class_name: string | null
                    period_name: string | null
                    present_count: number | null
                    school_year: number | null
                    total_attendance_records: number | null
                    total_students: number | null
                }
                Relationships: []
            }
            class_grade_level: {
                Row: {
                    class_id: string | null
                    class_name: string | null
                    student_grade: string | null
                    student_id: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "enrollments_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "classes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "enrollments_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["id"]
                    },
                ]
            }
            class_today_schedule: {
                Row: {
                    class_id: string | null
                    day_of_week: number | null
                    end_time: string | null
                    start_time: string | null
                    subject: string | null
                    teacher_name: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "class_schedules_class_id_fkey"
                        columns: ["class_id"]
                        isOneToOne: false
                        referencedRelation: "classes"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Functions: {
            get_user_role: {
                Args: {
                    user_id: string
                }
                Returns: Database["public"]["Enums"]["user_role"]
            }
        }
        Enums: {
            user_role: "ADMIN" | "SECRETARY" | "TEACHER" | "PARENT" | "COORDINATOR"
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (
        (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
            ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
            : never) &
        (Database[PublicTableNameOrOptions["schema"]] extends { Views: any }
            ? Database[PublicTableNameOrOptions["schema"]]["Views"]
            : never)
    )
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (
        (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
            ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
            : never) &
        (Database[PublicTableNameOrOptions["schema"]] extends { Views: any }
            ? Database[PublicTableNameOrOptions["schema"]]["Views"]
            : never)
    )[TableName] extends {
        Row: infer R
    }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never)[TableName] extends {
            Insert: infer I
        }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never)
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]] extends { Tables: any }
        ? Database[PublicTableNameOrOptions["schema"]]["Tables"]
        : never)[TableName] extends {
            Update: infer U
        }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicEnumNameOrOptions["schema"]] extends { Enums: any }
        ? Database[PublicEnumNameOrOptions["schema"]]["Enums"]
        : never)
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicEnumNameOrOptions["schema"]] extends { Enums: any }
        ? Database[PublicEnumNameOrOptions["schema"]]["Enums"]
        : never)[EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof (Database[PublicCompositeTypeNameOrOptions["schema"]] extends {
        CompositeTypes: any
    }
        ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never)
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicCompositeTypeNameOrOptions["schema"]] extends {
        CompositeTypes: any
    }
        ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never)[CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
