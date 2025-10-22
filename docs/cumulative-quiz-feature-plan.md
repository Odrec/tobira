# Cumulative Series Quiz Feature - Implementation Plan

**Feature Request:** Allow users to choose between a quiz for a single video or a cumulative quiz covering all videos up to the current point in a series.

**Use Case:** Educational series (e.g., class lectures) where students want to test their cumulative learning across multiple sessions.

**Date:** 2025-10-22  
**Status:** Planning Phase - Ready for Implementation

---

## 1. Database Schema Analysis (Actual Tobira Structure)

### Key Findings from Schema Investigation

**Database Statistics:**
- **1,269 series** in database
- Largest series: "Einführungs- und Abschiedsvorlesungen" with **680 events**
- Events span from 1970 to present

**Tables Structure:**
- `all_events` and `all_series` are **BASE TABLES**
- `events` and `series` are **VIEWS** (filtered versions)
- Events link to series via `series` bigint field

### Event Ordering Within Series

**Discovered Ordering Logic:**

Events can be ordered using two methods:

1. **Explicit Order** (when available):
   - Stored in: `metadata->'http://ethz.ch/video/metadata'->>'order'`
   - Type: Integer
   - Not all events have this field

2. **Fallback to Creation Date**:
   - Field: `created` (timestamp with time zone)
   - Used when explicit order is missing

**Proven Query Pattern** (from investigation script):
```sql
SELECT * FROM all_events 
WHERE series = <series_id>
ORDER BY 
  CASE 
    WHEN metadata->'http://ethz.ch/video/metadata'->>'order' IS NOT NULL 
    THEN (metadata->'http://ethz.ch/video/metadata'->>'order')::int
    ELSE 999999
  END,
  created;
```

This ensures:
- Events with explicit order come first (sorted by order number)
- Events without explicit order come after (sorted by creation date)
- Deterministic, stable ordering

### Relevant Database Schema

**all_events table** (base table):
```sql
- id: bigint (primary key)
- series: bigint (foreign key to series table)
- opencast_id: text
- title: text
- description: text
- created: timestamp with time zone
- updated: timestamp with time zone
- duration: integer (milliseconds)
- metadata: jsonb  -- Contains ordering information
- state: event_state ('ready', 'waiting')
-- ... other fields
```

**series table**:
```sql
- id: bigint (primary key)
- opencast_id: text  
- title: text
- description: text
- state: series_state ('ready', 'waiting')
-- ... other fields
```

**blocks table** (connects series to pages):
```sql
- id: bigint
- type: block_type  -- 'series', 'video', 'playlist'
- series: bigint  -- references series.id
- videolist_order: text  -- 'new_to_old', etc.
-- ... other fields
```

---

## 2. Feature Design

### 2.1 User Experience Flow

```
┌─────────────────────────────────────────────────────────┐
│ Video Page (Part of Series - Video 12 of 25)            │
│                                                           │
│  ┌────────────────────────────────────────────────┐    │
│  │ Video Player                                    │    │
│  └────────────────────────────────────────────────┘    │
│                                                           │
│  📚 Part of series: "Introduction to Physics"           │
│                                                           │
│  ┌────────────────────────────────────────────────┐    │
│  │ 🧠 Interactive Quiz                            │    │
│  │                                                 │    │
│  │ Quiz Mode:                                      │    │
│  │  ○ This video only (10 questions)              │    │
│  │  ● Cumulative - All 12 videos (96 questions)   │    │
│  │                                                 │    │
│  │  ✓ Videos 1-12 will be covered                │    │
│  │  [Load Quiz]                                    │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Two Quiz Modes:**

1. **Single Video Mode** (Default - Existing Feature)
   - Questions only from current video
   - Fast to load (quiz already exists)
   - 8-12 questions typically

2. **Cumulative Mode** (New Feature)
   - Questions from current video + all previous videos in series
   - Ordered by video sequence
   - Broader knowledge assessment
   - Shows which video each question comes from

### 2.2 Quiz Mode Selection UI (Recommended Design)

```
┌──────────────────────────────────────────────────────────┐
│ Quiz Mode Selection                                       │
│                                                            │
│  ○ This video only                                        │
│     Current Lecture: "Newton's Laws" (10 questions)      │
│                                                            │
│  ● Cumulative Quiz                                        │
│     All lectures up to here (12 videos, ~96 questions)   │
│                                                            │
│     Includes:                                              │
│     • Lecture 1-11 (previous content)                     │
│     • Lecture 12 (current - Newton's Laws)                │
│                                                            │
│  [Generate / Load Quiz]                                   │
└──────────────────────────────────────────────────────────┘
```

**Benefits of This UI:**
- Clear differentiation between modes
- Shows question count expectations
- Indicates coverage scope
- Prevents confusion about what will be tested

---

## 3. Technical Architecture

### 3.1 Data Model - New Table

**Create:** `ai_cumulative_quizzes` table

```sql
CREATE TABLE ai_cumulative_quizzes (
    id bigserial PRIMARY KEY,
    
    -- The video this cumulative quiz is viewed from
    event_id bigint NOT NULL REFERENCES all_events(id) ON DELETE CASCADE,
    
    -- The series this covers
    series_id bigint NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    
    -- Language for internationalization
    language varchar(10) NOT NULL,
    
    -- AI model used
    model varchar(50) NOT NULL,
    processing_time_ms integer,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Content moderation (consistent with ai_quizzes)
    approved boolean NOT NULL DEFAULT false,
    approved_at timestamptz,
    approved_by varchar(255),
    edited_by_human boolean NOT NULL DEFAULT false,
    last_edited_by varchar(255),
    flagged boolean NOT NULL DEFAULT false,
    flag_count integer NOT NULL DEFAULT 0,
    
    -- Quiz content: array of questions with video context
    questions jsonb NOT NULL,
    
    -- Metadata for cache validation
    included_event_ids bigint[] NOT NULL,
    video_count integer NOT NULL,
    
    -- Ensure one cumulative quiz per (event, language) combination
    UNIQUE(event_id, language),
    
    -- Validate JSON structure
    CHECK (jsonb_typeof(questions) = 'array')
);

-- Indexes for efficient querying
CREATE INDEX idx_cumulative_quiz_event ON ai_cumulative_quizzes(event_id);
CREATE INDEX idx_cumulative_quiz_series ON ai_cumulative_quizzes(series_id);
CREATE INDEX idx_cumulative_quiz_language ON ai_cumulative_quizzes(language);
CREATE INDEX idx_cumulative_quiz_updated ON ai_cumulative_quizzes(updated_at);

-- Comments for documentation
COMMENT ON TABLE ai_cumulative_quizzes IS 
    'Cumulative quizzes covering all videos in a series up to a specific point';
COMMENT ON COLUMN ai_cumulative_quizzes.included_event_ids IS 
    'Array of event IDs included in this quiz for cache validation';
```

### 3.2 Question Format Extension

**Current Single-Video Question:**
```typescript
interface QuizQuestion {
  question: string;
  questionType: "multiple_choice" | "true_false";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  timestamp?: number;  // Seconds in current video
}
```

**New Cumulative Question Format:**
```typescript
interface CumulativeQuizQuestion extends QuizQuestion {
  videoContext: {
    eventId: string;        // Which video this question is from
    videoTitle: string;     // e.g., "Lecture 12: Newton's Laws"
    videoNumber: number;    // Position in series (1-based)
    timestamp?: number;     // Seconds in that specific video
  };
}
```

**Stored in Database (JSONB):**
```json
{
  "question": "What is Newton's First Law?",
  "questionType": "multiple_choice",
  "options": ["Law of Inertia", "F=ma", "Action-Reaction", "Gravity"],
  "correctAnswer": "Law of Inertia",
  "explanation": "Newton's First Law states that...",
  "difficulty": "medium",
  "videoContext": {
    "eventId": "123456789",
    "videoTitle": "Lecture 12: Newton's Laws",
    "videoNumber": 12,
    "timestamp": 245
  }
}
```

---

## 4. Backend Implementation (Rust)

### 4.1 GraphQL Schema Extensions

**New Type: `AiCumulativeQuiz`**

```graphql
type AiCumulativeQuiz {
  eventId: ID!
  seriesId: ID!
  language: String!
  model: String!
  processingTimeMs: Int
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Content moderation
  approved: Boolean!
  approvedAt: DateTime
  approvedBy: String
  editedByHuman: Boolean!
  lastEditedBy: String
  flagged: Boolean!
  flagCount: Int!
  
  # Quiz content
  questions: [CumulativeQuizQuestion!]!
  includedVideos: [VideoInfo!]!
  videoCount: Int!
}

type CumulativeQuizQuestion {
  question: String!
  questionType: QuestionType!
  options: [String!]
  correctAnswer: String!
  explanation: String!
  difficulty: Difficulty!
  
  # Video context for cumulative quizzes
  videoContext: VideoContext!
}

type VideoContext {
  eventId: ID!
  videoTitle: String!
  videoNumber: Int!
  timestamp: Int
}

type VideoInfo {
  eventId: ID!
  title: String!
  position: Int!
  questionCount: Int!
}

enum QuestionType {
  MULTIPLE_CHOICE
  TRUE_FALSE
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}
```

**Extend AuthorizedEvent:**

```graphql
extend type AuthorizedEvent {
  # Existing fields
  aiSummary(language: String!): AiSummary
  aiQuiz(language: String!): AiQuiz
  
  # New - cumulative quiz
  aiCumulativeQuiz(language: String!): AiCumulativeQuiz
  
  # Helper fields
  canGenerateCumulativeQuiz: Boolean!
  seriesVideoPosition: Int  # Position of this video in series (1-based)
  seriesVideoCount: Int     # Total videos in series
}
```

**New Mutations:**

```graphql
extend type Mutation {
  # Generate cumulative quiz (via AI service)
  generateCumulativeQuiz(
    eventId: ID!
    language: String!
    forceRegenerate: Boolean
  ): AiCumulativeQuiz!
  
  # Flag cumulative quiz for review
  flagCumulativeQuiz(
    eventId: ID!
    language: String!
    reason: String
  ): AiCumulativeQuiz!
}
```

### 4.2 Rust Implementation

**New file: `backend/src/api/model/ai_cumulative.rs`**

```rust
use chrono::{DateTime, Utc};
use juniper::GraphQLObject;
use serde::{Deserialize, Serialize};

use crate::{
    api::{Context, Id},
    db::types::Key,
    prelude::*,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiCumulativeQuiz {
    pub event_id: Key,
    pub series_id: Key,
    pub language: String,
    pub model: String,
    pub processing_time_ms: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    
    // Content moderation
    pub approved: bool,
    pub approved_at: Option<DateTime<Utc>>,
    pub approved_by: Option<String>,
    pub edited_by_human: bool,
    pub last_edited_by: Option<String>,
    pub flagged: bool,
    pub flag_count: i32,
    
    // Quiz data
    pub questions: Vec<CumulativeQuizQuestion>,
    pub included_event_ids: Vec<Key>,
    pub video_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, GraphQLObject)]
pub struct CumulativeQuizQuestion {
    pub question: String,
    pub question_type: String,
    pub options: Option<Vec<String>>,
    pub correct_answer: String,
    pub explanation: String,
    pub difficulty: String,
    pub video_context: VideoContext,
}

#[derive(Debug, Clone, Serialize, Deserialize, GraphQLObject)]
pub struct VideoContext {
    pub event_id: String,
    pub video_title: String,
    pub video_number: i32,
    pub timestamp: Option<i32>,
}

impl AiCumulativeQuiz {
    pub async fn load_for_event(
        event_id: Key,
        language: &str,
        context: &Context,
    ) -> ApiResult<Option<Self>> {
        let query = "
            SELECT 
                event_id, series_id, language, model, processing_time_ms,
                created_at, updated_at, approved, approved_at, approved_by,
                edited_by_human, last_edited_by, flagged, flag_count,
                questions, included_event_ids, video_count
            FROM ai_cumulative_quizzes
            WHERE event_id = $1 AND language = $2
        ";
        
        context.db
            .query_opt(query, &[&event_id, &language])
            .await?
            .map(|row| {
                // Parse from database row
                // ... row mapping logic
            })
            .pipe(Ok)
    }
    
    pub async fn can_generate(
        event_id: Key,
        context: &Context,
    ) -> ApiResult<bool> {
        // Check if event is part of a series
        let query = "
            SELECT series FROM all_events 
            WHERE id = $1 AND series IS NOT NULL
        ";
        
        let has_series = context.db
            .query_opt(query, &[&event_id])
            .await?
            .is_some();
            
        Ok(has_series)
    }
    
    pub async fn get_series_position(
        event_id: Key,
        context: &Context,
    ) -> ApiResult<Option<i32>> {
        // Using the proven ordering logic from schema investigation
        let query = "
            WITH ordered_events AS (
                SELECT 
                    id,
                    ROW_NUMBER() OVER (
                        ORDER BY 
                            CASE 
                                WHEN metadata->'http://ethz.ch/video/metadata'->>'order' IS NOT NULL 
                                THEN (metadata->'http://ethz.ch/video/metadata'->>'order')::int
                                ELSE 999999
                            END,
                            created
                    ) as position
                FROM all_events
                WHERE series = (SELECT series FROM all_events WHERE id = $1)
                    AND state = 'ready'
            )
            SELECT position FROM ordered_events WHERE id = $1
        ";
        
        context.db
            .query_opt(query, &[&event_id])
            .await?
            .map(|row| row.get::<_, i32>(0))
            .pipe(Ok)
    }
}
```

**Add to `backend/src/api/model/event.rs`:**

```rust
async fn ai_cumulative_quiz(
    &self,
    context: &Context,
    language: String,
) -> ApiResult<Option<AiCumulativeQuiz>> {
    AiCumulativeQuiz::load_for_event(self.key, &language, context).await
}

async fn can_generate_cumulative_quiz(
    &self, 
    context: &Context
) -> ApiResult<bool> {
    AiCumulativeQuiz::can_generate(self.key, context).await
}

async fn series_video_position(
    &self, 
    context: &Context
) -> ApiResult<Option<i32>> {
    AiCumulativeQuiz::get_series_position(self.key, context).await
}

async fn series_video_count(
    &self,
    context: &Context
) -> ApiResult<Option<i32>> {
    if self.series.is_none() {
        return Ok(None);
    }
    
    let query = "
        SELECT COUNT(*)::int
        FROM all_events
        WHERE series = $1 AND state = 'ready'
    ";
    
    context.db
        .query_one(query, &[&self.series_key()?])
        .await?
        .get::<_, i32>(0)
        .pipe(Some)
        .pipe(Ok)
}
```

---

## 5. AI Service Implementation

### 5.1 Core Query: Get Series Events in Order

**File: `tobira-ai-service/src/services/database.service.ts`**

Add method:
```typescript
async getSeriesEventsUpTo(
  seriesId: string,
  upToEventId: string,
  language: string
): Promise<SeriesEvent[]> {
  // Using the proven ordering logic from schema investigation
  const query = `
    WITH ordered_events AS (
      SELECT 
        id,
        opencast_id,
        title,
        created,
        ROW_NUMBER() OVER (
          ORDER BY 
            CASE 
              WHEN metadata->'http://ethz.ch/video/metadata'->>'order' IS NOT NULL 
              THEN (metadata->'http://ethz.ch/video/metadata'->>'order')::int
              ELSE 999999
            END,
            created
        ) as position
      FROM all_events
      WHERE series = $1 
        AND state = 'ready'
    ),
    target_position AS (
      SELECT position 
      FROM ordered_events 
      WHERE id = $2
    )
    SELECT 
      e.id,
      e.opencast_id,
      e.title,
      e.position
    FROM ordered_events e, target_position t
    WHERE e.position <= t.position
    ORDER BY e.position ASC
  `;
  
  const result = await this.pool.query(query, [seriesId, upToEventId]);
  return result.rows;
}
```

### 5.2 Cumulative Quiz Service

**File: `tobira-ai-service/src/services/cumulative-quiz.service.ts` (NEW)**

```typescript
import { DatabaseService } from './database.service';
import { OpenAIService } from './openai.service';
import { CacheService } from './cache.service';

export interface CumulativeQuiz {
  eventId: string;
  seriesId: string;
  language: string;
  model: string;
  questions: CumulativeQuizQuestion[];
  includedEventIds: string[];
  videoCount: number;
  processingTimeMs: number;
}

export interface CumulativeQuizQuestion {
  question: string;
  questionType: 'multiple_choice' | 'true_false';
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  videoContext: {
    eventId: string;
    videoTitle: string;
    videoNumber: number;
    timestamp?: number;
  };
}

export class CumulativeQuizService {
  constructor(
    private db: DatabaseService,
    private openai: OpenAIService,
    private cache: CacheService
  ) {}

  async generateCumulativeQuiz(
    eventId: string,
    language: string = 'en',
    forceRegenerate: boolean = false
  ): Promise<CumulativeQuiz> {
    const startTime = Date.now();
    
    // 1. Check cache first
    if (!forceRegenerate) {
      const cached = await this.getCachedQuiz(eventId, language);
      if (cached && await this.isCacheValid(cached)) {
        console.log(`Using cached cumulative quiz for event ${eventId}`);
        return cached;
      }
    }
    
    // 2. Get event and verify it's part of a series
    const event = await this.db.getEvent(eventId);
    if (!event.seriesId) {
      throw new Error('Event is not part of a series');
    }
    
    // 3. Get all events in series up to and including this one
    // Using the proven ordering query from schema investigation
    const seriesEvents = await this.db.getSeriesEventsUpTo(
      event.seriesId,
      eventId,
      language
    );
    
    console.log(`Found ${seriesEvents.length} events in series up to event ${eventId}`);
    
    // 4. Get or generate individual quizzes for each event
    const individualQuizzes = await Promise.all(
      seriesEvents.map(e => this.getOrGenerateIndividualQuiz(e.id, language))
    );
    
    // 5. Combine quizzes with video context
    const questions = this.combineQuizzes(individualQuizzes, seriesEvents);
    
    console.log(`Combined ${questions.length} questions from ${seriesEvents.length} videos`);
    
    // 6. Save cumulative quiz
    const quiz: CumulativeQuiz = {
      eventId,
      seriesId: event.seriesId,
      language,
      model: process.env.DEFAULT_MODEL || 'gpt-4',
      questions,
      includedEventIds: seriesEvents.map(e => e.id),
      videoCount: seriesEvents.length,
      processingTimeMs: Date.now() - startTime
    };
    
    await this.saveCumulativeQuiz(quiz);
    
    return quiz;
  }
  
  private async getOrGenerateIndividualQuiz(
    eventId: string,
    language: string
  ): Promise<any> {
    // Try to get existing quiz
    let quiz = await this.db.getQuiz(eventId, language);
    
    // If doesn't exist, generate it
    if (!quiz) {
      console.log(`Generating individual quiz for event ${eventId}`);
      // This calls the existing quiz generation logic
      quiz = await this.openai.generateQuiz(eventId, language);
      await this.db.saveQuiz(quiz);
    }
    
    return quiz;
  }
  
  private combineQuizzes(
    quizzes: any[],
    events: any[]
  ): CumulativeQuizQuestion[] {
    const combined: CumulativeQuizQuestion[] = [];
    
    quizzes.forEach((quiz, index) => {
      const event = events[index];
      
      // Add each question with video context
      quiz.questions.forEach((q: any) => {
        combined.push({
          question: q.question,
          questionType: q.questionType,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          videoContext: {
            eventId: event.id,
            videoTitle: event.title,
            videoNumber: index + 1,
            timestamp: q.timestamp
          }
        });
      });
    });
    
    return combined;
  }
  
  private async saveCumulativeQuiz(quiz: CumulativeQuiz): Promise<void> {
    const query = `
      INSERT INTO ai_cumulative_quizzes (
        event_id, series_id, language, model, processing_time_ms,
        questions, included_event_ids, video_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (event_id, language)
      DO UPDATE SET
        questions = EXCLUDED.questions,
        included_event_ids = EXCLUDED.included_event_ids,
        video_count = EXCLUDED.video_count,
        processing_time_ms = EXCLUDED.processing_time_ms,
        updated_at = now()
      RETURNING *
    `;
    
    await this.db.pool.query(query, [
      quiz.eventId,
      quiz.seriesId,
      quiz.language,
      quiz.model,
      quiz.processingTimeMs,
      JSON.stringify(quiz.questions),
      quiz.includedEventIds,
      quiz.videoCount
    ]);
    
    // Cache the result
    const cacheKey = `cumulative_quiz:${quiz.eventId}:${quiz.language}`;
    await this.cache.set(cacheKey, quiz, 604800); // 7 days TTL
  }
  
  private async getCachedQuiz(
    eventId: string,
    language: string
  ): Promise<CumulativeQuiz | null> {
    // Try memory cache first
    const cacheKey = `cumulative_quiz:${eventId}:${language}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    
    // Try database
    const query = `
      SELECT * FROM ai_cumulative_quizzes
      WHERE event_id = $1 AND language = $2
    `;
    const result = await this.db.pool.query(query, [eventId, language]);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const quiz: CumulativeQuiz = {
        eventId: row.event_id,
        seriesId: row.series_id,
        language: row.language,
        model: row.model,
        questions: row.questions,
        includedEventIds: row.included_event_ids,
        videoCount: row.video_count,
        processingTimeMs: row.processing_time_ms
      };
      
      // Re-cache it
      await this.cache.set(cacheKey, quiz, 604800);
      return quiz;
    }
    
    return null;
  }
  
  private async isCacheValid(quiz: CumulativeQuiz): Promise<boolean> {
    // Check if the list of events in the series has changed
    const currentEvents = await this.db.getSeriesEventsUpTo(
      quiz.seriesId,
      quiz.eventId,
      quiz.language
    );
    
    const currentEventIds = currentEvents.map(e => e.id).sort();
    const cachedEventIds = [...quiz.includedEventIds].sort();
    
    // Cache is valid if same events are included
    return JSON.stringify(currentEventIds) === JSON.stringify(cachedEventIds);
  }
}
```

### 5.3 REST API Endpoints

**File: `tobira-ai-service/src/index.ts`**

Add routes:
```typescript
import { CumulativeQuizService } from './services/cumulative-quiz.service';

const cumulativeQuizService = new CumulativeQuizService(
  databaseService,
  openaiService,
  cacheService
);

// Get cumulative quiz
app.get('/api/cumulative-quizzes/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { language = 'en' } = req.query;
    
    const quiz = await cumulativeQuizService.getCachedQuiz(
      eventId,
      language as string
    );
    
    if (!quiz) {
      return res.status(404).json({ error: 'Cumulative quiz not found' });
    }
    
    res.json(quiz);
  } catch (error) {
    console.error('Error retrieving cumulative quiz:', error);
    res.status(500).json({ error: 'Failed to retrieve cumulative quiz' });
  }
});

// Generate cumulative quiz
app.post('/api/cumulative-quizzes/generate/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { language = 'en', forceRegenerate = false } = req.body;
    
    const quiz = await cumulativeQuizService.generateCumulativeQuiz(
      eventId,
      language,
      forceRegenerate
    );
    
    res.json(quiz);
  } catch (error) {
    console.error('Error generating cumulative quiz:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate cumulative quiz' 
    });
  }
});
```

---

## 6. Frontend Implementation

### 6.1 GraphQL Fragment Extensions

**File: `frontend/src/routes/Video.tsx`**

Update fragment:
```graphql
fragment VideoPageEventData on AuthorizedEvent {
  # ... existing fields
  
  # Cumulative quiz support
  canGenerateCumulativeQuiz
  seriesVideoPosition
  seriesVideoCount
  
  aiCumulativeQuiz(language: "en") {
    eventId
    seriesId
    language
    questions {
      question
      questionType
      options
      correctAnswer
      explanation
      difficulty
      videoContext {
        eventId
        videoTitle
        videoNumber
        timestamp
      }
    }
    includedVideos {
      eventId
      title
      position
      questionCount
    }
    videoCount
    model
    approved
    approvedAt
    approvedBy
    editedByHuman
    lastEditedBy
    flagged
    flagCount
  }
}
```

### 6.2 Quiz Mode Selector Component

**File: `frontend/src/ui/AiQuizModeSelector.tsx` (NEW)**

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@opencast/appkit';
import { COLORS } from '../color';
import { AiQuiz } from './AiQuiz';
import { AiCumulativeQuiz } from './AiCumulativeQuiz';

type QuizMode = 'single' | 'cumulative';

interface Props {
  event: {
    id: string;
    aiQuiz?: any;
    aiCumulativeQuiz?: any;
    canGenerateCumulativeQuiz: boolean;
    seriesVideoPosition?: number;
    seriesVideoCount?: number;
  };
  onSeekToTimestamp?: (seconds: number) => Promise<boolean>;
}

export const AiQuizModeSelector: React.FC<Props> = ({ event, onSeekToTimestamp }) => {
  const { t } = useTranslation();
  const [quizMode, setQuizMode] = useState<QuizMode>('single');
  
  const canUseCumulative = event.canGenerateCumulativeQuiz && 
                           event.seriesVideoPosition && 
                           event.seriesVideoPosition > 1;
  
  // If can't use cumulative, just show regular quiz
  if (!canUseCumulative) {
    return event.aiQuiz ? (
      <AiQuiz fragmentRef={event.aiQuiz} onSeekToTimestamp={onSeekToTimestamp} />
    ) : null;
  }
  
  const singleQuestionCount = event.aiQuiz?.questions?.length || 0;
  const cumulativeQuestionCount = event.aiCumulativeQuiz?.questions?.length || 0;
  
  return (
    <div css={{
      padding: '20px 22px',
      marginTop: '16px',
      backgroundColor: COLORS.neutral10,
      borderRadius: 8,
    }}>
      {/* Mode Selector */}
      <div css={{ marginBottom: '1.5rem' }}>
        <h3 css={{ margin: '0 0 1rem 0' }}>
          {t('video.ai-quiz.title', 'Interactive Quiz')}
        </h3>
        
        <div css={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}>
          {/* Single Video Option */}
          <label css={{
            display: 'flex',
            alignItems: 'flex-start',
            cursor: 'pointer',
            padding: '0.75rem',
            borderRadius: 4,
            border: `2px solid ${quizMode === 'single' ? COLORS.primary0 : COLORS.neutral25}`,
            backgroundColor: quizMode === 'single' ? COLORS.primary1 : 'transparent',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: COLORS.primary0,
            },
          }}>
            <input
              type="radio"
              value="single"
              checked={quizMode === 'single'}
              onChange={() => setQuizMode('single')}
              css={{
                marginRight: '0.75rem',
                marginTop: '0.25rem',
                cursor: 'pointer',
              }}
            />
            <div css={{ flex: 1 }}>
              <div css={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                {t('video.ai-quiz.single-mode', 'This video only')}
              </div>
              <div css={{ fontSize: '0.85rem', color: COLORS.neutral40 }}>
                {singleQuestionCount > 0 
                  ? t('video.ai-quiz.question-count', '{{count}} questions', { count: singleQuestionCount })
                  : t('video.ai-quiz.not-generated', 'Not yet generated')
                }
              </div>
            </div>
          </label>
          
          {/* Cumulative Option */}
          <label css={{
            display: 'flex',
            alignItems: 'flex-start',
            cursor: 'pointer',
            padding: '0.75rem',
            borderRadius: 4,
            border: `2px solid ${quizMode === 'cumulative' ? COLORS.primary0 : COLORS.neutral25}`,
            backgroundColor: quizMode === 'cumulative' ? COLORS.primary1 : 'transparent',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: COLORS.primary0,
            },
          }}>
            <input
              type="radio"
              value="cumulative"
              checked={quizMode === 'cumulative'}
              onChange={() => setQuizMode('cumulative')}
              css={{
                marginRight: '0.75rem',
                marginTop: '0.25rem',
                cursor: 'pointer',
              }}
            />
            <div css={{ flex: 1 }}>
              <div css={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                {t(
                  'video.ai-quiz.cumulative-mode',
                  'Cumulative - All {{count}} videos up to here',
                  { count: event.seriesVideoPosition }
                )}
              </div>
              <div css={{ fontSize: '0.85rem', color: COLORS.neutral40 }}>
                {cumulativeQuestionCount > 0
                  ? t('video.ai-quiz.question-count', '{{count}} questions', { count: cumulativeQuestionCount })
                  : t('video.ai-quiz.will-generate', 'Will be generated')
                }
              </div>
            </div>
          </label>
        </div>
        
        {/* Cumulative Quiz Info */}
        {quizMode === 'cumulative' && event.aiCumulativeQuiz?.includedVideos && (
          <div css={{
            padding: '0.75rem',
            backgroundColor: COLORS.neutral05,
            borderRadius: 4,
            fontSize: '0.85rem',
            marginTop: '0.5rem',
          }}>
            <strong>{t('video.ai-quiz.covers-videos', 'Covers these videos:')}</strong>
            <ul css={{ 
              marginTop: '0.5rem', 
              paddingLeft: '1.5rem',
              marginBottom: 0,
            }}>
              {event.aiCumulativeQuiz.includedVideos.map((video: any) => (
                <li key={video.eventId}>
                  {video.title} ({video.questionCount} questions)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Quiz Display */}
      {quizMode === 'single' && event.aiQuiz ? (
        <AiQuiz fragmentRef={event.aiQuiz} onSeekToTimestamp={onSeekToTimestamp} />
      ) : quizMode === 'cumulative' && event.aiCumulativeQuiz ? (
        <AiCumulativeQuiz 
          fragmentRef={event.aiCumulativeQuiz} 
          onSeekToTimestamp={onSeekToTimestamp}
          currentEventId={event.id}
        />
      ) : (
        <div css={{
          padding: '2rem',
          textAlign: 'center',
          color: COLORS.neutral40,
        }}>
          {t('video.ai-quiz.not-available', 'Quiz not yet available. Generate it using the AI service.')}
        </div>
      )}
    </div>
  );
};
```

### 6.3 Cumulative Quiz Component

**File: `frontend/src/ui/AiCumulativeQuiz.tsx` (NEW)**

```typescript
import React, { useState } from 'react';
import { useFragment, graphql } from 'react-relay/hooks';
import { useTranslation } from 'react-i18next';
import { Button } from '@opencast/appkit';
import { LuCheck, LuX, LuVideo, LuExternalLink } from 'react-icons/lu';

import { AiCumulativeQuiz$key } from './__generated__/AiCumulativeQuiz.graphql';
import { COLORS } from '../color';
import { FlagContentButton } from './FlagContentButton';

const fragment = graphql`
  fragment AiCumulativeQuiz on AiCumulativeQuiz {
    eventId
    language
    questions {
      question
      questionType
      options
      correctAnswer
      explanation
      difficulty
      videoContext {
        eventId
        videoTitle
        videoNumber
        timestamp
      }
    }
    model
    approved
    flagged
  }
`;

interface Props {
  fragmentRef: AiCumulativeQuiz$key;
  onSeekToTimestamp?: (seconds: number) => Promise<boolean>;
  currentEventId: string;
}

export const AiCumulativeQuiz: React.FC<Props> = ({ 
  fragmentRef, 
  onSeekToTimestamp,
  currentEventId 
}) => {
  const { t } = useTranslation();
  const data = useFragment(fragment, fragmentRef);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  
  if (!data || !data.questions || data.questions.length === 0) {
    return null;
  }
  
  const question = data.questions[currentQuestion];
  const isAnswered = answeredQuestions.has(currentQuestion);
  const isCorrect = question.questionType === 'true_false'
    ? selectedAnswer?.toLowerCase() === String(question.correctAnswer).toLowerCase()
    : selectedAnswer === question.correctAnswer;
  
  const handleAnswer = (answer: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(answer);
    setShowExplanation(true);
    
    const answerIsCorrect = question.questionType === 'true_false'
      ? answer.toLowerCase() === String(question.correctAnswer).toLowerCase()
      : answer === question.correctAnswer;
    
    if (answerIsCorrect) {
      setScore(score + 1);
    }
    
    setAnsweredQuestions(new Set([...answeredQuestions, currentQuestion]));
  };
  
  const handleNext = () => {
    if (currentQuestion < data.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };
  
  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };
  
  const handleVideoNavigation = async () => {
    const { eventId, timestamp } = question.videoContext;
    
    if (eventId === currentEventId && timestamp != null && onSeekToTimestamp) {
      // Same video - seek to timestamp
      await onSeekToTimestamp(timestamp);
    } else {
      // Different video - open in new tab or navigate
      window.open(`/v/${eventId}?t=${timestamp || 0}`, '_blank');
    }
  };
  
  return (
    <div>
      {/* Video Context Badge */}
      <div css={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '6px 12px',
        backgroundColor: COLORS.primary1,
        borderRadius: 4,
        fontSize: '0.85rem',
        marginBottom: '1rem',
        fontWeight: 500,
      }}>
        <LuVideo size={14} />
        <span>
          {t('video.ai-quiz.from-video', 'Video {{number}}: {{title}}', {
            number: question.videoContext.videoNumber,
            title: question.videoContext.videoTitle
          })}
        </span>
      </div>
      
      {/* Question Progress */}
      <div css={{
        marginBottom: '1rem',
        fontSize: '0.85rem',
        color: COLORS.neutral40,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>
          {t('video.ai-quiz.question-number', 'Question {{current}} of {{total}}', {
            current: currentQuestion + 1,
            total: data.questions.length
          })}
          {' · '}
          <span css={{ textTransform: 'capitalize' }}>{question.difficulty}</span>
        </span>
        <span>
          {t('video.ai-quiz.score', 'Score:')} {score}/{data.questions.length}
        </span>
      </div>
      
      {/* Question */}
      <div css={{
        fontSize: '1.1rem',
        fontWeight: 500,
        marginBottom: '1.5rem',
      }}>
        {question.question}
      </div>
      
      {/* Answer Options */}
      <div css={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {question.questionType === 'true_false' ? (
          <>
            {['True', 'False'].map(option => (
              <Button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={isAnswered}
                css={{
                  justifyContent: 'flex-start',
                  padding: '1rem',
                  backgroundColor: isAnswered && selectedAnswer === option
                    ? (isCorrect ? COLORS.happy0 : COLORS.danger0)
                    : undefined,
                }}
              >
                {option}
                {isAnswered && selectedAnswer === option && (
                  isCorrect ? <LuCheck style={{ marginLeft: 'auto' }} /> 
                           : <LuX style={{ marginLeft: 'auto' }} />
                )}
              </Button>
            ))}
          </>
        ) : (
          <>
            {question.options?.map((option, idx) => (
              <Button
                key={idx}
                onClick={() => handleAnswer(option)}
                disabled={isAnswered}
                css={{
                  justifyContent: 'flex-start',
                  padding: '1rem',
                  backgroundColor: isAnswered && selectedAnswer === option
                    ? (isCorrect ? COLORS.happy0 : COLORS.danger0)
                    : undefined,
                }}
              >
                {option}
                {isAnswered && selectedAnswer === option && (
                  isCorrect ? <LuCheck style={{ marginLeft: 'auto' }} /> 
                           : <LuX style={{ marginLeft: 'auto' }} />
                )}
              </Button>
            ))}
          </>
        )}
      </div>
      
      {/* Explanation */}
      {showExplanation && question.explanation && (
        <div css={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: COLORS.neutral05,
          borderRadius: 4,
        }}>
          <strong>{t('video.ai-quiz.explanation', 'Explanation:')}</strong>
          <p css={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {question.explanation}
          </p>
        </div>
      )}
      
      {/* Navigation */}
      <div css={{
        display: 'flex',
        gap: '0.75rem',
        marginTop: '1.5rem',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}>
        <div css={{ display: 'flex', gap: '0.75rem' }}>
          <Button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            {t('video.ai-quiz.previous', 'Previous')}
          </Button>
          <Button
            onClick={handleNext}
            disabled={currentQuestion === data.questions.length - 1}
          >
            {t('video.ai-quiz.next', 'Next')}
          </Button>
        </div>
        
        {question.videoContext.timestamp != null && (
          <Button onClick={handleVideoNavigation}>
            {question.videoContext.eventId === currentEventId ? (
              <>{t('video.ai-quiz.jump-to-topic', 'Jump to topic in video')}</>
            ) : (
              <>
                <LuExternalLink size={14} style={{ marginRight: '0.5rem' }} />
                {t('video.ai-quiz.open-video', 'Open {{title}}', {
                  title: question.videoContext.videoTitle
                })}
              </>
            )}
          </Button>
        )}
      </div>
      
      {/* Disclaimer */}
      <div css={{
        marginTop: '1rem',
        fontSize: '0.8rem',
        color: COLORS.neutral50,
      }}>
        ⚠️ {t(
          'video.ai-content.disclaimer',
          'AI-generated content may contain errors or inaccuracies. Always verify information from reliable sources.'
        )}
      </div>
    </div>
  );
};
```

---

## 7. Implementation Roadmap

### Phase 1: Database & Backend (Week 1-2)
- [ ] Create migration file `49-cumulative-quizzes.sql`
- [ ] Test migration on development database
- [ ] Implement `AiCumulativeQuiz` Rust model
- [ ] Add GraphQL schema extensions
- [ ] Implement resolvers (position, count, etc.)
- [ ] Write unit tests

### Phase 2: AI Service (Week 2-3)
- [ ] Add `getSeriesEventsUpTo()` database method
- [ ] Create `CumulativeQuizService` class
- [ ] Implement quiz combination logic
- [ ] Add caching with validation
- [ ] Create REST API endpoints
- [ ] Update admin dashboard
- [ ] Test with real series data

### Phase 3: Frontend (Week 3-4)
- [ ] Create `AiQuizModeSelector` component
- [ ] Create `AiCumulativeQuiz` component
- [ ] Add GraphQL fragments
- [ ] Implement video navigation logic
- [ ] Add translations (EN, DE)
- [ ] Test responsive design
- [ ] End-to-end testing

### Phase 4: Polish & Deploy (Week 4)
- [ ] Performance testing with large series (100+ videos)
- [ ] Cache optimization
- [ ] UI/UX refinements
- [ ] Documentation
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production

---

## 8. Success Metrics

### Technical
- Cache hit rate > 95%
- Generation time < 30s for 10-video series
- Generation time < 2min for 50-video series
- No performance degradation on main site

### User Engagement
- % of users using cumulative vs single quizzes
- Completion rate for cumulative quizzes
- User feedback scores

### Cost
- Cost per cumulative quiz < $0.01 (with caching)
- Total monthly cost increase < $10

---

## 9. Risks & Mitigation

### Risk 1: Large Series Performance
**Issue:** Series with 100+ videos = 800+ questions

**Mitigation:**
- Implement question sampling (max 100 questions)
- Add pagination in UI
- Use queue system for async generation

### Risk 2: Cache Invalidation Complexity
**Issue:** When to invalidate cumulative quizzes?

**Mitigation:**
- Store `included_event_ids` for validation
- Check on every load
- Clear cache on series structure changes

### Risk 3: Cost for Large Series
**Issue:** Generating quizzes for 100 videos could be expensive

**Mitigation:**
- Reuse existing individual quizzes (just combine)
- Cache aggressively
- Admin pre-generation option

---

## Conclusion

This feature builds on the proven AI quiz infrastructure to provide cumulative learning assessment for series-based content. The implementation leverages:

1. **Real database structure** - Uses actual Tobira ordering logic
2. **Existing infrastructure** - Reuses individual quizzes, caching, queue system
3. **Progressive enhancement** - Works alongside single-video quizzes
4. **Smart caching** - Minimizes cost and generation time

**Estimated Effort:** 4 weeks (1 developer)  
**Risk Level:** Low-Medium  
**Cost Impact:** < $0.01 per cumulative quiz

Ready for implementation! 🚀