use chrono::{DateTime, Utc};
use juniper::{graphql_object, GraphQLObject};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::{
    api::{
        err::{ApiResult, invalid_input},
        Context,
        Id,
    },
    auth::AuthState,
    db::util::impl_from_db,
    model::Key,
    prelude::*,
};


// ============================================
// AI Summary
// ============================================

/// Represents an AI-generated summary of video content
#[derive(Debug)]
pub(crate) struct AiSummary {
    pub(crate) id: i64,
    pub(crate) event_id: Key,
    pub(crate) language: String,
    pub(crate) summary: String,
    pub(crate) model: String,
    pub(crate) processing_time_ms: Option<i32>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
    pub(crate) approved: bool,
    pub(crate) approved_at: Option<DateTime<Utc>>,
    pub(crate) approved_by: Option<String>,
    pub(crate) edited_by_human: bool,
    pub(crate) last_edited_by: Option<String>,
    pub(crate) flagged: bool,
    pub(crate) flag_count: i32,
}

impl_from_db!(
    AiSummary,
    select: {
        ai_summaries.{
            id,
            event_id,
            language,
            summary,
            model,
            processing_time_ms,
            created_at,
            updated_at,
            approved,
            approved_at,
            approved_by,
            edited_by_human,
            last_edited_by,
            flagged,
            flag_count,
        },
    },
    |row| {
        Self {
            id: row.id(),
            event_id: row.event_id(),
            language: row.language(),
            summary: row.summary(),
            model: row.model(),
            processing_time_ms: row.processing_time_ms(),
            created_at: row.created_at(),
            updated_at: row.updated_at(),
            approved: row.approved(),
            approved_at: row.approved_at(),
            approved_by: row.approved_by(),
            edited_by_human: row.edited_by_human(),
            last_edited_by: row.last_edited_by(),
            flagged: row.flagged(),
            flag_count: row.flag_count(),
        }
    }
);

#[graphql_object(Context = Context)]
impl AiSummary {
    /// The event this summary belongs to
    fn event_id(&self) -> Id {
        Id::event(self.event_id)
    }

    /// Language code of the summary (e.g., 'en', 'de')
    fn language(&self) -> &str {
        &self.language
    }

    /// The AI-generated summary text
    fn summary(&self) -> &str {
        &self.summary
    }

    /// OpenAI model used to generate this summary
    fn model(&self) -> &str {
        &self.model
    }

    /// Time taken to generate the summary in milliseconds
    fn processing_time_ms(&self) -> Option<i32> {
        self.processing_time_ms
    }

    /// When this summary was created
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// When this summary was last updated
    fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    /// Whether this summary has been approved by an admin
    fn approved(&self) -> bool {
        self.approved
    }

    /// When this summary was approved
    fn approved_at(&self) -> Option<DateTime<Utc>> {
        self.approved_at
    }

    /// Username of the admin who approved this summary
    fn approved_by(&self) -> Option<&str> {
        self.approved_by.as_deref()
    }

    /// Whether this summary has been manually edited by a human
    fn edited_by_human(&self) -> bool {
        self.edited_by_human
    }

    /// Username of the last person who edited this summary
    fn last_edited_by(&self) -> Option<&str> {
        self.last_edited_by.as_deref()
    }

    /// Whether this summary has been flagged for review
    fn flagged(&self) -> bool {
        self.flagged
    }

    /// Number of times this summary has been flagged
    fn flag_count(&self) -> i32 {
        self.flag_count
    }
}

impl AiSummary {
    /// Load AI summary for a specific event
    /// If no language specified, uses the first available language from all AI content
    pub(crate) async fn load_for_event(
        event_id: Key,
        language: Option<String>,
        context: &Context,
    ) -> ApiResult<Option<Self>> {
        let selection = Self::select();
        
        let lang = if let Some(lang) = language {
            lang
        } else {
            // No language specified - get first available language across all AI content
            let lang_query = "
                select language from (
                    select language from ai_summaries where event_id = $1
                    union
                    select language from ai_quizzes where event_id = $1
                ) as langs
                order by language limit 1
            ";
            match context.db.query_opt(lang_query, &[&event_id]).await? {
                Some(row) => row.get::<_, String>(0),
                None => return Ok(None), // No AI content at all
            }
        };
        
        // Try to load summary for the determined language
        let query = format!(
            "select {selection} from ai_summaries \
             where event_id = $1 and language = $2"
        );
        context.db
            .query_opt(&query, &[&event_id, &lang])
            .await?
            .map(|row| Self::from_row_start(&row))
            .pipe(Ok)
    }
}


// ============================================
// AI Quiz
// ============================================

/// Represents an AI-generated quiz for a video
#[derive(Debug)]
pub(crate) struct AiQuiz {
    pub(crate) id: i64,
    pub(crate) event_id: Key,
    pub(crate) language: String,
    pub(crate) quiz_data: JsonValue,
    pub(crate) model: String,
    pub(crate) processing_time_ms: Option<i32>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
    pub(crate) approved: bool,
    pub(crate) approved_at: Option<DateTime<Utc>>,
    pub(crate) approved_by: Option<String>,
    pub(crate) edited_by_human: bool,
    pub(crate) last_edited_by: Option<String>,
    pub(crate) flagged: bool,
    pub(crate) flag_count: i32,
}

impl_from_db!(
    AiQuiz,
    select: {
        ai_quizzes.{
            id,
            event_id,
            language,
            quiz_data,
            model,
            processing_time_ms,
            created_at,
            updated_at,
            approved,
            approved_at,
            approved_by,
            edited_by_human,
            last_edited_by,
            flagged,
            flag_count,
        },
    },
    |row| {
        Self {
            id: row.id(),
            event_id: row.event_id(),
            language: row.language(),
            quiz_data: row.quiz_data(),
            model: row.model(),
            processing_time_ms: row.processing_time_ms(),
            created_at: row.created_at(),
            updated_at: row.updated_at(),
            approved: row.approved(),
            approved_at: row.approved_at(),
            approved_by: row.approved_by(),
            edited_by_human: row.edited_by_human(),
            last_edited_by: row.last_edited_by(),
            flagged: row.flagged(),
            flag_count: row.flag_count(),
        }
    }
);

#[graphql_object(Context = Context)]
impl AiQuiz {
    /// The event this quiz belongs to
    fn event_id(&self) -> Id {
        Id::event(self.event_id)
    }

    /// Language code of the quiz (e.g., 'en', 'de')
    fn language(&self) -> &str {
        &self.language
    }

    /// The quiz questions and metadata as JSON
    fn questions(&self) -> Vec<QuizQuestion> {
        // Parse the quiz_data JSON and extract questions
        self.quiz_data
            .get("questions")
            .and_then(|q| q.as_array())
            .map(|questions| {
                questions
                    .iter()
                    .filter_map(|q| serde_json::from_value(q.clone()).ok())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// OpenAI model used to generate this quiz
    fn model(&self) -> &str {
        &self.model
    }

    /// Time taken to generate the quiz in milliseconds
    fn processing_time_ms(&self) -> Option<i32> {
        self.processing_time_ms
    }

    /// When this quiz was created
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// When this quiz was last updated
    fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    /// Whether this quiz has been approved by an admin
    fn approved(&self) -> bool {
        self.approved
    }

    /// When this quiz was approved
    fn approved_at(&self) -> Option<DateTime<Utc>> {
        self.approved_at
    }

    /// Username of the admin who approved this quiz
    fn approved_by(&self) -> Option<&str> {
        self.approved_by.as_deref()
    }

    /// Whether this quiz has been manually edited by a human
    fn edited_by_human(&self) -> bool {
        self.edited_by_human
    }

    /// Username of the last person who edited this quiz
    fn last_edited_by(&self) -> Option<&str> {
        self.last_edited_by.as_deref()
    }

    /// Whether this quiz has been flagged for review
    fn flagged(&self) -> bool {
        self.flagged
    }

    /// Number of times this quiz has been flagged
    fn flag_count(&self) -> i32 {
        self.flag_count
    }
}

impl AiQuiz {
    /// Load AI quiz for a specific event
    /// If no language specified, uses the first available language from all AI content
    pub(crate) async fn load_for_event(
        event_id: Key,
        language: Option<String>,
        context: &Context,
    ) -> ApiResult<Option<Self>> {
        let selection = Self::select();
        
        let lang = if let Some(lang) = language {
            lang
        } else {
            // No language specified - get first available language across all AI content
            let lang_query = "
                select language from (
                    select language from ai_summaries where event_id = $1
                    union
                    select language from ai_quizzes where event_id = $1
                ) as langs
                order by language limit 1
            ";
            match context.db.query_opt(lang_query, &[&event_id]).await? {
                Some(row) => row.get::<_, String>(0),
                None => return Ok(None), // No AI content at all
            }
        };
        
        // Try to load quiz for the determined language
        let query = format!(
            "select {selection} from ai_quizzes \
             where event_id = $1 and language = $2"
        );
        context.db
            .query_opt(&query, &[&event_id, &lang])
            .await?
            .map(|row| Self::from_row_start(&row))
            .pipe(Ok)
    }
}


// ============================================
// Quiz Question Types
// ============================================

/// A single quiz question
#[derive(Debug, Clone, Serialize, Deserialize, GraphQLObject)]
pub(crate) struct QuizQuestion {
    /// The question text
    pub question: String,
    
    /// Type of question (multiple_choice or true_false)
    #[serde(rename = "type")]
    pub question_type: String,
    
    /// Available answer options (for multiple choice)
    pub options: Option<Vec<String>>,
    
    /// The correct answer (as string representation)
    #[serde(deserialize_with = "deserialize_correct_answer")]
    pub correct_answer: String,
    
    /// Explanation of the answer
    pub explanation: String,
    
    /// Difficulty level (easy, medium, hard)
    pub difficulty: String,
    
    /// Timestamp in the video where this topic appears (in seconds)
    pub timestamp: Option<f64>,
}

/// Custom deserializer to handle correct_answer being int, bool, or string
fn deserialize_correct_answer<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Visitor};
    use std::fmt;

    struct CorrectAnswerVisitor;

    impl<'de> Visitor<'de> for CorrectAnswerVisitor {
        type Value = String;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("a string, number, or boolean")
        }

        fn visit_bool<E>(self, value: bool) -> Result<String, E>
        where
            E: de::Error,
        {
            Ok(value.to_string())
        }

        fn visit_i64<E>(self, value: i64) -> Result<String, E>
        where
            E: de::Error,
        {
            Ok(value.to_string())
        }

        fn visit_u64<E>(self, value: u64) -> Result<String, E>
        where
            E: de::Error,
        {
            Ok(value.to_string())
        }

        fn visit_str<E>(self, value: &str) -> Result<String, E>
        where
            E: de::Error,
        {
            Ok(value.to_string())
        }

        fn visit_string<E>(self, value: String) -> Result<String, E>
        where
            E: de::Error,
        {
            Ok(value)
        }
    }

    deserializer.deserialize_any(CorrectAnswerVisitor)
}


// ============================================
// Content Flagging
// ============================================

impl AiSummary {
    /// Flag a summary for review
    pub(crate) async fn flag(
        event_id: Key,
        language: String,
        reason: Option<String>,
        context: &Context,
    ) -> ApiResult<Self> {
        // Get username if user is logged in
        let username = match &context.auth.state {
            AuthState::User(user) => Some(user.username.clone()),
            _ => None,
        };
        
        // Load the summary
        let query = format!(
            "select {} from ai_summaries where event_id = $1 and language = $2",
            Self::select()
        );
        let summary = context.db
            .query_opt(&query, &[&event_id, &language])
            .await?
            .ok_or_else(|| {
                invalid_input!("AI summary not found for this event and language")
            })?;
        let summary = Self::from_row_start(&summary);
        
        // Insert the flag
        context.db.execute(
            "insert into ai_content_flags \
             (content_type, content_id, event_id, username, reason) \
             values ('summary', $1, $2, $3, $4)",
            &[&summary.id, &event_id, &username, &reason],
        ).await?;
        
        // Update the summary's flag status
        context.db.execute(
            "update ai_summaries \
             set flagged = true, flag_count = flag_count + 1, updated_at = now() \
             where id = $1",
            &[&summary.id],
        ).await?;
        
        // Reload and return the updated summary
        Self::load_for_event(event_id, Some(language), context)
            .await?
            .ok_or_else(|| invalid_input!("AI summary not found"))
    }
}

impl AiQuiz {
    /// Flag a quiz for review
    pub(crate) async fn flag(
        event_id: Key,
        language: String,
        reason: Option<String>,
        context: &Context,
    ) -> ApiResult<Self> {
        // Get username if user is logged in
        let username = match &context.auth.state {
            AuthState::User(user) => Some(user.username.clone()),
            _ => None,
        };
        
        // Load the quiz
        let query = format!(
            "select {} from ai_quizzes where event_id = $1 and language = $2",
            Self::select()
        );
        let quiz = context.db
            .query_opt(&query, &[&event_id, &language])
            .await?
            .ok_or_else(|| {
                invalid_input!("AI quiz not found for this event and language")
            })?;
        let quiz = Self::from_row_start(&quiz);
        
        // Insert the flag
        context.db.execute(
            "insert into ai_content_flags \
             (content_type, content_id, event_id, username, reason) \
             values ('quiz', $1, $2, $3, $4)",
            &[&quiz.id, &event_id, &username, &reason],
        ).await?;
        
        // Update the quiz's flag status
        context.db.execute(
            "update ai_quizzes \
             set flagged = true, flag_count = flag_count + 1, updated_at = now() \
             where id = $1",
            &[&quiz.id],
        ).await?;
        
        // Reload and return the updated quiz
        Self::load_for_event(event_id, Some(language), context)
            .await?
            .ok_or_else(|| invalid_input!("AI quiz not found"))
    }
}

// ============================================
// Cumulative Quiz
// ============================================

/// Represents an AI-generated cumulative quiz covering multiple videos in a series
#[derive(Debug)]
pub(crate) struct AiCumulativeQuiz {
    pub(crate) id: i64,
    pub(crate) event_id: Key,
    pub(crate) series_id: Key,
    pub(crate) language: String,
    pub(crate) questions: JsonValue,
    pub(crate) model: String,
    pub(crate) processing_time_ms: Option<i32>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
    pub(crate) approved: bool,
    pub(crate) approved_at: Option<DateTime<Utc>>,
    pub(crate) approved_by: Option<String>,
    pub(crate) edited_by_human: bool,
    pub(crate) last_edited_by: Option<String>,
    pub(crate) flagged: bool,
    pub(crate) flag_count: i32,
    pub(crate) included_event_ids: Vec<Key>,
    pub(crate) video_count: i32,
}

impl_from_db!(
    AiCumulativeQuiz,
    select: {
        ai_cumulative_quizzes.{
            id,
            event_id,
            series_id,
            language,
            questions,
            model,
            processing_time_ms,
            created_at,
            updated_at,
            approved,
            approved_at,
            approved_by,
            edited_by_human,
            last_edited_by,
            flagged,
            flag_count,
            included_event_ids,
            video_count,
        },
    },
    |row| {
        Self {
            id: row.id(),
            event_id: row.event_id(),
            series_id: row.series_id(),
            language: row.language(),
            questions: row.questions(),
            model: row.model(),
            processing_time_ms: row.processing_time_ms(),
            created_at: row.created_at(),
            updated_at: row.updated_at(),
            approved: row.approved(),
            approved_at: row.approved_at(),
            approved_by: row.approved_by(),
            edited_by_human: row.edited_by_human(),
            last_edited_by: row.last_edited_by(),
            flagged: row.flagged(),
            flag_count: row.flag_count(),
            included_event_ids: row.included_event_ids(),
            video_count: row.video_count(),
        }
    }
);

#[graphql_object(Context = Context)]
impl AiCumulativeQuiz {
    /// The event this cumulative quiz is accessed from
    fn event_id(&self) -> Id {
        Id::event(self.event_id)
    }

    /// The series this cumulative quiz covers
    fn series_id(&self) -> Id {
        Id::series(self.series_id)
    }

    /// Language code of the quiz (e.g., 'en', 'de')
    fn language(&self) -> &str {
        &self.language
    }

    /// The cumulative quiz questions with video context
    fn questions(&self) -> Vec<CumulativeQuizQuestion> {
        // Parse the questions JSON array
        self.questions
            .as_array()
            .map(|questions| {
                questions
                    .iter()
                    .filter_map(|q| serde_json::from_value(q.clone()).ok())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Information about videos included in this quiz
    fn included_videos(&self) -> Vec<VideoInfo> {
        // Extract video info from questions
        let questions = self.questions();
        let mut video_map: std::collections::HashMap<String, (String, i32, usize)> = 
            std::collections::HashMap::new();

        for question in questions {
            let ctx = &question.video_context;
            let entry = video_map.entry(ctx.event_id.clone())
                .or_insert((ctx.video_title.clone(), ctx.video_number, 0));
            entry.2 += 1; // Increment question count
        }

        let mut videos: Vec<_> = video_map.into_iter()
            .map(|(event_id, (title, position, count))| VideoInfo {
                event_id,
                title,
                position,
                question_count: count as i32,
            })
            .collect();
        
        videos.sort_by_key(|v| v.position);
        videos
    }

    /// Number of videos included in this cumulative quiz
    fn video_count(&self) -> i32 {
        self.video_count
    }

    /// OpenAI model used to generate this quiz
    fn model(&self) -> &str {
        &self.model
    }

    /// Time taken to generate the quiz in milliseconds
    fn processing_time_ms(&self) -> Option<i32> {
        self.processing_time_ms
    }

    /// When this quiz was created
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// When this quiz was last updated
    fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    /// Whether this quiz has been approved by an admin
    fn approved(&self) -> bool {
        self.approved
    }

    /// When this quiz was approved
    fn approved_at(&self) -> Option<DateTime<Utc>> {
        self.approved_at
    }

    /// Username of the admin who approved this quiz
    fn approved_by(&self) -> Option<&str> {
        self.approved_by.as_deref()
    }

    /// Whether this quiz has been manually edited by a human
    fn edited_by_human(&self) -> bool {
        self.edited_by_human
    }

    /// Username of the last person who edited this quiz
    fn last_edited_by(&self) -> Option<&str> {
        self.last_edited_by.as_deref()
    }

    /// Whether this quiz has been flagged for review
    fn flagged(&self) -> bool {
        self.flagged
    }

    /// Number of times this quiz has been flagged
    fn flag_count(&self) -> i32 {
        self.flag_count
    }
}

impl AiCumulativeQuiz {
    /// Load cumulative quiz for a specific event and language
    /// If no language specified, uses the first available language from all AI content
    pub(crate) async fn load_for_event(
        event_id: Key,
        language: Option<String>,
        context: &Context,
    ) -> ApiResult<Option<Self>> {
        let selection = Self::select();
        
        let lang = if let Some(lang) = language {
            lang
        } else {
            // No language specified - get first available language across all AI content
            let lang_query = "
                select language from (
                    select language from ai_summaries where event_id = $1
                    union
                    select language from ai_quizzes where event_id = $1
                    union
                    select language from ai_cumulative_quizzes where event_id = $1
                ) as langs
                order by language limit 1
            ";
            match context.db.query_opt(lang_query, &[&event_id]).await? {
                Some(row) => row.get::<_, String>(0),
                None => return Ok(None), // No AI content at all
            }
        };
        
        // Try to load cumulative quiz for the determined language
        let query = format!(
            "SELECT {selection} FROM ai_cumulative_quizzes \
             WHERE event_id = $1 AND language = $2"
        );

        context.db
            .query_opt(&query, &[&event_id, &lang])
            .await?
            .map(|row| Self::from_row_start(&row))
            .pipe(Ok)
    }

    /// Check if an event can have a cumulative quiz (is part of a series)
    pub(crate) async fn can_generate(
        event_id: Key,
        context: &Context,
    ) -> ApiResult<bool> {
        let query = "
            SELECT series FROM all_events 
            WHERE id = $1 AND series IS NOT NULL AND state = 'ready'
        ";
        
        let has_series = context.db
            .query_opt(query, &[&event_id])
            .await?
            .is_some();
            
        Ok(has_series)
    }

    /// Get the position of an event within its series (1-based)
    pub(crate) async fn get_series_position(
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
                    )::int as position
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

    /// Get total count of videos in the same series
    pub(crate) async fn get_series_video_count(
        event_id: Key,
        context: &Context,
    ) -> ApiResult<Option<i32>> {
        let query = "
            SELECT COUNT(*)::int
            FROM all_events
            WHERE series = (SELECT series FROM all_events WHERE id = $1)
                AND state = 'ready'
        ";
        
        context.db
            .query_opt(query, &[&event_id])
            .await?
            .map(|row| row.get::<_, i32>(0))
            .pipe(Ok)
    }
}

// ============================================
// Cumulative Quiz Question Types
// ============================================

/// A quiz question with video context information
#[derive(Debug, Clone, Serialize, Deserialize, GraphQLObject)]
pub(crate) struct CumulativeQuizQuestion {
    /// The question text
    pub question: String,
    
    /// Type of question (multiple_choice or true_false)
    #[serde(rename = "questionType")]
    pub question_type: String,
    
    /// Available answer options (for multiple choice)
    pub options: Option<Vec<String>>,
    
    /// The correct answer (as string representation)
    #[serde(rename = "correctAnswer")]
    #[serde(deserialize_with = "deserialize_correct_answer")]
    pub correct_answer: String,
    
    /// Explanation of the answer
    pub explanation: String,
    
    /// Difficulty level (easy, medium, hard)
    pub difficulty: String,
    
    /// Context about which video this question comes from
    #[serde(rename = "videoContext")]
    pub video_context: VideoContext,
}

/// Information about which video a question comes from
#[derive(Debug, Clone, Serialize, Deserialize, GraphQLObject)]
pub(crate) struct VideoContext {
    /// Event ID of the video this question is from
    #[serde(rename = "eventId")]
    pub event_id: String,
    
    /// Title of the video
    #[serde(rename = "videoTitle")]
    pub video_title: String,
    
    /// Position/number of this video in the series (1-based)
    #[serde(rename = "videoNumber")]
    pub video_number: i32,
    
    /// Timestamp in the video where this topic appears (in seconds)
    pub timestamp: Option<i32>,
}

/// Summary information about a video included in a cumulative quiz
#[derive(Debug, Clone, Serialize, Deserialize, GraphQLObject)]
pub(crate) struct VideoInfo {
    /// Event ID
    #[serde(rename = "eventId")]
    pub event_id: String,
    
    /// Video title
    pub title: String,
    
    /// Position in series (1-based)
    pub position: i32,
    
    /// Number of questions from this video
    #[serde(rename = "questionCount")]
    pub question_count: i32,
}

