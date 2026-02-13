-- Create communication_channels table
CREATE TABLE IF NOT EXISTS public.communication_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    icon_name TEXT NOT NULL, -- e.g., 'building', 'apple', 'book'
    color TEXT NOT NULL, -- e.g., 'red', 'green', 'blue'
    is_system_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed default channels
INSERT INTO public.communication_channels (name, icon_name, color, is_system_default)
VALUES 
    ('Diretoria', 'building', 'red', true),
    ('Pedagógico', 'book', 'blue', true),
    ('Secretaria', 'file-text', 'purple', true),
    ('Cantina', 'apple', 'green', true),
    ('Eventos', 'calendar', 'orange', true),
    ('Enfermaria', 'activity', 'pink', true)
ON CONFLICT DO NOTHING;

-- Create communications table
CREATE TABLE IF NOT EXISTS public.communications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    channel_id UUID REFERENCES public.communication_channels(id),
    sender_profile_id UUID REFERENCES public.profiles(id),
    title TEXT NOT NULL,
    preview_text TEXT,
    content TEXT NOT NULL, -- HTML support
    priority INTEGER DEFAULT 1, -- 1=Normal, 2=High
    allow_reply BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]'::jsonb, -- Array of URLs
    metadata JSONB DEFAULT '{}'::jsonb, -- Flexible metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create communication_recipients table
CREATE TABLE IF NOT EXISTS public.communication_recipients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    communication_id UUID REFERENCES public.communications(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id),
    guardian_id UUID REFERENCES public.profiles(id),
    read_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Optimize queries for Inbox
CREATE INDEX IF NOT EXISTS idx_communication_recipients_inbox 
ON public.communication_recipients(guardian_id, is_archived, read_at);

-- Create communication_replies table
CREATE TABLE IF NOT EXISTS public.communication_replies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    communication_id UUID REFERENCES public.communications(id) ON DELETE CASCADE,
    guardian_id UUID REFERENCES public.profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.communication_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Channels: Everyone can read, only Admin can manage
CREATE POLICY "Channels are viewable by everyone" ON public.communication_channels
FOR SELECT USING (true);

-- Communications: 
-- Admins/Staff can view all (simplified for now, ideally filtered by role)
CREATE POLICY "Staff can view all communications" ON public.communications
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SECRETARY', 'COORDINATOR', 'TEACHER')
    )
);

-- Communications: Parents can view if they are valid recipients (via JOIN logic usually, but simplified here)
-- Actually, parents query `communication_recipients`, so direct access to `communications` might need to be joined.
-- A common pattern: Allow select on communications if logic exists in recipients.
CREATE POLICY "Guardians can view assigned communications" ON public.communications
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.communication_recipients cr
        WHERE cr.communication_id = communications.id
        AND cr.guardian_id = auth.uid()
    )
);

-- Staff can insert communications
CREATE POLICY "Staff can insert communications" ON public.communications
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SECRETARY', 'COORDINATOR', 'TEACHER')
    )
);

-- Recipients:
-- Guardians can view their own rows
CREATE POLICY "Guardians can view own inbox" ON public.communication_recipients
FOR SELECT USING (guardian_id = auth.uid());

-- Guardians can update 'read_at' and 'is_archived' on their own rows
CREATE POLICY "Guardians can update own inbox" ON public.communication_recipients
FOR UPDATE USING (guardian_id = auth.uid());

-- Staff can view all recipients (for analytics)
CREATE POLICY "Staff can view all recipients" ON public.communication_recipients
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SECRETARY', 'COORDINATOR', 'TEACHER')
    )
);

-- Replies:
-- Guardians can insert replies if allowed
CREATE POLICY "Guardians can insert replies" ON public.communication_replies
FOR INSERT WITH CHECK (
    guardian_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.communications c
        WHERE c.id = communication_id AND c.allow_reply = true
    )
);

-- Guardians can view own replies
CREATE POLICY "Guardians can view own replies" ON public.communication_replies
FOR SELECT USING (guardian_id = auth.uid());

-- Staff can view all replies
CREATE POLICY "Staff can view all replies" ON public.communication_replies
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SECRETARY', 'COORDINATOR', 'TEACHER')
    )
);

-- Trigger to update updated_at
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on public.communications
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on public.communication_recipients
  for each row execute procedure moddatetime (updated_at);
