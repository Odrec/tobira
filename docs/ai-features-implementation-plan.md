# Tobira AI Features - Separate Repository Implementation Plan

**Created:** 2025-10-09  
**Approach:** Minimal MVP with Separate Repository  
**Goal:** Prototype AI features without modifying core Tobira

## Executive Summary

This plan implements AI features for Tobira using a **separate microservice repository** that connects to Tobira's existing PostgreSQL database. This approach allows you to:

- ✅ Prototype independently without affecting core Tobira
- ✅ Easy rollback if needed (just stop the service)
- ✅ Simple integration path if main Tobira team wants to adopt it later
- ✅ Keep performance impact minimal with opt-in features
- ✅ Regular commits for easy rollback points

## Architecture: Two-Repository Setup

```
┌─────────────────────────────────────────────────────┐
│ Repository 1: tobira (Your Fork)                     │
│                                                       │
│ ┌─────────────────┐         ┌──────────────────┐   │
│ │ Rust Backend    │────────▶│   PostgreSQL     │   │
│ └─────────────────┘         │   (Shared DB)    │   │
│                              └──────────────────┘   │
│ Changes:                             ▲               │
│ - Add database migration file        │               │
│ - (Optional) GraphQL extensions      │               │
│   for future integration             │               │
└──────────────────────────────────────┼───────────────┘
                                       │
┌──────────────────────────────────────┼───────────────┐
│ Repository 2: tobira-ai-service (New)│               │
│                                      │               │
│ ┌─────────────────┐                 │               │
│ │ Node.js/TS      │─────────────────┘               │
│ │ AI Service      │                                 │
│ │                 │                                 │
│ │ - REST API      │                                 │
│ │ - OpenAI Client │                                 │
│ │ - DB Client     │                                 │
│ │ - Caching       │                                 │
│ │ - Monitoring    │                                 │
│ └─────────────────┘                                 │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Why This Works

1. **Database Connection**: AI service connects to Tobira's PostgreSQL as an external client
2. **No Core Changes**: Tobira runs normally, unaware of AI service
3. **Independent Deployment**: AI service can be stopped/started without affecting Tobira
4. **Easy Integration**: If accepted, code can be moved into main Tobira repo later

## Repository Structure

### Repository 1: tobira (Your Fork)

```
tobira/
├── backend/
│   └── src/
│       └── db/
│           └── db-migrations.sql  ← ADD AI tables here
└── docs/
    ├── ai-features-architecture.md      ✓ Already exists
    ├── ai-features-quickstart.md        ✓ Already exists
    ├── ai-features-summary.md           ✓ Already exists
    └── ai-features-implementation-plan.md  ← This file
```

**Git Strategy:**
```bash
# Create feature branch for database changes
git checkout -b feature/ai-database-schema
# Make commits for database migrations
git commit -m "feat(db): add AI features database tables"
git push origin feature/ai-database-schema
```

### Repository 2: tobira-ai-service (New Separate Repo)

```
tobira-ai-service/
├── src/
│   ├── config/
│   │   └── index.ts              # Configuration management
│   ├── services/
│   │   ├── database.service.ts   # PostgreSQL client
│   │   ├── openai.service.ts     # OpenAI API wrapper
│   │   └── cache.service.ts      # Response caching
│   ├── api/
│   │   ├── server.ts             # Express server
│   │   └── routes/
│   │       ├── health.ts         # Health check endpoint
│   │       ├── transcripts.ts    # Transcript management
│   │       └── summaries.ts      # Summary generation
│   ├── utils/
│   │   ├── prompts.ts            # OpenAI prompts
│   │   ├── validators.ts         # Input validation
│   │   └── monitoring.ts         # Performance tracking
│   └── index.ts                  # Entry point
├── tests/
│   └── integration/
│       └── summary.test.ts       # End-to-end tests
├── .env.example                  # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md                     # Setup instructions
├── INTEGRATION.md                # Guide for merging into Tobira
└── docker-compose.yml            # Optional: For Redis cache
```

**Git Strategy:**
```bash
# Initialize new repo
git init
git add .
git commit -m "chore: initial AI service setup"
# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/tobira-ai-service.git
git push -u origin main
```

## Minimal MVP Scope

### What We're Building (Phase 1)

1. **Database Tables** (in Tobira fork)
   - `video_transcripts` - Store uploaded transcripts
   - `ai_summaries` - Store AI-generated summaries
   - `ai_config` - Feature flags and configuration

2. **AI Service** (separate repo)
   - Health check endpoint
   - Transcript upload API
   - Summary generation API
   - Basic caching
   - Performance monitoring
   - OpenAI integration

3. **Features**
   - Upload transcript for a video (via curl/Postman)
   - Generate AI summary (via curl/Postman)
   - Retrieve summary (via curl/Postman)
   - Feature flags (enable/disable AI features)

### What We're NOT Building (Phase 1)

- ❌ Frontend UI integration
- ❌ Quiz generation
- ❌ Chat features
- ❌ GraphQL API in Tobira
- ❌ Queue system (BullMQ)
- ❌ Automatic processing
- ❌ Admin dashboard

*These can be added in Phase 2 after MVP validation*

## Database Schema (Minimal)

### Tables to Add in Tobira Fork

Add to `backend/src/db/db-migrations.sql`:

```sql
-- ============================================
-- AI Features (Separate Microservice)
-- Added: 2025-10-09
-- ============================================

-- Video transcripts (uploaded externally)
CREATE TABLE IF NOT EXISTS video_transcripts (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    content TEXT NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'manual_upload',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, language)
);

CREATE INDEX IF NOT EXISTS idx_video_transcripts_event_id 
    ON video_transcripts(event_id);

-- AI-generated summaries
CREATE TABLE IF NOT EXISTS ai_summaries (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    summary TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id, language)
);

CREATE INDEX IF NOT EXISTS idx_ai_summaries_event_id 
    ON ai_summaries(event_id);

-- AI configuration (feature flags)
CREATE TABLE IF NOT EXISTS ai_config (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default configuration
INSERT INTO ai_config (key, value, description) VALUES
('features_enabled', 'false', 'Master switch for AI features'),
('default_model', '"gpt-3.5-turbo"', 'Default OpenAI model'),
('cache_ttl_seconds', '3600', 'Cache TTL for AI responses'),
('max_transcript_length', '50000', 'Maximum transcript length')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE video_transcripts IS 
    'Video transcripts managed by AI microservice';
COMMENT ON TABLE ai_summaries IS 
    'AI-generated summaries from separate microservice';
COMMENT ON TABLE ai_config IS 
    'Configuration for AI features (opt-in system)';
```

### Migration Notes

- **Backward Compatible**: These tables don't affect existing Tobira functionality
- **Cascade Delete**: If video deleted in Tobira, AI data is automatically cleaned up
- **Opt-in Design**: `features_enabled` flag allows turning off AI features entirely

## AI Service Implementation

### Core Services

#### 1. Database Service (`services/database.service.ts`)

```typescript
import { Pool } from 'pg';

class DatabaseService {
  private pool: Pool;
  
  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }
  
  // Core operations
  async getTranscript(eventId: number, lang = 'en'): Promise<string | null>
  async saveTranscript(eventId: number, content: string, lang = 'en'): Promise<void>
  async getSummary(eventId: number, lang = 'en'): Promise<Summary | null>
  async saveSummary(eventId: number, summary: string, model: string): Promise<void>
  async getConfig(key: string): Promise<any>
  async isFeatureEnabled(): Promise<boolean>
}
```

**Key Points:**
- Connects to Tobira's PostgreSQL database
- Uses prepared statements (security)
- Handles connection pooling
- Checks feature flags before operations

#### 2. OpenAI Service (`services/openai.service.ts`)

```typescript
import OpenAI from 'openai';

class OpenAIService {
  private client: OpenAI;
  
  async generateSummary(transcript: string): Promise<{
    summary: string;
    model: string;
    processingTime: number;
  }>
  
  // Optimized prompts for video content
  private readonly SUMMARY_PROMPT = `...`;
}
```

**Key Points:**
- Optimized prompts for educational video content
- Error handling for API failures
- Token usage tracking
- Configurable model selection

#### 3. Cache Service (`services/cache.service.ts`)

```typescript
class CacheService {
  private cache: Map<string, { data: any; expires: number }>;
  
  async get(key: string): Promise<any | null>
  async set(key: string, value: any, ttlSeconds: number): Promise<void>
  async invalidate(key: string): Promise<void>
}
```

**Key Points:**
- In-memory cache for MVP (Redis optional later)
- Prevents duplicate OpenAI calls
- Configurable TTL
- Cache invalidation support

### REST API Endpoints

```typescript
// Health & Status
GET  /health                    // Service health check
GET  /status                    // Feature flags, API status

// Transcripts
POST /api/transcripts/upload    // Upload transcript
  Body: { eventId: number, content: string, language?: string }
  
GET  /api/transcripts/:eventId  // Get transcript
  Query: ?language=en

// Summaries  
POST /api/summaries/generate/:eventId  // Generate summary
  Body: { language?: string, forceRegenerate?: boolean }
  
GET  /api/summaries/:eventId    // Get cached summary
  Query: ?language=en

// Configuration (Admin)
GET  /api/config                // Get current config
PUT  /api/config/:key           // Update config value
```

### Performance & Monitoring

#### Built-in Monitoring

```typescript
interface PerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  cached: boolean;
  openaiTokens?: number;
}

// Log every request
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const metrics: PerformanceMetrics = {
      endpoint: req.path,
      method: req.method,
      responseTime: Date.now() - start,
      statusCode: res.statusCode,
      timestamp: new Date(),
      cached: res.get('X-Cache-Hit') === 'true',
    };
    logger.info('Request completed', metrics);
  });
  next();
});
```

#### Performance Safeguards

1. **Caching**: All AI responses cached (default 1 hour)
2. **Rate Limiting**: Max 10 requests/minute per IP (configurable)
3. **Timeout**: 30 second max per OpenAI call
4. **Queue**: Process one summary at a time (no parallel OpenAI calls in MVP)
5. **Feature Flags**: Can disable entire service without code changes

## Configuration Management

### Environment Variables (`.env`)

```bash
# Database (connects to Tobira's PostgreSQL)
DATABASE_URL=postgresql://tobira:tobira@localhost:5432/tobira

# OpenAI
OPENAI_API_KEY=sk-...your-key-here

# Server
PORT=3001
NODE_ENV=development

# Performance
CACHE_TTL_SECONDS=3600
MAX_CONCURRENT_REQUESTS=5
REQUEST_TIMEOUT_MS=30000

# Feature Flags (can override database config)
AI_FEATURES_ENABLED=true
DEFAULT_MODEL=gpt-3.5-turbo
```

### Feature Flag System

```typescript
// Check before any AI operation
async function checkFeatures(): Promise<void> {
  const enabled = await db.getConfig('features_enabled');
  if (!enabled) {
    throw new Error('AI features are disabled');
  }
}

// Allow environment override
const isEnabled = process.env.AI_FEATURES_ENABLED === 'true' 
  || await db.getConfig('features_enabled');
```

## Testing Strategy

### Manual Testing with curl

```bash
# 1. Health check
curl http://localhost:3001/health

# 2. Upload transcript
curl -X POST http://localhost:3001/api/transcripts/upload \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": 1,
    "content": "This is a test video about machine learning...",
    "language": "en"
  }'

# 3. Generate summary
curl -X POST http://localhost:3001/api/summaries/generate/1 \
  -H "Content-Type: application/json"

# 4. Get summary (should be cached)
curl http://localhost:3001/api/summaries/1
```

### Integration Test Checklist

- [ ] Service starts successfully
- [ ] Database connection works
- [ ] OpenAI API key is valid
- [ ] Transcript upload succeeds
- [ ] Summary generation works
- [ ] Summary is saved to database
- [ ] Cached summary returns quickly (<100ms)
- [ ] Feature flags work (disable/enable)
- [ ] Error handling works (invalid eventId, missing transcript)
- [ ] Performance monitoring logs requests

## Git Workflow & Commit Strategy

### Recommended Approach: Feature Branch with Regular Commits

**For Tobira Fork:**
```bash
# Create feature branch
git checkout -b feature/ai-database-schema

# Make small, atomic commits
git add backend/src/db/db-migrations.sql
git commit -m "feat(db): add video_transcripts table for AI features"

git add backend/src/db/db-migrations.sql  
git commit -m "feat(db): add ai_summaries table"

git add backend/src/db/db-migrations.sql
git commit -m "feat(db): add ai_config table with feature flags"

# Test migration
git commit -m "test(db): verify AI tables migration works"

# Push to your fork
git push origin feature/ai-database-schema
```

**For AI Service (New Repo):**
```bash
# Initialize with clear structure
git init
git add .
git commit -m "chore: initialize AI service project structure"

# Commit each major component
git commit -m "feat(db): implement database service layer"
git commit -m "feat(ai): implement OpenAI service with summary generation"
git commit -m "feat(api): create REST API endpoints"
git commit -m "feat(cache): add response caching layer"
git commit -m "feat(monitoring): add performance monitoring"
git commit -m "docs: add README and setup instructions"
git commit -m "test: add integration tests"

# Tag releases
git tag -a v0.1.0 -m "MVP release: basic summary generation"
```

### Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Types:
  feat:     New feature
  fix:      Bug fix
  docs:     Documentation
  test:     Tests
  chore:    Maintenance
  refactor: Code restructuring
  perf:     Performance improvement

Examples:
  feat(api): add summary generation endpoint
  fix(db): handle connection errors gracefully
  docs: update setup instructions with database config
  perf(cache): implement in-memory caching for summaries
```

### When to Commit

**Create a commit after:**
- ✅ Completing a logical unit of work
- ✅ Adding a new file or major component
- ✅ Fixing a bug or issue
- ✅ Before switching tasks
- ✅ After successful testing of a feature

**Good commit frequency for this project:**
- Database migration: 1 commit per table or logical group
- AI service setup: 1 commit per major component (db service, openai service, etc.)
- API endpoints: 1 commit per endpoint or group of related endpoints
- Testing: 1 commit after successful integration test

## Deployment & Running

### Development Setup

```bash
# Terminal 1: Tobira (already running)
cd /home/odrec/Projects/tobira
./x.sh start

# Terminal 2: AI Service
cd /path/to/tobira-ai-service
npm install
cp .env.example .env
# Edit .env with your OpenAI API key
npm run dev
```

### Production Deployment (Future)

Both services can run on the same server:

```bash
# Tobira runs on port 3000 (existing)
# AI service runs on port 3001

# Use nginx reverse proxy to route:
# /api/ai/* → AI service (port 3001)
# /* → Tobira (port 3000)
```

## Integration Path for Main Tobira

If the Tobira maintainers want to adopt your AI features:

### Option 1: Merge as Microservice (Recommended)

1. Move `tobira-ai-service/` into Tobira repo as subdirectory
2. Update documentation
3. Add to deployment process
4. Keep as separate service (same architecture)

### Option 2: Full Integration

1. Port Node.js code to Rust
2. Add GraphQL schema extensions
3. Integrate into main backend
4. Move API endpoints to main server

### Migration Documentation

Create `INTEGRATION.md` in AI service repo:

```markdown
# Integration Guide for Tobira Maintainers

## Current Architecture
- Separate Node.js service
- Connects to Tobira's PostgreSQL
- REST API on port 3001
- No changes to core Tobira code

## Benefits of Current Approach
- Independent deployment
- Easy to disable/remove
- No risk to core functionality
- Fast iteration and updates

## Integration Options
[Document both options with pros/cons]

## Migration Steps
[Detailed steps for either option]

## Database Schema
[Already in Tobira - no migration needed]
```

## Performance Considerations

### How We Ensure Tobira Stays Fast

1. **Separate Service**: AI processing doesn't affect Tobira's response times
2. **Opt-in Design**: Features disabled by default, no performance impact
3. **Caching**: AI responses cached, 99% of requests served from cache
4. **No Blocking**: AI service doesn't block Tobira's main request/response cycle
5. **Resource Limits**: AI service has memory/CPU limits to prevent resource contention

### Performance Monitoring

```typescript
// Track and alert on performance issues
const metrics = {
  avgResponseTime: calculateAverage(),
  cacheHitRate: cacheHits / totalRequests,
  openaiUsage: totalTokens,
  errorRate: errors / totalRequests,
};

// Alert if performance degrades
if (metrics.avgResponseTime > 1000) {
  logger.warn('Slow response times detected', metrics);
}
```

### Database Performance

- **Minimal Impact**: Only 3 new tables, all indexed
- **No Joins**: AI tables don't join with core Tobira tables (only FK references)
- **Separate Queries**: AI service makes separate queries, doesn't slow down Tobira
- **Connection Pooling**: Reuses connections efficiently

## Cost Estimation

### OpenAI API Costs (GPT-3.5-Turbo)

**Per Video:**
- Summary generation: ~500 tokens → $0.001
- Cached forever, only pay once

**For 100 Videos:**
- Initial processing: ~$0.10
- Subsequent requests: $0 (cached)

**Monthly Ongoing:**
- Assuming 10 new videos/month: ~$0.01/month

**Very affordable for prototype!**

## Success Criteria

### MVP is successful when:

- [x] AI service starts and connects to Tobira database
- [x] Can upload transcript via API
- [x] Can generate summary via API
- [x] Summary is cached (second request is fast)
- [x] Feature can be disabled via config
- [x] No impact on Tobira performance
- [x] Clear documentation for setup
- [x] Easy rollback (just stop the service)

## Next Steps

### Immediate Actions (This Week)

1. **Set up Git branches**
   - Tobira fork: `feature/ai-database-schema`
   - Create new repo: `tobira-ai-service`

2. **Add database migrations**
   - Edit `backend/src/db/db-migrations.sql`
   - Test migration locally
   - Commit changes

3. **Initialize AI service**
   - Create new repository
   - Set up Node.js/TypeScript
   - Install dependencies
   - Create basic structure

4. **Implement core services**
   - Database service (PostgreSQL client)
   - OpenAI service (summary generation)
   - Cache service (in-memory)

5. **Create REST API**
   - Health check endpoint
   - Transcript upload
   - Summary generation
   - Summary retrieval

6. **Test end-to-end**
   - Upload test transcript
   - Generate summary
   - Verify in database
   - Check caching works

### After MVP (Phase 2)

- Add quiz generation
- Implement queue system (BullMQ)
- Add GraphQL endpoints in Tobira
- Create frontend UI components
- Add admin dashboard
- Implement automatic processing

## Questions & Decisions

### Resolved ✓
- ✓ Use separate repository
- ✓ Start with minimal MVP
- ✓ Database migrations in Tobira fork
- ✓ Feature flags for opt-in
- ✓ Use feature branch for git

### Open Questions
- Which OpenAI model? (Recommend: GPT-3.5-Turbo for cost)
- Cache duration? (Recommend: 1 hour)
- Rate limiting? (Recommend: 10 req/min for MVP)
- Language support? (Recommend: English only for MVP)

## Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Node.js PostgreSQL Client](https://node-postgres.com/)
- [Express.js Documentation](https://expressjs.com/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Summary

This plan gives you:

✅ **Prototype safely** - No risk to core Tobira  
✅ **Move fast** - Simple architecture, easy to iterate  
✅ **Easy rollback** - Regular commits, separate service  
✅ **Performance protected** - Opt-in, cached, monitored  
✅ **Integration ready** - Clear path to merge if accepted  

You're ready to start implementing! 🚀