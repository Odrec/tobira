# AI Features Architecture Plan for Tobira

**Created:** 2025-10-09  
**Status:** Planning Phase  
**Features:** Video Summarization, Automatic Quizzes, (Future: Chat with Video)

## Executive Summary

This document outlines the architecture for adding AI-powered features to Tobira, focusing on automatic video summarization and quiz generation using OpenAI's APIs. The design uses a microservice architecture to keep the AI processing separate from the core Tobira application.

## Current State Analysis

### Existing Infrastructure
- **Backend:** Rust with GraphQL API (Juniper framework)
- **Frontend:** React/TypeScript with Relay for GraphQL queries
- **Database:** PostgreSQL with custom migration system
- **Video Source:** Opencast integration
- **Caption Storage:** EventCaption type exists (`uri`, `lang`)

### Current Limitations
- Only 1 video has transcripts in dummy data
- No mechanism to upload/manage transcripts
- No AI processing infrastructure
- No UI for AI-generated content

## Architecture Overview

```mermaid
graph TB
    subgraph "Frontend React/TS"
        UI[Video Page UI]
        SummaryUI[Summary Component]
        QuizUI[Quiz Component]
    end
    
    subgraph "Tobira Backend Rust"
        GQL[GraphQL API]
        DB[(PostgreSQL)]
        TranscriptMgmt[Transcript Management]
    end
    
    subgraph "AI Microservice Node.js/Python"
        API[REST API]
        OpenAI[OpenAI Client]
        TranscriptProc[Transcript Processor]
        SummaryGen[Summary Generator]
        QuizGen[Quiz Generator]
        Queue[Job Queue]
    end
    
    UI --> GQL
    SummaryUI --> GQL
    QuizUI --> GQL
    GQL --> DB
    GQL --> API
    TranscriptMgmt --> DB
    API --> Queue
    Queue --> TranscriptProc
    Queue --> SummaryGen
    Queue --> QuizGen
    SummaryGen --> OpenAI
    QuizGen --> OpenAI
    TranscriptProc --> DB
    API --> DB
```

## Component Design

### 1. Database Schema Extensions

#### New Tables

**`video_transcripts`**
```sql
CREATE TABLE video_transcripts (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(50) NOT NULL, -- 'opencast', 'manual_upload', 'auto_generated'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, language)
);

CREATE INDEX idx_video_transcripts_event_id ON video_transcripts(event_id);
```

**`ai_summaries`**
```sql
CREATE TABLE ai_summaries (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    summary TEXT NOT NULL,
    model VARCHAR(50) NOT NULL, -- e.g., 'gpt-4', 'gpt-3.5-turbo'
    processing_status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, language)
);

CREATE INDEX idx_ai_summaries_event_id ON ai_summaries(event_id);
CREATE INDEX idx_ai_summaries_status ON ai_summaries(processing_status);
```

**`ai_quizzes`**
```sql
CREATE TABLE ai_quizzes (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    quiz_data JSONB NOT NULL, -- Store questions, answers, and metadata
    model VARCHAR(50) NOT NULL,
    processing_status VARCHAR(20) NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, language)
);

CREATE INDEX idx_ai_quizzes_event_id ON ai_quizzes(event_id);
CREATE INDEX idx_ai_quizzes_status ON ai_quizzes(processing_status);
```

**`ai_processing_queue`**
```sql
CREATE TABLE ai_processing_queue (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL, -- 'summary', 'quiz', 'chat_index'
    language VARCHAR(10) NOT NULL,
    priority INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, task_type, language)
);

CREATE INDEX idx_ai_queue_status ON ai_processing_queue(status, scheduled_at);
```

**`ai_config`**
```sql
CREATE TABLE ai_config (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default configurations
INSERT INTO ai_config (key, value, description) VALUES
('auto_process_on_upload', 'false', 'Automatically process videos when uploaded'),
('enabled_features', '["summary", "quiz"]', 'List of enabled AI features'),
('default_model', '"gpt-3.5-turbo"', 'Default OpenAI model to use'),
('max_transcript_length', '50000', 'Maximum transcript length for processing');
```

#### Quiz Data Schema (JSONB)

```json
{
  "version": "1.0",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "What is the main topic of this video?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "The video discusses...",
      "timestamp": 120,
      "difficulty": "easy"
    },
    {
      "id": "q2",
      "type": "true_false",
      "question": "Statement to verify",
      "correct_answer": true,
      "explanation": "This is correct because...",
      "timestamp": 350,
      "difficulty": "medium"
    }
  ],
  "metadata": {
    "total_questions": 10,
    "difficulty_distribution": {"easy": 4, "medium": 4, "hard": 2},
    "topics": ["topic1", "topic2"]
  }
}
```

### 2. AI Microservice Architecture

**Technology Stack:**
- **Runtime:** Node.js (TypeScript) or Python (FastAPI)
- **Recommendation:** Node.js for easier integration and team familiarity
- **Queue:** BullMQ (Redis-based) for job processing
- **Database Client:** node-postgres for PostgreSQL
- **OpenAI SDK:** Official OpenAI Node.js library

**Service Structure:**
```
ai-service/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── transcripts.ts
│   │   │   ├── summaries.ts
│   │   │   ├── quizzes.ts
│   │   │   └── admin.ts
│   │   └── server.ts
│   ├── processors/
│   │   ├── summary.processor.ts
│   │   ├── quiz.processor.ts
│   │   └── base.processor.ts
│   ├── services/
│   │   ├── openai.service.ts
│   │   ├── transcript.service.ts
│   │   └── database.service.ts
│   ├── queue/
│   │   ├── queue.manager.ts
│   │   └── workers.ts
│   ├── utils/
│   │   ├── prompts.ts
│   │   └── validators.ts
│   └── config/
│       └── index.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

**API Endpoints:**

```typescript
// Transcript Management
POST   /api/transcripts/upload         // Upload transcript for video
GET    /api/transcripts/:eventId       // Get transcript
DELETE /api/transcripts/:eventId       // Delete transcript

// Summary Management  
POST   /api/summaries/generate/:eventId  // Trigger summary generation
GET    /api/summaries/:eventId           // Get summary
GET    /api/summaries/:eventId/status    // Check processing status

// Quiz Management
POST   /api/quizzes/generate/:eventId    // Trigger quiz generation
GET    /api/quizzes/:eventId              // Get quiz
POST   /api/quizzes/:eventId/submit      // Submit quiz answers (future)

// Admin
GET    /api/admin/queue/status            // Queue status
POST   /api/admin/queue/process/:eventId  // Manually trigger processing
GET    /api/admin/config                  // Get AI configuration
PUT    /api/admin/config                  // Update AI configuration
```

**Processing Flow:**

1. **Transcript Upload/Sync:**
   ```
   User uploads transcript → Store in video_transcripts table
   → If auto-process enabled → Add to ai_processing_queue
   → Worker picks up job → Process with OpenAI
   ```

2. **Summary Generation:**
   ```
   Queue job → Fetch transcript → Chunk if needed
   → Send to OpenAI with summary prompt
   → Store result in ai_summaries table
   → Update status to 'completed'
   ```

3. **Quiz Generation:**
   ```
   Queue job → Fetch transcript → Analyze content
   → Send to OpenAI with quiz prompt
   → Validate quiz format → Store in ai_quizzes table
   → Update status to 'completed'
   ```

### 3. Backend API Extensions (Rust/GraphQL)

**New GraphQL Types:**

```rust
// In backend/src/api/model/ai_features.rs

pub struct Transcript {
    id: Key,
    event_id: Key,
    language: String,
    content: String,
    source: TranscriptSource,
    created_at: DateTime<Utc>,
}

pub enum TranscriptSource {
    Opencast,
    ManualUpload,
    AutoGenerated,
}

pub struct AiSummary {
    id: Key,
    event_id: Key,
    language: String,
    summary: String,
    model: String,
    status: ProcessingStatus,
    created_at: DateTime<Utc>,
}

pub struct AiQuiz {
    id: Key,
    event_id: Key,
    language: String,
    questions: Vec<QuizQuestion>,
    metadata: QuizMetadata,
    status: ProcessingStatus,
    created_at: DateTime<Utc>,
}

pub struct QuizQuestion {
    id: String,
    question_type: QuestionType,
    question: String,
    options: Option<Vec<String>>,
    correct_answer: serde_json::Value,
    explanation: Option<String>,
    timestamp: Option<i32>,
    difficulty: Difficulty,
}

pub enum ProcessingStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}
```

**GraphQL Schema Extensions:**

```graphql
extend type Event {
    # Transcript information
    transcript(language: String): Transcript
    availableTranscriptLanguages: [String!]!
    
    # AI Features
    aiSummary(language: String): AiSummary
    aiQuiz(language: String): AiQuiz
    
    # Processing status
    aiProcessingStatus: AiProcessingInfo
}

type Transcript {
    id: ID!
    language: String!
    content: String!
    source: TranscriptSource!
    createdAt: DateTimeUtc!
}

enum TranscriptSource {
    OPENCAST
    MANUAL_UPLOAD
    AUTO_GENERATED
}

type AiSummary {
    id: ID!
    summary: String!
    model: String!
    status: ProcessingStatus!
    createdAt: DateTimeUtc!
}

type AiQuiz {
    id: ID!
    questions: [QuizQuestion!]!
    metadata: QuizMetadata!
    status: ProcessingStatus!
    createdAt: DateTimeUtc!
}

type QuizQuestion {
    id: ID!
    questionType: QuestionType!
    question: String!
    options: [String!]
    correctAnswer: String!
    explanation: String
    timestamp: Int
    difficulty: Difficulty!
}

enum QuestionType {
    MULTIPLE_CHOICE
    TRUE_FALSE
    SHORT_ANSWER
}

enum Difficulty {
    EASY
    MEDIUM
    HARD
}

type QuizMetadata {
    totalQuestions: Int!
    difficultyDistribution: DifficultyDistribution!
    topics: [String!]!
}

type DifficultyDistribution {
    easy: Int!
    medium: Int!
    hard: Int!
}

enum ProcessingStatus {
    PENDING
    PROCESSING
    COMPLETED
    FAILED
}

type AiProcessingInfo {
    hasPendingJobs: Boolean!
    summaryStatus: ProcessingStatus
    quizStatus: ProcessingStatus
}

# Mutations
extend type Mutation {
    # Transcript management
    uploadTranscript(input: UploadTranscriptInput!): UploadTranscriptResult!
    deleteTranscript(eventId: ID!, language: String!): DeleteResult!
    
    # AI processing triggers
    generateAiSummary(eventId: ID!, language: String): TriggerProcessingResult!
    generateAiQuiz(eventId: ID!, language: String): TriggerProcessingResult!
    
    # Admin
    updateAiConfig(key: String!, value: String!): UpdateConfigResult!
}

input UploadTranscriptInput {
    eventId: ID!
    language: String!
    content: String!
    source: TranscriptSource
}

type UploadTranscriptResult {
    transcript: Transcript
    autoProcessingTriggered: Boolean!
}

type TriggerProcessingResult {
    success: Boolean!
    jobId: ID
    message: String
}
```

### 4. Frontend Components

**Component Structure:**

```
frontend/src/
├── routes/
│   └── Video.tsx (modify existing)
├── ui/
│   ├── ai/
│   │   ├── AiFeatures.tsx         # Main container
│   │   ├── Summary.tsx             # Summary display
│   │   ├── Quiz.tsx                # Quiz interface
│   │   ├── TranscriptUpload.tsx    # Upload UI
│   │   └── ProcessingStatus.tsx    # Status indicator
│   └── Video.tsx (existing)
```

**Key Components:**

1. **AiFeatures.tsx** - Main container for AI features
```typescript
interface AiFeaturesProps {
    eventId: string;
    eventData: VideoPageEventData$key;
}

export const AiFeatures: React.FC<AiFeaturesProps> = ({eventId, eventData}) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'quiz'>('summary');
    
    return (
        <Card>
            <TabBar>
                <Tab onClick={() => setActiveTab('summary')}>Summary</Tab>
                <Tab onClick={() => setActiveTab('quiz')}>Quiz</Tab>
            </TabBar>
            
            {activeTab === 'summary' && <SummaryView eventId={eventId} />}
            {activeTab === 'quiz' && <QuizView eventId={eventId} />}
        </Card>
    );
};
```

2. **Summary.tsx** - Display AI-generated summary
```typescript
export const SummaryView: React.FC<{eventId: string}> = ({eventId}) => {
    const data = useFragment(SUMMARY_FRAGMENT, eventData);
    
    if (data.aiSummary?.status === 'PROCESSING') {
        return <LoadingIndicator text="Generating summary..." />;
    }
    
    if (!data.aiSummary || data.aiSummary.status === 'FAILED') {
        return <GenerateSummaryButton eventId={eventId} />;
    }
    
    return (
        <div>
            <SummaryText>{data.aiSummary.summary}</SummaryText>
            <Metadata>
                Generated by {data.aiSummary.model}
            </Metadata>
        </div>
    );
};
```

3. **Quiz.tsx** - Interactive quiz interface
```typescript
export const QuizView: React.FC<{eventId: string}> = ({eventId}) => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Map<string, any>>(new Map());
    
    // Quiz logic with time-stamped questions linked to video
    // Click on question → seek video to that timestamp
    
    return (
        <QuizContainer>
            <QuestionCard 
                question={quiz.questions[currentQuestion]}
                onAnswer={(answer) => handleAnswer(answer)}
                onSeekToTimestamp={(time) => seekVideo(time)}
            />
            <QuizNavigation />
        </QuizContainer>
    );
};
```

4. **TranscriptUpload.tsx** - Admin upload interface
```typescript
export const TranscriptUpload: React.FC<{eventId: string}> = ({eventId}) => {
    const [file, setFile] = useState<File | null>(null);
    const [language, setLanguage] = useState('en');
    
    const handleUpload = async () => {
        const content = await file.text();
        await uploadTranscript({
            eventId,
            language,
            content,
            source: 'MANUAL_UPLOAD'
        });
    };
    
    return (
        <UploadForm>
            <FileInput onChange={(e) => setFile(e.target.files[0])} />
            <LanguageSelect value={language} onChange={setLanguage} />
            <Button onClick={handleUpload}>Upload & Process</Button>
        </UploadForm>
    );
};
```

### 5. Transcript Handling

**Transcript Sources:**

1. **From Opencast:** Extract from existing caption files
2. **Manual Upload:** Admin uploads VTT/SRT files
3. **Future:** Auto-transcription service (Whisper API)

**Supported Formats:**
- WebVTT (.vtt)
- SubRip (.srt)
- Plain text (.txt)

**Parser Implementation (AI Service):**

```typescript
// ai-service/src/services/transcript.service.ts

export class TranscriptService {
    async parseVTT(content: string): Promise<string> {
        // Remove VTT timing and formatting
        // Return plain text
    }
    
    async parseSRT(content: string): Promise<string> {
        // Remove SRT timing and formatting
        // Return plain text
    }
    
    async uploadTranscript(
        eventId: string,
        language: string,
        content: string,
        source: string
    ): Promise<void> {
        const plainText = await this.parseFormat(content);
        
        await db.query(`
            INSERT INTO video_transcripts (event_id, language, content, source)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (event_id, language) 
            DO UPDATE SET content = $3, updated_at = NOW()
        `, [eventId, language, plainText, source]);
        
        // Trigger AI processing if enabled
        const autoProcess = await this.getConfig('auto_process_on_upload');
        if (autoProcess) {
            await this.queueAiProcessing(eventId, language);
        }
    }
}
```

### 6. OpenAI Integration

**Prompts:**

```typescript
// ai-service/src/utils/prompts.ts

export const SUMMARY_PROMPT = `
You are an educational content summarizer. Given a video transcript, create a concise, informative summary.

Requirements:
- Length: 200-400 words
- Structure: Overview, key points (3-5), conclusion
- Tone: Educational, clear, engaging
- Focus: Main topics, important concepts, actionable insights

Transcript:
{transcript}

Summary:
`;

export const QUIZ_PROMPT = `
You are an educational quiz generator. Create an interactive quiz from this video transcript.

Requirements:
- Generate 8-10 questions
- Mix of difficulty levels (30% easy, 50% medium, 20% hard)
- Question types: multiple choice, true/false
- Include timestamp references to video segments
- Provide explanations for correct answers

Format your response as JSON:
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct_answer": 0,
      "explanation": "...",
      "timestamp": 120,
      "difficulty": "easy"
    }
  ]
}

Transcript:
{transcript}

Quiz (JSON):
`;
```

**Processing Implementation:**

```typescript
// ai-service/src/processors/summary.processor.ts

export class SummaryProcessor {
    async process(jobData: {eventId: string, language: string}) {
        try {
            // Update status to processing
            await this.updateStatus(jobData.eventId, 'processing');
            
            // Fetch transcript
            const transcript = await this.getTranscript(
                jobData.eventId, 
                jobData.language
            );
            
            // Check length and chunk if needed
            const chunks = this.chunkTranscript(transcript, 10000);
            
            // Generate summary
            const summaries = await Promise.all(
                chunks.map(chunk => this.generateSummary(chunk))
            );
            
            const finalSummary = chunks.length > 1 
                ? await this.combineSummaries(summaries)
                : summaries[0];
            
            // Store result
            await this.storeSummary(
                jobData.eventId,
                jobData.language,
                finalSummary
            );
            
            // Update status to completed
            await this.updateStatus(jobData.eventId, 'completed');
            
        } catch (error) {
            await this.handleError(jobData.eventId, error);
        }
    }
    
    private async generateSummary(text: string): Promise<string> {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are an educational content summarizer.'
                },
                {
                    role: 'user',
                    content: SUMMARY_PROMPT.replace('{transcript}', text)
                }
            ],
            temperature: 0.7,
            max_tokens: 500,
        });
        
        return response.choices[0].message.content;
    }
}
```

### 7. Configuration Management

**Config Options (Tobira backend):**

```toml
# In backend config.toml

[ai]
# Enable AI features
enabled = true

# AI service URL
service_url = "http://localhost:3001"

# API key for AI service (for authentication)
api_key = "secret-key"

# Auto-process videos on transcript upload
auto_process = false

# Enabled features
features = ["summary", "quiz"]

# Default language for AI processing
default_language = "en"
```

**Environment Variables (AI Service):**

```bash
# .env for AI service
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@localhost:5432/tobira
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development

# Processing limits
MAX_TRANSCRIPT_LENGTH=50000
CHUNK_SIZE=10000
MAX_CONCURRENT_JOBS=3
```

## Implementation Phases

### Phase 0: Project Setup (Week 1)
- [ ] Fork repository on GitHub
- [ ] Create feature branch `feature/ai-integration`
- [ ] Set up AI microservice project structure
- [ ] Configure development environment

### Phase 1: Database & Transcript Foundation (Week 1-2)
- [ ] Create database migrations for new tables
- [ ] Implement transcript upload API in AI service
- [ ] Create transcript parser (VTT/SRT)
- [ ] Add GraphQL mutations for transcript upload
- [ ] Build basic transcript upload UI component
- [ ] Test with sample transcripts

### Phase 2: AI Summary Feature (Week 2-3)
- [ ] Implement OpenAI integration for summaries
- [ ] Create summary generation processor
- [ ] Add job queue system with BullMQ
- [ ] Extend GraphQL API for summaries
- [ ] Build summary display component
- [ ] Add admin trigger UI
- [ ] Test summary generation

### Phase 3: AI Quiz Feature (Week 3-4)
- [ ] Implement quiz generation processor
- [ ] Create quiz validation logic
- [ ] Extend GraphQL API for quizzes
- [ ] Build interactive quiz component
- [ ] Add timestamp-to-video seeking
- [ ] Test quiz generation and interaction

### Phase 4: Integration & Polish (Week 4-5)
- [ ] Integrate components into Video page
- [ ] Add configuration management
- [ ] Implement error handling and retries
- [ ] Add loading states and feedback
- [ ] Create admin dashboard for AI features
- [ ] Write documentation

### Phase 5: Testing & Deployment (Week 5-6)
- [ ] End-to-end testing
- [ ] Performance testing
- [ ] Security review
- [ ] Docker containerization
- [ ] Deployment documentation
- [ ] User documentation

## Security Considerations

1. **API Key Management:**
   - Store OpenAI keys in environment variables
   - Never commit keys to repository
   - Use secrets management in production

2. **Access Control:**
   - Only admins can upload transcripts
   - Only admins can manually trigger processing
   - Users can only view completed AI content

3. **Rate Limiting:**
   - Limit API calls to OpenAI
   - Queue-based processing to avoid overload
   - Cost monitoring for OpenAI usage

4. **Input Validation:**
   - Validate transcript content length
   - Sanitize user inputs
   - Validate quiz JSON structure

## Cost Estimation

**OpenAI API Costs (GPT-3.5-Turbo):**
- Summary: ~$0.002 per video (500 tokens)
- Quiz: ~$0.004 per video (1000 tokens)
- Total: ~$0.006 per video

**For 1000 videos:**
- Initial processing: ~$6
- Monthly updates: depends on content changes

**Infrastructure:**
- Redis: Free (self-hosted) or ~$5/month (managed)
- AI Service: Minimal resources, can run on same server

## Future Enhancements (Post-MVP)

1. **Chat with Video Content:**
   - Vector database (Pinecone/Weaviate)
   - Embeddings for semantic search
   - Chat interface with context retrieval

2. **Auto-Transcription:**
   - Whisper API integration
   - Automatic language detection
   - Speaker diarization

3. **Advanced Features:**
   - Key moment detection
   - Topic extraction and tagging
   - Difficulty-adaptive quizzes
   - Learning progress tracking
   - Multi-language support

4. **Analytics:**
   - Track which summaries are viewed
   - Quiz completion rates
   - Popular topics

## Open Questions

1. **Transcript Extraction:** How to bulk extract transcripts from existing Opencast videos?
2. **Language Detection:** Should we auto-detect transcript language?
3. **Quiz Grading:** Should we track quiz scores per user?
4. **Caching:** Should we cache OpenAI responses?

## Next Steps

1. ✅ Review and approve this architecture
2. Set up fork and development branch
3. Begin Phase 0: Project Setup
4. Start with Phase 1: Database & Transcript Foundation