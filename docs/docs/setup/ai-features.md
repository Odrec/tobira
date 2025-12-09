---
sidebar_position: 12
---

# AI Features

Tobira supports optional AI-powered features that enhance the learning experience for video content.
These features generate educational content (summaries and quizzes) from video captions using AI.

## Overview

The AI features include:

- **AI Summaries**: Concise summaries (200-400 words) generated from video transcripts to help students quickly understand key concepts.
- **Interactive Quizzes**: 8-10 quiz questions per video with multiple choice and true/false formats, including instant feedback, explanations, and timestamp links.
- **Cumulative Quizzes**: For video series, quizzes that combine questions from previous videos - ideal for exam preparation.
- **Content Quality Control**: Users can flag problematic AI content for review; admins can approve, edit, or dismiss content.

## Architecture

The AI features are implemented through a separate microservice that works alongside Tobira:

```
┌─────────────────────┐     ┌─────────────────────┐
│   Tobira Frontend   │────▶│   Tobira Backend    │
│   (React + TS)      │     │   (Rust + GraphQL)  │
└─────────────────────┘     └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │  tobira-ai-service  │
                            │  (Node.js + TS)     │
                            └──────────┬──────────┘
                                       │
                            ┌──────────▼──────────┐
                            │     OpenAI API      │
                            └─────────────────────┘
```

The tobira-ai-service is a Node.js microservice that:
- Extracts text from video captions (WebVTT/SRT)
- Generates summaries and quizzes via OpenAI API
- Stores results in Tobira's PostgreSQL database

## Requirements

To use AI features, you need:

| Component | Purpose | Required |
|-----------|---------|----------|
| tobira-ai-service | Process videos and generate AI content | Yes |
| OpenAI API key | AI processing | Yes |
| Redis | Background job queue management | Optional |
| Videos with captions | Source content for AI | Yes |

## Setup

### 1. Install the AI Service

Clone and set up the tobira-ai-service:

```bash
git clone https://github.com/Odrec/tobira-ai-service.git
cd tobira-ai-service
npm install
```

### 2. Configure Environment

Create a `.env` file in the tobira-ai-service directory:

```bash
# Required
OPENAI_API_KEY=your-openai-api-key
DATABASE_URL=postgresql://tobira:tobira@localhost:5432/tobira

# Optional
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
DEFAULT_MODEL=gpt-4o-mini
```

### 3. Database Migrations

The AI feature tables are added via Tobira's migration system.
When you update Tobira, the following tables are created automatically:

- `video_transcripts` - Stores extracted caption text
- `ai_summaries` - Generated summaries with approval status
- `ai_quizzes` - Generated quiz questions
- `ai_cumulative_quizzes` - Series-wide quiz combinations
- `ai_content_flags` - User reports for content review
- `ai_config` - Feature configuration

### 4. Start the Service

```bash
npm run dev  # Development
npm start    # Production
```

The service runs on port 3001 by default.

## Usage

### Admin Workflow

AI content generation is **admin-triggered**, not automatic:

1. **Extract Captions**: Admin selects a video and extracts caption text to create a transcript
2. **Generate Summary**: Admin triggers summary generation from the transcript
3. **Generate Quiz**: Admin triggers quiz generation from the transcript
4. **Review Content**: Admin can edit, approve, or dismiss AI-generated content

Access the admin dashboard at: `http://localhost:3001/admin/admin.html`

### Student Experience

Students see AI content directly on video pages:

- Summary section (expandable/collapsible)
- Interactive quiz with instant feedback
- "Jump to video" buttons for quiz questions
- Option to take cumulative quizzes for series videos
- Report button to flag problematic content

## Configuration

AI features can be configured in the database via the `ai_config` table:

```sql
-- Enable/disable all AI features
UPDATE ai_config SET value = 'true' WHERE key = 'features_enabled';

-- Enable/disable specific features
UPDATE ai_config SET value = 'true' WHERE key = 'summary_enabled';
UPDATE ai_config SET value = 'true' WHERE key = 'quiz_enabled';

-- Set default AI model
UPDATE ai_config SET value = '"gpt-4o-mini"' WHERE key = 'default_model';
```

## Troubleshooting

### AI content not appearing
- Verify the video has captions (WebVTT or SRT format)
- Check that captions have been extracted (transcript must exist)
- Confirm summary/quiz was generated (check admin dashboard)
- Verify features are enabled in ai_config

### Service not responding
- Check health endpoint: `http://localhost:3001/health`
- Verify DATABASE_URL environment variable is correct
- Check OpenAI API key is valid

### Quiz generation fails
- Transcript may be too short (< 100 words)
- OpenAI API rate limits may be reached
- Check service logs for detailed error messages

## More Information

For detailed setup instructions and API documentation, see the [tobira-ai-service repository](https://github.com/Odrec/tobira-ai-service).