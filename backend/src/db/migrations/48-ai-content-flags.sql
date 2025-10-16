-- AI Content Flagging Feature
-- Added: 2025-10-16
-- Description: Adds content flagging/reporting functionality for AI-generated content

-- Add flag-related columns to ai_summaries
ALTER TABLE ai_summaries
    ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS approved_by varchar(255),
    ADD COLUMN IF NOT EXISTS edited_by_human boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_edited_by varchar(255),
    ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS flag_count integer NOT NULL DEFAULT 0;

-- Add flag-related columns to ai_quizzes
ALTER TABLE ai_quizzes
    ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS approved_by varchar(255),
    ADD COLUMN IF NOT EXISTS edited_by_human boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_edited_by varchar(255),
    ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS flag_count integer NOT NULL DEFAULT 0;

-- Create table for content flags/reports
CREATE TABLE IF NOT EXISTS ai_content_flags (
    id bigserial PRIMARY KEY,
    content_type varchar(20) NOT NULL,
    content_id bigint NOT NULL,
    event_id bigint NOT NULL REFERENCES all_events(id) ON DELETE CASCADE,
    username varchar(255),
    reason text,
    status varchar(20) NOT NULL DEFAULT 'pending',
    admin_notes text,
    resolved_by varchar(255),
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_content_type CHECK (content_type IN ('summary', 'quiz'))
);

CREATE INDEX IF NOT EXISTS idx_ai_flags_content ON ai_content_flags(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_ai_flags_event ON ai_content_flags(event_id);
CREATE INDEX IF NOT EXISTS idx_ai_flags_status ON ai_content_flags(status, created_at);

COMMENT ON TABLE ai_content_flags IS 
    'User-reported issues with AI-generated content for admin review';
COMMENT ON COLUMN ai_content_flags.content_type IS 
    'Type of content: summary or quiz';
COMMENT ON COLUMN ai_content_flags.content_id IS 
    'ID of the flagged summary or quiz';
COMMENT ON COLUMN ai_content_flags.status IS 
    'Status: pending, reviewed, dismissed';
COMMENT ON COLUMN ai_content_flags.reason IS 
    'Optional user-provided description of the issue';