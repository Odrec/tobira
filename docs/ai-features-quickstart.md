# AI Features Quick Start Guide

This guide will help you get started with implementing AI features in Tobira.

## Prerequisites

- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- Node.js 18+ installed
- Docker and Docker Compose (optional, for Redis)
- Access to Tobira development environment

## Step 1: Fork and Setup

### 1.1 Fork the Repository

```bash
# You're currently working on a direct clone. Let's check:
cd /home/odrec/Projects/tobira
git remote -v

# Create a fork on GitHub:
# 1. Go to https://github.com/elan-ev/tobira
# 2. Click "Fork" button
# 3. Create fork under your account

# Add your fork as a remote
git remote add fork https://github.com/YOUR_USERNAME/tobira.git

# Create feature branch
git checkout -b feature/ai-integration
```

### 1.2 Create AI Service Directory

```bash
# In the project root
mkdir -p ai-service/{src/{api,processors,services,queue,utils,config},tests}
cd ai-service
```

## Step 2: Initialize AI Service

### 2.1 Create package.json

```bash
npm init -y
```

Edit `ai-service/package.json`:

```json
{
  "name": "tobira-ai-service",
  "version": "1.0.0",
  "description": "AI microservice for Tobira video portal",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "openai": "^4.20.1",
    "bullmq": "^4.14.0",
    "redis": "^4.6.10",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "joi": "^17.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.2",
    "ts-node-dev": "^2.0.0",
    "@types/pg": "^8.10.9"
  }
}
```

### 2.2 Install Dependencies

```bash
npm install
```

### 2.3 Create TypeScript Config

Create `ai-service/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.4 Create Environment File

Create `ai-service/.env`:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Database Configuration
DATABASE_URL=postgresql://tobira:tobira@localhost:5432/tobira

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=3001
NODE_ENV=development

# Processing Configuration
MAX_TRANSCRIPT_LENGTH=50000
CHUNK_SIZE=10000
MAX_CONCURRENT_JOBS=3
```

**IMPORTANT:** Add `.env` to `.gitignore`!

## Step 3: Database Migrations

### 3.1 Create Migration File

```bash
# In backend/src/db/migrations/
# Create a new file with the next number, e.g., 99-ai-features.sql
```

Create `backend/src/db/migrations/99-ai-features.sql`:

```sql
-- AI Features Tables

-- Video transcripts storage
CREATE TABLE video_transcripts (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, language)
);

CREATE INDEX idx_video_transcripts_event_id ON video_transcripts(event_id);

-- AI-generated summaries
CREATE TABLE ai_summaries (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    summary TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, language)
);

CREATE INDEX idx_ai_summaries_event_id ON ai_summaries(event_id);
CREATE INDEX idx_ai_summaries_status ON ai_summaries(processing_status);

-- AI-generated quizzes
CREATE TABLE ai_quizzes (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    quiz_data JSONB NOT NULL,
    model VARCHAR(50) NOT NULL,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, language)
);

CREATE INDEX idx_ai_quizzes_event_id ON ai_quizzes(event_id);
CREATE INDEX idx_ai_quizzes_status ON ai_quizzes(processing_status);

-- AI processing queue
CREATE TABLE ai_processing_queue (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
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

-- AI configuration
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

### 3.2 Apply Migration

```bash
# Stop Tobira if running
# In backend directory
cargo run -- db reset  # For development, this resets the DB
# OR
cargo run -- db migrate  # For production, this applies migrations
```

## Step 4: Create Basic AI Service

### 4.1 Configuration

Create `ai-service/src/config/index.ts`:

```typescript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL!,
  },
  server: {
    port: parseInt(process.env.PORT || '3001'),
    env: process.env.NODE_ENV || 'development',
  },
  processing: {
    maxTranscriptLength: parseInt(process.env.MAX_TRANSCRIPT_LENGTH || '50000'),
    chunkSize: parseInt(process.env.CHUNK_SIZE || '10000'),
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '3'),
  },
};
```

### 4.2 Database Service

Create `ai-service/src/services/database.service.ts`:

```typescript
import { Pool } from 'pg';
import { config } from '../config';

class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
    });
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    const res = await this.pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  }

  async getTranscript(eventId: number, language: string = 'en') {
    const result = await this.query(
      'SELECT content FROM video_transcripts WHERE event_id = $1 AND language = $2',
      [eventId, language]
    );
    return result.rows[0]?.content || null;
  }

  async saveTranscript(eventId: number, language: string, content: string, source: string) {
    await this.query(
      `INSERT INTO video_transcripts (event_id, language, content, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, language)
       DO UPDATE SET content = $3, updated_at = NOW()`,
      [eventId, language, content, source]
    );
  }

  async saveSummary(eventId: number, language: string, summary: string, model: string) {
    await this.query(
      `INSERT INTO ai_summaries (event_id, language, summary, model, processing_status)
       VALUES ($1, $2, $3, $4, 'completed')
       ON CONFLICT (event_id, language)
       DO UPDATE SET summary = $3, model = $4, updated_at = NOW()`,
      [eventId, language, summary, model]
    );
  }

  async saveQuiz(eventId: number, language: string, quizData: any, model: string) {
    await this.query(
      `INSERT INTO ai_quizzes (event_id, language, quiz_data, model, processing_status)
       VALUES ($1, $2, $3, $4, 'completed')
       ON CONFLICT (event_id, language)
       DO UPDATE SET quiz_data = $3, model = $4, updated_at = NOW()`,
      [eventId, language, JSON.stringify(quizData), model]
    );
  }
}

export const db = new DatabaseService();
```

### 4.3 OpenAI Service

Create `ai-service/src/services/openai.service.ts`:

```typescript
import OpenAI from 'openai';
import { config } from '../config';

const SUMMARY_PROMPT = `You are an educational content summarizer. Create a concise, informative summary of this video transcript.

Requirements:
- Length: 200-400 words
- Structure: Overview, 3-5 key points, conclusion
- Tone: Educational and engaging
- Focus: Main topics and actionable insights

Transcript:
{transcript}

Summary:`;

const QUIZ_PROMPT = `Create an educational quiz from this transcript. Return ONLY valid JSON, no markdown.

Generate 8-10 questions with:
- Mix of multiple choice and true/false
- Difficulty levels (30% easy, 50% medium, 20% hard)
- Timestamp references (in seconds)
- Explanations for answers

Format:
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "question": "Question text?",
      "options": ["A", "B", "C", "D"],
      "correct_answer": 0,
      "explanation": "Why this is correct",
      "timestamp": 120,
      "difficulty": "easy"
    }
  ]
}

Transcript:
{transcript}`;

class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateSummary(transcript: string): Promise<string> {
    const prompt = SUMMARY_PROMPT.replace('{transcript}', transcript);
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an educational content summarizer.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || '';
  }

  async generateQuiz(transcript: string): Promise<any> {
    const prompt = QUIZ_PROMPT.replace('{transcript}', transcript);
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an educational quiz generator. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content || '{}';
    // Remove markdown code blocks if present
    const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(jsonContent);
  }
}

export const openai = new OpenAIService();
```

### 4.4 Express Server

Create `ai-service/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { db } from './services/database.service';
import { openai } from './services/openai.service';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload transcript
app.post('/api/transcripts/upload', async (req, res) => {
  try {
    const { eventId, language, content, source } = req.body;
    
    if (!eventId || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await db.saveTranscript(
      eventId,
      language || 'en',
      content,
      source || 'manual_upload'
    );

    res.json({ success: true, message: 'Transcript uploaded successfully' });
  } catch (error) {
    console.error('Error uploading transcript:', error);
    res.status(500).json({ error: 'Failed to upload transcript' });
  }
});

// Generate summary
app.post('/api/summaries/generate/:eventId', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const language = req.body.language || 'en';

    // Get transcript
    const transcript = await db.getTranscript(eventId, language);
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    // Generate summary
    const summary = await openai.generateSummary(transcript);

    // Save summary
    await db.saveSummary(eventId, language, summary, 'gpt-3.5-turbo');

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Generate quiz
app.post('/api/quizzes/generate/:eventId', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const language = req.body.language || 'en';

    // Get transcript
    const transcript = await db.getTranscript(eventId, language);
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    // Generate quiz
    const quizData = await openai.generateQuiz(transcript);

    // Save quiz
    await db.saveQuiz(eventId, language, quizData, 'gpt-3.5-turbo');

    res.json({ success: true, quiz: quizData });
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// Get summary
app.get('/api/summaries/:eventId', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const language = req.query.language as string || 'en';

    const result = await db.query(
      'SELECT summary, model, created_at FROM ai_summaries WHERE event_id = $1 AND language = $2',
      [eventId, language]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get quiz
app.get('/api/quizzes/:eventId', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const language = req.query.language as string || 'en';

    const result = await db.query(
      'SELECT quiz_data, model, created_at FROM ai_quizzes WHERE event_id = $1 AND language = $2',
      [eventId, language]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`AI Service running on port ${PORT}`);
  console.log(`Environment: ${config.server.env}`);
});
```

## Step 5: Test the AI Service

### 5.1 Start the Service

```bash
cd ai-service
npm run dev
```

### 5.2 Test with curl

```bash
# Upload a test transcript
curl -X POST http://localhost:3001/api/transcripts/upload \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": 1,
    "language": "en",
    "content": "This is a sample video about machine learning. We will discuss neural networks, deep learning, and practical applications. First, let us understand what neural networks are...",
    "source": "manual_upload"
  }'

# Generate summary
curl -X POST http://localhost:3001/api/summaries/generate/1 \
  -H "Content-Type: application/json" \
  -d '{"language": "en"}'

# Get summary
curl http://localhost:3001/api/summaries/1?language=en

# Generate quiz
curl -X POST http://localhost:3001/api/quizzes/generate/1 \
  -H "Content-Type: application/json" \
  -d '{"language": "en"}'

# Get quiz
curl http://localhost:3001/api/quizzes/1?language=en
```

## Step 6: Extract Transcripts from Videos

### Option 1: Manual Extraction

If you have VTT/SRT files from Opencast:

```bash
# Upload via curl
curl -X POST http://localhost:3001/api/transcripts/upload \
  -H "Content-Type: application/json" \
  -d @transcript.json
```

Where `transcript.json` contains:
```json
{
  "eventId": 1,
  "language": "en",
  "content": "... paste your transcript here ...",
  "source": "opencast"
}
```

### Option 2: Bulk Import Script

Create `ai-service/scripts/import-transcripts.ts`:

```typescript
import { db } from '../src/services/database.service';
import * as fs from 'fs';
import * as path from 'path';

async function importTranscripts(directory: string) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    if (file.endsWith('.vtt') || file.endsWith('.srt')) {
      const content = fs.readFileSync(path.join(directory, file), 'utf-8');
      const eventId = parseInt(file.split('-')[0]); // Assumes filename like "1-transcript.vtt"
      
      // Parse VTT/SRT to plain text (simplified)
      const plainText = content
        .split('\n')
        .filter(line => !line.includes('-->') && !line.match(/^\d+$/))
        .join(' ')
        .trim();
      
      await db.saveTranscript(eventId, 'en', plainText, 'opencast');
      console.log(`Imported transcript for event ${eventId}`);
    }
  }
}

// Usage: ts-node scripts/import-transcripts.ts /path/to/transcripts
importTranscripts(process.argv[2]);
```

## Next Steps

1. **Test the Setup:**
   - Upload some transcripts
   - Generate summaries and quizzes
   - Verify data in database

2. **Backend Integration:**
   - Add GraphQL types in Rust
   - Create API endpoints to call AI service
   - Add authentication

3. **Frontend Integration:**
   - Create React components
   - Add to Video page
   - Test user interface

4. **Production Ready:**
   - Add proper error handling
   - Implement queue system (BullMQ)
   - Add monitoring and logging
   - Deploy AI service

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
psql -U tobira -d tobira -h localhost

# Verify connection string in .env
DATABASE_URL=postgresql://tobira:tobira@localhost:5432/tobira
```

### OpenAI API Issues
```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Port Already in Use
```bash
# Change PORT in .env to something else, e.g., 3002
```

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Node Driver](https://node-postgres.com/)
- [Tobira Documentation](https://elan-ev.github.io/tobira)