use chrono::{DateTime, Utc};
use juniper::{graphql_object, GraphQLObject};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::{
    api::{
        err::ApiResult,
        Context,
        Id,
    },
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
    pub(crate) event_id: Key,
    pub(crate) language: String,
    pub(crate) summary: String,
    pub(crate) model: String,
    pub(crate) processing_time_ms: Option<i32>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

impl_from_db!(
    AiSummary,
    select: {
        ai_summaries.{
            event_id,
            language,
            summary,
            model,
            processing_time_ms,
            created_at,
            updated_at,
        },
    },
    |row| {
        Self {
            event_id: row.event_id(),
            language: row.language(),
            summary: row.summary(),
            model: row.model(),
            processing_time_ms: row.processing_time_ms(),
            created_at: row.created_at(),
            updated_at: row.updated_at(),
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
}

impl AiSummary {
    /// Load AI summary for a specific event
    /// If no language specified, returns first available summary for this event
    pub(crate) async fn load_for_event(
        event_id: Key,
        language: Option<String>,
        context: &Context,
    ) -> ApiResult<Option<Self>> {
        let selection = Self::select();
        
        if let Some(lang) = language {
            // Try exact language if specified
            let query = format!(
                "select {selection} from ai_summaries \
                 where event_id = $1 and language = $2"
            );
            context.db
                .query_opt(&query, &[&event_id, &lang])
                .await?
                .map(|row| Self::from_row_start(&row))
                .pipe(Ok)
        } else {
            // No language specified - return first available summary
            let query = format!(
                "select {selection} from ai_summaries \
                 where event_id = $1 \
                 order by language limit 1"
            );
            context.db
                .query_opt(&query, &[&event_id])
                .await?
                .map(|row| Self::from_row_start(&row))
                .pipe(Ok)
        }
    }
}


// ============================================
// AI Quiz
// ============================================

/// Represents an AI-generated quiz for a video
#[derive(Debug)]
pub(crate) struct AiQuiz {
    pub(crate) event_id: Key,
    pub(crate) language: String,
    pub(crate) quiz_data: JsonValue,
    pub(crate) model: String,
    pub(crate) processing_time_ms: Option<i32>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

impl_from_db!(
    AiQuiz,
    select: {
        ai_quizzes.{
            event_id,
            language,
            quiz_data,
            model,
            processing_time_ms,
            created_at,
            updated_at,
        },
    },
    |row| {
        Self {
            event_id: row.event_id(),
            language: row.language(),
            quiz_data: row.quiz_data(),
            model: row.model(),
            processing_time_ms: row.processing_time_ms(),
            created_at: row.created_at(),
            updated_at: row.updated_at(),
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
}

impl AiQuiz {
    /// Load AI quiz for a specific event
    /// If no language specified, returns first available quiz for this event
    pub(crate) async fn load_for_event(
        event_id: Key,
        language: Option<String>,
        context: &Context,
    ) -> ApiResult<Option<Self>> {
        let selection = Self::select();
        
        if let Some(lang) = language {
            // Try exact language if specified
            let query = format!(
                "select {selection} from ai_quizzes \
                 where event_id = $1 and language = $2"
            );
            context.db
                .query_opt(&query, &[&event_id, &lang])
                .await?
                .map(|row| Self::from_row_start(&row))
                .pipe(Ok)
        } else {
            // No language specified - return first available quiz
            let query = format!(
                "select {selection} from ai_quizzes \
                 where event_id = $1 \
                 order by language limit 1"
            );
            context.db
                .query_opt(&query, &[&event_id])
                .await?
                .map(|row| Self::from_row_start(&row))
                .pipe(Ok)
        }
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

