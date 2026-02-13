-- Add response column to communication_recipients to store poll/rsvp answers
ALTER TABLE communication_recipients 
ADD COLUMN response JSONB DEFAULT NULL;

-- Example of what goes inside response:
-- { "selected_option": "Sim, eu vou", "answered_at": "2024-01-01..." }
