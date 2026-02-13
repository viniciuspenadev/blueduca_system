-- RPC to send communication to multiple recipients efficiently
CREATE OR REPLACE FUNCTION public.send_communication(
    p_channel_id UUID,
    p_sender_profile_id UUID,
    p_title TEXT,
    p_preview_text TEXT,
    p_content TEXT,
    p_priority INTEGER,
    p_allow_reply BOOLEAN,
    p_attachments JSONB,
    p_metadata JSONB,
    p_target_type TEXT, -- 'SCHOOL', 'CLASS', 'STUDENT'
    p_target_ids UUID[] -- Array of Class IDs or Student IDs (ignored if SCHOOL)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the function creator (postgres) to read all students
AS $$
DECLARE
    v_communication_id UUID;
BEGIN
    -- 1. Insert the Communication
    INSERT INTO public.communications (
        channel_id,
        sender_profile_id,
        title,
        preview_text,
        content,
        priority,
        allow_reply,
        attachments,
        metadata
    ) VALUES (
        p_channel_id,
        p_sender_profile_id,
        p_title,
        p_preview_text,
        p_content,
        p_priority,
        p_allow_reply,
        p_attachments,
        p_metadata
    ) RETURNING id INTO v_communication_id;

    -- 2. Insert Recipients based on Target (Using DISTINCT to avoid duplicates)
    IF p_target_type = 'SCHOOL' THEN
        -- Insert for ALL active students
        INSERT INTO public.communication_recipients (communication_id, student_id, guardian_id)
        SELECT DISTINCT
            v_communication_id,
            s.id,
            sg.guardian_id
        FROM public.students s
        JOIN public.student_guardians sg ON s.id = sg.student_id
        WHERE s.active = true;

    ELSIF p_target_type = 'CLASS' THEN
        -- Insert for students in specific classes
        INSERT INTO public.communication_recipients (communication_id, student_id, guardian_id)
        SELECT DISTINCT
            v_communication_id,
            s.id,
            sg.guardian_id
        FROM public.class_enrollments ce
        JOIN public.students s ON ce.student_id = s.id
        JOIN public.student_guardians sg ON s.id = sg.student_id
        WHERE ce.class_id = ANY(p_target_ids)
        AND s.active = true;

    ELSIF p_target_type = 'STUDENT' THEN
        -- Insert for specific students
        INSERT INTO public.communication_recipients (communication_id, student_id, guardian_id)
        SELECT DISTINCT
            v_communication_id,
            s.id,
            sg.guardian_id
        FROM public.students s
        JOIN public.student_guardians sg ON s.id = sg.student_id
        WHERE s.id = ANY(p_target_ids);
    END IF;

    RETURN v_communication_id;
END;
$$;
