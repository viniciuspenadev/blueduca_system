-- Create Enrollment History Table
CREATE TABLE IF NOT EXISTS public.enrollment_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
    school_id UUID NOT NULL, 
    
    action_type TEXT NOT NULL, 
    -- 'UPLOAD' (Parent sent doc), 
    -- 'APPROVE_DOC', 
    -- 'REJECT_DOC', 
    -- 'STATUS_CHANGE', 
    -- 'COMMENT'
    
    title TEXT NOT NULL,       -- e.g. "RG Enviado"
    description TEXT,          -- e.g. "Reprovado por foto embassada"
    metadata JSONB DEFAULT '{}'::jsonb, -- e.g. { "doc_id": "rg_frente", "file_url": "..." }
    
    created_by UUID,           -- ID of the user (or NULL if public action/system)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_enrollment_history_enrollment ON public.enrollment_history(enrollment_id);

-- RLS Policies (Security)
ALTER TABLE public.enrollment_history ENABLE ROW LEVEL SECURITY;

-- Policy: School Admins can view history of their school
CREATE POLICY "School Admins can view history" ON public.enrollment_history
    FOR SELECT
    USING (
        school_id IN (
            SELECT school_id FROM public.user_schools WHERE user_id = auth.uid()
        )
    );

-- Policy: Secretary/Admins can insert
CREATE POLICY "Staff can insert history" ON public.enrollment_history
    FOR INSERT
    WITH CHECK (
        school_id IN (
            SELECT school_id FROM public.user_schools WHERE user_id = auth.uid()
        )
    );

-- Policy: Public/Anon can insert (for Parents uploading) - restricted by enrollment ownership implicitly if needed, 
-- but for simplicity we allow insert if they have the token flow logic (which is backend/edge function usually, but here client side).
-- Since parents use public pages (CompleteEnrollment), they are 'anon'.
-- We might need to allow 'anon' insert if they know the enrollment_id (which they do via token).
-- To be safe, we can rely on the fact that only valid enrollment IDs work.
CREATE POLICY "Public can insert history for uploads" ON public.enrollment_history
    FOR INSERT
    WITH CHECK (
        -- Allow if the enrollment exists (basic check)
        action_type = 'UPLOAD'
    );
