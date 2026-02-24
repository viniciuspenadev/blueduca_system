-- Migration: Convert from Single Chat to Departmental Chat
-- IMPORTANT: This will delete all existing chat messages and threads.

-- 1. Reset existing data (CASCADE ensures messages are deleted when threads are deleted, but let's be safe)
TRUNCATE TABLE chat_messages CASCADE;
TRUNCATE TABLE chat_threads CASCADE;

-- 2. Update chat_threads schema
-- Add channel_type and class_id columns
ALTER TABLE chat_threads 
  ADD COLUMN channel_type text NOT NULL DEFAULT 'SECRETARIAT', -- Default to secretariat if missing
  ADD COLUMN class_id uuid REFERENCES classes(id) ON DELETE SET NULL;

-- Remove the default now that the column is populated (safety net)
ALTER TABLE chat_threads ALTER COLUMN channel_type DROP DEFAULT;

-- 3. Update Unique Constraints
-- Drop the old constraint that forced one thread per student per school
ALTER TABLE chat_threads DROP CONSTRAINT IF EXISTS chat_threads_school_student_unique;

-- Add the new constraint allowing one thread per (school, student, channel, class)
-- Note: if class_id is null, it might create issues with uniqueness in some SQL dialects, 
-- but in Postgres, multiple NULLs are distinct. However, typically `class_id` is only null when `channel_type` != 'CLASS'.
-- To prevent duplicates for non-class channels (e.g. multiple SECRETARIAT channels for same student), we can use a unique index
CREATE UNIQUE INDEX chat_threads_unique_idx ON chat_threads(school_id, student_id, channel_type, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 4. Create chat_channel_permissions table
CREATE TABLE chat_channel_permissions (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    channel_type text NOT NULL, -- e.g., 'FINANCE', 'SECRETARIAT'
    staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT chat_channel_permissions_unique UNIQUE (school_id, channel_type, staff_id)
);

-- 5. RLS Policies for chat_channel_permissions
ALTER TABLE chat_channel_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage all permissions in their school
CREATE POLICY "Admins can view channel permissions" 
    ON chat_channel_permissions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "Admins can insert channel permissions" 
    ON chat_channel_permissions FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

CREATE POLICY "Admins can delete channel permissions" 
    ON chat_channel_permissions FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('ADMIN', 'SUPER_ADMIN')
        )
    );

-- Users can read their own permissions
CREATE POLICY "Users can read own channel permissions"
    ON chat_channel_permissions FOR SELECT
    USING (staff_id = auth.uid());

-- 6. Enable Realtime for the new table
alter publication supabase_realtime add table chat_channel_permissions;
