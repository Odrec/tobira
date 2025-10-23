import React, { useState } from "react";
import { useFragment, graphql } from "react-relay/hooks";
import { useTranslation } from "react-i18next";
import { Button } from "@opencast/appkit";
import { LuCheck, LuX, LuVideo, LuExternalLink } from "react-icons/lu";

import { AiCumulativeQuiz$key } from "./__generated__/AiCumulativeQuiz.graphql";
import { COLORS } from "../color";

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

    if (!data || !data.questions || data.questions.length === 0) {
        return null;
    }

    const question = data.questions[currentQuestion];
    const isAnswered = answeredQuestions.has(currentQuestion);
    const isCorrect = question.questionType === "true_false"
        ? selectedAnswer?.toLowerCase() === String(question.correctAnswer).toLowerCase()
        : selectedAnswer === question.correctAnswer;

    const handleAnswer = (answer: string) => {
        if (isAnswered) {
            return;
        }

        setSelectedAnswer(answer);
        setShowExplanation(true);

        const answerIsCorrect = question.questionType === "true_false"
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
            setIsNavigating(true);
            try {
                await onSeekToTimestamp(timestamp);
            } finally {
                setIsNavigating(false);
            }
        } else {
            // Different video - open in new tab
            const url = `/v/${eventId}${timestamp ? `?t=${timestamp}` : ""}`;
            window.open(url, "_blank");
        }
    };

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
                        {question.options?.map((option, idx) => (
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
                    <Button
                        onClick={handleVideoNavigation}
                        disabled={isNavigating}
                        css={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                        }}
                    >
                        {question.videoContext.eventId === currentEventId ? (
                            <>
                                {isNavigating
                                    ? t("video.ai-quiz.jumping", "Jumping...")
                                    : t("video.ai-quiz.jump-to-topic", "Jump to topic in video")
                                }
                            </>
                        ) : (
                            <>
                                <LuExternalLink size={14} />
                                {t("video.ai-quiz.open-video", "Open: {{title}}", {
                                    title: question.videoContext.videoTitle,
                                })}
                            </>
                        )}
                    </Button>
                )}
            </div>

            {/* Included Videos Info */}
            {data.includedVideos && data.includedVideos.length > 1 && (
                <details css={{
                    marginTop: "1.5rem",
                    padding: "0.75rem",
                    backgroundColor: COLORS.neutral05,
                    borderRadius: 4,
                    fontSize: "0.85rem",
                }}>
                    <summary css={{
                        cursor: "pointer",
                        fontWeight: 500,
                        marginBottom: "0.5rem",
                    }}>
                        {t("video.ai-quiz.covers-videos", "Covers {{count}} videos", {
                            count: data.videoCount,
                        })}
                    </summary>
                    <ul css={{
                        marginTop: "0.5rem",
                        paddingLeft: "1.5rem",
                        marginBottom: 0,
                    }}>
                        {data.includedVideos.map(video => (
                            <li key={video.eventId}>
                                {video.title} ({video.questionCount} questions)
                            </li>
                        ))}
                    </ul>
                </details>
            )}

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
