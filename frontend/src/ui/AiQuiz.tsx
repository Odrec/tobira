import React, { useState } from "react";
import { useFragment, graphql } from "react-relay/hooks";
import { useTranslation } from "react-i18next";
import { Button } from "@opencast/appkit";
import { LuCheck, LuX, LuCircle } from "react-icons/lu";

import { AiQuiz$key } from "./__generated__/AiQuiz.graphql";
import { COLORS } from "../color";

const fragment = graphql`
  fragment AiQuiz on AiQuiz {
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
  }
`;

type Props = {
  fragmentRef: AiQuiz$key;
  onSeekToTimestamp?: (seconds: number) => void;
};

export const AiQuiz: React.FC<Props> = ({ fragmentRef, onSeekToTimestamp }) => {
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

    // For true/false questions, compare case-insensitively since UI uses "True"/"False"
    // but database stores true/false as booleans or lowercase strings
    const isCorrect = question.questionType === "true_false"
        ? selectedAnswer?.toLowerCase() === String(question.correctAnswer).toLowerCase()
        : selectedAnswer === question.correctAnswer;

    const handleAnswer = (answer: string) => {
        if (isAnswered) {
            return;
        }

        setSelectedAnswer(answer);
        setShowExplanation(true);

        // Check if answer is correct using same logic as isCorrect
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

    const handleSeek = () => {
        if (question.timestamp != null && onSeekToTimestamp) {
            onSeekToTimestamp(question.timestamp);
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
                marginBottom: "1.5rem",
            }}>
                <h3 css={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <LuCircle size={24} />
                    {t("video.ai-quiz.title", "Interactive Quiz")}
                </h3>
                <div css={{ display: "flex", gap: "1rem", alignItems: "center" }}>
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
            </div>

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
                                        backgroundColor: isAnswered && selectedAnswer === option
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
                                        backgroundColor: isAnswered && selectedAnswer === option
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
                    <Button onClick={handleSeek}>
                        {t("video.ai-quiz.seek-to-topic", "Jump to topic in video")}
                    </Button>
                )}
            </div>
        </div>
    );
};
