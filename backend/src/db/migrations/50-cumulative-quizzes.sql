-- Cumulative Quiz Feature
-- Added: 2025-10-22
-- Description: Adds cumulative quiz functionality for series-based learning assessment

-- Create table for cumulative quizzes
CREATE TABLE ai_cumulative_quizzes (
    id bigserial PRIMARY KEY,
    
    -- The video this cumulative quiz is accessed from
    event_id bigint NOT NULL REFERENCES all_events(id) ON DELETE CASCADE,
    
    -- The series this quiz covers
    series_id bigint NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    
    -- Language for internationalization
    language varchar(10) NOT NULL,
    
    -- AI model used for generation
    model varchar(50) NOT NULL,
    processing_time_ms integer,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Content moderation (consistent with ai_quizzes and ai_summaries)
    approved boolean NOT NULL DEFAULT false,
    approved_at timestamptz,
    approved_by varchar(255),
    edited_by_human boolean NOT NULL DEFAULT false,
    last_edited_by varchar(255),
    flagged boolean NOT NULL DEFAULT false,
    flag_count integer NOT NULL DEFAULT 0,
    
    -- Quiz content: array of questions with video context
    -- Each question includes videoContext with eventId, videoTitle, videoNumber, timestamp
    questions jsonb NOT NULL,
    
    -- Metadata for cache validation
    -- Array of event IDs that were included in this cumulative quiz
    included_event_ids bigint[] NOT NULL,
    video_count integer NOT NULL,
    
    -- Ensure one cumulative quiz per (event, language) combination
    UNIQUE(event_id, language),
    
    -- Validate JSON structure
    CHECK (jsonb_typeof(questions) = 'array'),
    CHECK (video_count > 0)
);

-- Indexes for efficient querying
CREATE INDEX idx_cumulative_quiz_event ON ai_cumulative_quizzes(event_id);
CREATE INDEX idx_cumulative_quiz_series ON ai_cumulative_quizzes(series_id);
CREATE INDEX idx_cumulative_quiz_language ON ai_cumulative_quizzes(language);
CREATE INDEX idx_cumulative_quiz_updated ON ai_cumulative_quizzes(updated_at);
CREATE INDEX idx_cumulative_quiz_flagged ON ai_cumulative_quizzes(flagged) WHERE flagged = true;

-- Comments for documentation
COMMENT ON TABLE ai_cumulative_quizzes IS 
    'Cumulative quizzes covering all videos in a series up to a specific point. '
    'Each quiz combines questions from individual video quizzes with added context '
    'about which video each question comes from.';

COMMENT ON COLUMN ai_cumulative_quizzes.event_id IS 
    'The event (video) from which this cumulative quiz is accessed. '
    'The quiz covers all videos in the series up to and including this one.';

COMMENT ON COLUMN ai_cumulative_quizzes.series_id IS 
    'The series this cumulative quiz covers';

COMMENT ON COLUMN ai_cumulative_quizzes.questions IS 
    'JSONB array of questions. Each question includes a videoContext object with: '
    'eventId (which video), videoTitle, videoNumber (position in series), and timestamp';

COMMENT ON COLUMN ai_cumulative_quizzes.included_event_ids IS 
    'Array of event IDs included in this quiz, used for cache validation. '
    'If the list of events in the series changes, this quiz may need regeneration.';

COMMENT ON COLUMN ai_cumulative_quizzes.video_count IS 
    'Number of videos included in this cumulative quiz';