import React, { useState } from "react";
import { useFragment, graphql } from "react-relay/hooks";
import { useTranslation } from "react-i18next";
import { Button } from "@opencast/appkit";
import { LuCheck, LuX, LuCircle, LuPencil, LuChevronDown, LuChevronUp } from "react-icons/lu";

import { AiQuiz$key } from "./__generated__/AiQuiz.graphql";
import { COLORS } from "../color";
import { FlagContentButton } from "./FlagContentButton";
import { secondsToTimeString } from "../util";

const fragment = graphql`
  fragment AiQuiz on AiQuiz {
    eventId
    language
    questions {
      question
      questionType
      options
      correctAnswer
      explanation
      difficulty
      timestamp
    }
    model
    createdAt
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
    fragmentRef: AiQuiz$key;
    onSeekToTimestamp?: (seconds: number) => Promise<boolean>;
    videoUrl?: string;
};

export const AiQuiz: React.FC<Props> = ({ fragmentRef, onSeekToTimestamp, videoUrl }) => {
    const { t } = useTranslation();
    const data = useFragment(fragment, fragmentRef);
    const [isExpanded, setIsExpanded] = useState(true);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
    const [isJumping, setIsJumping] = useState(false);
    const [jumpSuccess, setJumpSuccess] = useState(false);

    if (!data || !data.questions || data.questions.length === 0) {
        return null;
    }

    const question = data.questions[currentQuestion];
    const isAnswered = answeredQuestions.has(currentQuestion);

    // Normalize strings for comparison
    const normalizeAnswer = (answer: string | null | undefined): string => (answer ?? "").trim();

    // Check if correctAnswer is a numeric index
    const correctAnswerIndex = parseInt(question.correctAnswer);
    const correctAnswerText = !isNaN(correctAnswerIndex) && question.options
        ? question.options[correctAnswerIndex]
        : question.correctAnswer;

    // For true/false questions, compare case-insensitively since UI uses "True"/"False"
    // but database stores true/false as booleans or lowercase strings
    const isCorrect = question.questionType === "true_false"
        ? selectedAnswer?.toLowerCase() === String(question.correctAnswer).toLowerCase()
        : normalizeAnswer(selectedAnswer) === normalizeAnswer(correctAnswerText);

    const handleAnswer = (answer: string) => {
        if (isAnswered) {
            return;
        }

        setSelectedAnswer(answer);
        setShowExplanation(true);

        // Normalize strings for comparison
        const normalizeAnswer = (ans: string | null | undefined): string => (ans ?? "").trim();

        // Check if correctAnswer is a numeric index
        const correctAnswerIndex = parseInt(question.correctAnswer);
        const correctAnswerText = !isNaN(correctAnswerIndex) && question.options
            ? question.options[correctAnswerIndex]
            : question.correctAnswer;

        // Check if answer is correct using same logic as isCorrect
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

    const handleSeek = async () => {
        if (question.timestamp != null && onSeekToTimestamp) {
            setIsJumping(true);
            setJumpSuccess(false);
            try {
                const success = await onSeekToTimestamp(question.timestamp);
                setJumpSuccess(success);
                // Clear success message after 2 seconds
                if (success) {
                    setTimeout(() => setJumpSuccess(false), 2000);
                }
            } finally {
                setIsJumping(false);
            }
        }
    };

    return (
        <div css={{
            padding: "20px 22px",
            marginTop: "16px",
            backgroundColor: COLORS.neutral10,
            borderRadius: 8,
        }}>
            <div css={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: isExpanded ? "1.5rem" : 0,
            }}>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    css={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        color: "inherit",
                        margin: 0,
                        "&:hover": {
                            opacity: 0.8,
                        },
                    }}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded
                        ? t("video.ai-quiz.collapse", "Collapse quiz")
                        : t("video.ai-quiz.expand", "Expand quiz")
                    }
                >
                    <LuCircle size={24} />
                    <h3 css={{ margin: 0 }}>
                        {t("video.ai-quiz.title", "Interactive Quiz")}
                    </h3>
                    {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
                </button>
                {isExpanded && (
                    <div css={{
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "center",
                        flexWrap: "wrap",
                    }}>
                        <FlagContentButton
                            eventId={data.eventId}
                            language={data.language}
                            contentType="quiz"
                            flagged={data.flagged}
                        />
                        {data.editedByHuman && (
                            <div css={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                fontSize: "0.85rem",
                                color: COLORS.primary0,
                                backgroundColor: COLORS.primary1,
                                padding: "4px 10px",
                                borderRadius: 4,
                                fontWeight: 500,
                            }} title={
                                data.lastEditedBy
                                    ? t(
                                        "video.ai-quiz.edited-by",
                                        "Edited by {{user}}",
                                        { user: data.lastEditedBy },
                                    )
                                    : t("video.ai-quiz.edited", "Edited by human")
                            }>
                                <LuPencil size={14} />
                                {t("video.ai-quiz.human-edited", "Edited")}
                            </div>
                        )}
                        {data.approved && (
                            <div css={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                                fontSize: "0.85rem",
                                color: COLORS.happy2,
                                backgroundColor: COLORS.happy0,
                                padding: "4px 10px",
                                borderRadius: 4,
                                fontWeight: 500,
                            }} title={
                                data.approvedBy
                                    ? t(
                                        "video.ai-quiz.approved-by",
                                        "Approved by {{user}}",
                                        { user: data.approvedBy },
                                    )
                                    : t("video.ai-quiz.approved", "Approved by admin")
                            }>
                                <LuCheck size={14} />
                                {t("video.ai-quiz.approved-badge", "Approved")}
                            </div>
                        )}
                        <div css={{
                            fontSize: "0.85rem",
                            color: COLORS.neutral40,
                            fontWeight: 500,
                        }}>
                            {data.language.toUpperCase()}
                        </div>
                        <div css={{ fontSize: "0.9rem", color: COLORS.neutral40 }}>
                            {t("video.ai-quiz.score", "Score:")} {score}/{data.questions.length}
                        </div>
                    </div>
                )}
            </div>

            {isExpanded && (
                <>
                    <div css={{
                        marginBottom: "1rem",
                        fontSize: "0.85rem",
                        color: COLORS.neutral40,
                    }}>
                        {t("video.ai-quiz.question-number", "Question {{current}} of {{total}}", {
                            current: currentQuestion + 1,
                            total: data.questions.length,
                        })}
                        {" · "}
                        <span css={{ textTransform: "capitalize" }}>{question.difficulty}</span>
                    </div>

                    <div css={{
                        fontSize: "1.1rem",
                        fontWeight: 500,
                        marginBottom: "1.5rem",
                    }}>
                        {question.question}
                    </div>

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
                                                        ? (isCorrect
                                                            ? COLORS.happy0
                                                            : COLORS.danger0)
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
                                                        ? (isCorrect
                                                            ? COLORS.happy0
                                                            : COLORS.danger0)
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

                    <div css={{
                        display: "flex",
                        gap: "0.75rem",
                        marginTop: "1.5rem",
                        justifyContent: "space-between",
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

                        {question.timestamp != null && onSeekToTimestamp && (
                            <Button
                                onClick={handleSeek}
                                disabled={isJumping}
                                css={{
                                    position: "relative",
                                    backgroundColor: jumpSuccess ? COLORS.happy1 : undefined,
                                    "&:hover:not([disabled])": {
                                        backgroundColor: jumpSuccess ? COLORS.happy1 : undefined,
                                    },
                                }}
                            >
                                {isJumping
                                    ? t("video.ai-quiz.jumping", "Jumping...")
                                    : jumpSuccess
                                        ? t("video.ai-quiz.jumped", "✓ Jumped to video")
                                        : t("video.ai-quiz.seek-to-topic", "Jump to topic in video")
                                }
                            </Button>
                        )}
                    </div>

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
                </>
            )}
        </div>
    );
};
