import React, { useState } from "react";
import { useFragment, graphql } from "react-relay/hooks";
import { useTranslation } from "react-i18next";
import { Button } from "@opencast/appkit";
import { LuCheck, LuX, LuVideo, LuExternalLink } from "react-icons/lu";

import { AiCumulativeQuiz$key } from "./__generated__/AiCumulativeQuiz.graphql";
import { COLORS } from "../color";
import { secondsToTimeString, keyOfId } from "../util";

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
    allSeriesVideos {
      eventId
      databaseId
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
`;

type Props = {
    fragmentRef: AiCumulativeQuiz$key;
    onSeekToTimestamp?: (seconds: number) => Promise<boolean>;
    currentEventId: string;
};

export const AiCumulativeQuiz: React.FC<Props> = ({
    fragmentRef,
    onSeekToTimestamp,
    currentEventId,
}) => {
    const { t } = useTranslation();
    const data = useFragment(fragment, fragmentRef);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
    const [isNavigating, setIsNavigating] = useState(false);
    const [jumpSuccess, setJumpSuccess] = useState(false);

    if (!data || !data.questions || data.questions.length === 0) {
        return null;
    }

    const question = data.questions[currentQuestion];
    const isAnswered = answeredQuestions.has(currentQuestion);

    // Normalize strings for comparison: trim whitespace and handle null/undefined
    const normalizeAnswer = (answer: string | null | undefined): string => (answer ?? "").trim();

    // Check if correctAnswer is a numeric index
    const correctAnswerIndex = parseInt(question.correctAnswer);
    const correctAnswerText = !isNaN(correctAnswerIndex) && question.options
        ? question.options[correctAnswerIndex]
        : question.correctAnswer;

    const isCorrect = question.questionType === "true_false"
        ? selectedAnswer?.toLowerCase() === String(question.correctAnswer).toLowerCase()
        : normalizeAnswer(selectedAnswer) === normalizeAnswer(correctAnswerText);

    const handleAnswer = (answer: string) => {
        if (isAnswered) {
            return;
        }

        setSelectedAnswer(answer);
        setShowExplanation(true);

        // Normalize strings for comparison: trim whitespace and handle null/undefined
        const normalizeAnswer = (ans: string | null | undefined): string => (ans ?? "").trim();

        // Check if correctAnswer is a numeric index
        const correctAnswerIndex = parseInt(question.correctAnswer);
        const correctAnswerText = !isNaN(correctAnswerIndex) && question.options
            ? question.options[correctAnswerIndex]
            : question.correctAnswer;

        const answerIsCorrect = question.questionType === "true_false"
            ? answer.toLowerCase() === String(question.correctAnswer).toLowerCase()
            : normalizeAnswer(answer) === normalizeAnswer(correctAnswerText);

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
        const { timestamp } = question.videoContext;

        // Only seek to timestamp if we're on the same video
        if (timestamp != null && onSeekToTimestamp) {
            setIsNavigating(true);
            setJumpSuccess(false);
            try {
                const success = await onSeekToTimestamp(timestamp);
                setJumpSuccess(success);
                // Clear success message after 2 seconds
                if (success) {
                    setTimeout(() => setJumpSuccess(false), 2000);
                }
            } finally {
                setIsNavigating(false);
            }
        }
    };

    // Check if this question is from the current video
    const isCurrentVideo = question.videoContext.eventId === currentEventId;

    return (
        <div>
            {/* Video Context Badge */}
            <div css={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "6px 12px",
                backgroundColor: COLORS.primary1,
                borderRadius: 4,
                fontSize: "0.85rem",
                marginBottom: "1rem",
                fontWeight: 500,
            }}>
                <LuVideo size={14} />
                <span>
                    {t("video.ai-quiz.from-video", "Video {{number}}: {{title}}", {
                        number: question.videoContext.videoNumber,
                        title: question.videoContext.videoTitle,
                    })}
                </span>
            </div>

            {/* Question Progress and Score */}
            <div css={{
                marginBottom: "1rem",
                fontSize: "0.85rem",
                color: COLORS.neutral40,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
            }}>
                <span>
                    {t("video.ai-quiz.question-number", "Question {{current}} of {{total}}", {
                        current: currentQuestion + 1,
                        total: data.questions.length,
                    })}
                    {" · "}
                    <span css={{ textTransform: "capitalize" }}>{question.difficulty}</span>
                </span>
                <span css={{ fontWeight: 500 }}>
                    {t("video.ai-quiz.score", "Score:")} {score}/{data.questions.length}
                </span>
            </div>

            {/* Question */}
            <div css={{
                fontSize: "1.1rem",
                fontWeight: 500,
                marginBottom: "1.5rem",
            }}>
                {question.question}
            </div>

            {/* Answer Options */}
            <div css={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {question.questionType === "true_false" ? (
                    <>
                        {["True", "False"].map(option => (
                            <Button
                                key={option}
                                onClick={() => handleAnswer(option)}
                                disabled={isAnswered}
                                css={{
                                    justifyContent: "flex-start",
                                    padding: "1rem",
                                    backgroundColor: isAnswered && selectedAnswer === option
                                        ? (isCorrect ? COLORS.happy0 : COLORS.danger0)
                                        : undefined,
                                    "&:hover:not([disabled])": {
                                        backgroundColor:
                                            isAnswered && selectedAnswer === option
                                                ? (isCorrect ? COLORS.happy0 : COLORS.danger0)
                                                : undefined,
                                    },
                                }}
                            >
                                {option}
                                {isAnswered && selectedAnswer === option && (
                                    isCorrect ? <LuCheck style={{ marginLeft: "auto" }} />
                                        : <LuX style={{ marginLeft: "auto" }} />
                                )}
                            </Button>
                        ))}
                    </>
                ) : (
                    <>
                        {question.options && question.options.map((option, idx) => (
                            <Button
                                key={idx}
                                onClick={() => handleAnswer(option)}
                                disabled={isAnswered}
                                css={{
                                    justifyContent: "flex-start",
                                    padding: "1rem",
                                    backgroundColor: isAnswered && selectedAnswer === option
                                        ? (isCorrect ? COLORS.happy0 : COLORS.danger0)
                                        : undefined,
                                    "&:hover:not([disabled])": {
                                        backgroundColor:
                                            isAnswered && selectedAnswer === option
                                                ? (isCorrect ? COLORS.happy0 : COLORS.danger0)
                                                : undefined,
                                    },
                                }}
                            >
                                {option}
                                {isAnswered && selectedAnswer === option && (
                                    isCorrect ? <LuCheck style={{ marginLeft: "auto" }} />
                                        : <LuX style={{ marginLeft: "auto" }} />
                                )}
                            </Button>
                        ))}
                    </>
                )}
            </div>

            {/* Explanation */}
            {showExplanation && question.explanation && (
                <div css={{
                    marginTop: "1.5rem",
                    padding: "1rem",
                    backgroundColor: COLORS.neutral05,
                    borderRadius: 4,
                }}>
                    <strong>{t("video.ai-quiz.explanation", "Explanation:")}</strong>
                    <p css={{ marginTop: "0.5rem", marginBottom: 0 }}>
                        {question.explanation}
                    </p>
                </div>
            )}

            {/* Navigation */}
            <div css={{
                display: "flex",
                gap: "0.75rem",
                marginTop: "1.5rem",
                justifyContent: "space-between",
                flexWrap: "wrap",
            }}>
                <div css={{ display: "flex", gap: "0.75rem" }}>
                    <Button
                        onClick={handlePrevious}
                        disabled={currentQuestion === 0}
                    >
                        {t("video.ai-quiz.previous", "Previous")}
                    </Button>
                    <Button
                        onClick={handleNext}
                        disabled={currentQuestion === data.questions.length - 1}
                    >
                        {t("video.ai-quiz.next", "Next")}
                    </Button>
                </div>

                {question.videoContext.timestamp != null && (
                    isCurrentVideo && onSeekToTimestamp ? (
                        <Button
                            onClick={handleVideoNavigation}
                            disabled={isNavigating}
                            css={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                backgroundColor: jumpSuccess ? COLORS.happy1 : undefined,
                                "&:hover:not([disabled])": {
                                    backgroundColor: jumpSuccess ? COLORS.happy1 : undefined,
                                },
                            }}
                        >
                            {isNavigating
                                ? t("video.ai-quiz.jumping", "Jumping...")
                                : jumpSuccess
                                    ? t("video.ai-quiz.jumped", "✓ Jumped to video")
                                    : t("video.ai-quiz.jump-to-topic", "Jump to topic in video")
                            }
                        </Button>
                    ) : (
                        <Button
                            onClick={() => {
                                // Find the video in allSeriesVideos by matching databaseId
                                const videoInfo = data.allSeriesVideos?.find(
                                    v => v.databaseId === question.videoContext.eventId,
                                );

                                if (!videoInfo) {
                                    return;
                                }

                                const key = keyOfId(videoInfo.eventId);
                                const timestamp = secondsToTimeString(
                                    question.videoContext.timestamp!,
                                );
                                const url = `/!v/${key}?t=${timestamp}`;
                                window.open(url, "_blank");
                            }}
                            css={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                            }}
                        >
                            <LuExternalLink size={16} />
                            {t("video.ai-quiz.jump-to-topic", "Jump to topic in video")}
                        </Button>
                    )
                )}
            </div>

            {/* Included Videos Info */}
            {data.allSeriesVideos && data.allSeriesVideos.length > 0 && (() => {
                const allVideos = data.allSeriesVideos;
                if (!allVideos) {
                    return null;
                }

                const videosWithQuestions = allVideos
                    .filter(v => v.questionCount > 0);
                const videosWithoutQuestions = allVideos
                    .filter(v => v.questionCount === 0);
                const totalVideos = data.videoCount;

                return (
                    <div css={{
                        marginTop: "1.5rem",
                        padding: "0.75rem",
                        backgroundColor: COLORS.neutral05,
                        borderRadius: 4,
                        fontSize: "0.85rem",
                    }}>
                        <div css={{ marginBottom: "0.5rem" }}>
                            <strong>
                                {videosWithQuestions.length === totalVideos
                                    ? t(
                                        "video.ai-quiz.covers-all-videos",
                                        "Questions from all {{count}} videos in series",
                                        { count: totalVideos },
                                    )
                                    : t(
                                        "video.ai-quiz.covers-some-videos",
                                        "Questions from {{actual}} of {{total}} videos in series",
                                        { actual: videosWithQuestions.length, total: totalVideos },
                                    )
                                }
                            </strong>
                        </div>

                        {/* Show which videos contributed questions */}
                        {videosWithQuestions.length > 0 && (
                            <div>
                                <div css={{
                                    fontSize: "0.9rem",
                                    marginBottom: "0.25rem",
                                }}>
                                    {videosWithQuestions.length === 1
                                        ? t("video.ai-quiz.video-included", "Video included:")
                                        : t("video.ai-quiz.videos-included", "Videos included:")
                                    }
                                </div>
                                <ul css={{
                                    marginTop: 0,
                                    paddingLeft: "1.5rem",
                                    marginBottom: 0,
                                }}>
                                    {videosWithQuestions.map(video => (
                                        <li key={video.eventId}>
                                            {video.title} (
                                            {t(
                                                "video.ai-quiz.question-count",
                                                "{{count}} questions",
                                                { count: video.questionCount },
                                            )}
                                            )
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Show videos without questions if any */}
                        {videosWithoutQuestions.length > 0 && (
                            <details css={{ marginTop: "0.75rem" }}>
                                <summary css={{
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    color: COLORS.neutral40,
                                    fontWeight: 500,
                                }}>
                                    {videosWithoutQuestions.length === 1
                                        ? t(
                                            "video.ai-quiz.video-without-questions",
                                            "1 video without questions yet",
                                        )
                                        : t(
                                            "video.ai-quiz.videos-without-questions",
                                            "{{count}} videos without questions yet",
                                            { count: videosWithoutQuestions.length },
                                        )
                                    }
                                </summary>
                                <ul css={{
                                    marginTop: "0.25rem",
                                    paddingLeft: "1.5rem",
                                    marginBottom: 0,
                                    fontSize: "0.85rem",
                                }}>
                                    {videosWithoutQuestions.map(video => (
                                        <li
                                            key={video.eventId}
                                            css={{ color: COLORS.neutral40 }}
                                        >
                                            {video.title}
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                );
            })()}

            {/* Footer Info */}
            <div css={{
                marginTop: "1rem",
                fontSize: "0.85rem",
                color: COLORS.neutral40,
            }}>
                <div css={{ fontStyle: "italic", marginBottom: "0.5rem" }}>
                    {t("video.ai-quiz.generated-by", "Generated by")} {data.model}
                </div>
                <div css={{
                    fontSize: "0.8rem",
                    color: COLORS.neutral50,
                }}>
                    ⚠️ {t(
                        "video.ai-content.disclaimer",
                        "AI-generated content may contain errors or inaccuracies. "
                        + "Always verify information from reliable sources.",
                    )}
                </div>
            </div>
        </div>
    );
};
