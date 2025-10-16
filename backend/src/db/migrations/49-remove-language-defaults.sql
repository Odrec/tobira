-- Remove language defaults from AI features tables
-- Added: 2025-10-16
-- Description: Remove default language assumptions from AI content tables.
-- Language should always be explicitly specified, never assumed.

-- Remove default from video_transcripts
alter table video_transcripts 
    alter column language drop default;

-- Remove default from ai_summaries
alter table ai_summaries 
    alter column language drop default;

-- Remove default from ai_quizzes
alter table ai_quizzes 
    alter column language drop default;

-- Remove default from ai_processing_queue
alter table ai_processing_queue 
    alter column language drop default;