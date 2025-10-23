import React, { useState } from "react";
import { useFragment, graphql } from "react-relay/hooks";
import { useTranslation } from "react-i18next";
import { LuCircle, LuChevronDown, LuChevronUp } from "react-icons/lu";

import { AiQuizModeSelector$key } from "./__generated__/AiQuizModeSelector.graphql";
import { COLORS } from "../color";
import { AiQuiz } from "./AiQuiz";
import { AiCumulativeQuiz } from "./AiCumulativeQuiz";

const fragment = graphql`
  fragment AiQuizModeSelector on AuthorizedEvent
    @argumentDefinitions(language: { type: "String" }) {
    id
    opencastId
    databaseId
    aiQuiz(language: $language) {
      ...AiQuiz
      questions {
        question
      }
    }
    aiCumulativeQuiz(language: $language) {
      ...AiCumulativeQuiz
      questions {
        question
      }
    }
    canGenerateCumulativeQuiz
    seriesVideoPosition
    seriesVideoCount
  }
`;

type QuizMode = "single" | "cumulative";

type Props = {
    fragmentRef: AiQuizModeSelector$key;
    language: string;
    onSeekToTimestamp?: (seconds: number) => Promise<boolean>;
};

export const AiQuizModeSelector: React.FC<Props> = ({
    fragmentRef,
    onSeekToTimestamp,
}) => {
    const { t } = useTranslation();
    const event = useFragment(fragment, fragmentRef);
    const [quizMode, setQuizMode] = useState<QuizMode>("single");
    const [isExpanded, setIsExpanded] = useState(true);

    const canUseCumulative = event.canGenerateCumulativeQuiz
                             && event.seriesVideoPosition
                             && event.seriesVideoPosition >= 1;

    const singleQuestionCount = event.aiQuiz?.questions?.length || 0;
    const cumulativeQuestionCount = event.aiCumulativeQuiz?.questions?.length || 0;

    // If can't use cumulative or no quiz data, just show regular quiz
    if (!canUseCumulative) {
        return event.aiQuiz ? (
            <AiQuiz fragmentRef={event.aiQuiz} onSeekToTimestamp={onSeekToTimestamp} />
        ) : null;
    }

    return (
        <div css={{
            padding: "20px 22px",
            marginTop: "16px",
            backgroundColor: COLORS.neutral10,
            borderRadius: 8,
        }}>
            {/* Header with expand/collapse */}
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
                    marginBottom: isExpanded ? "1.5rem" : 0,
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
                <>
                    {/* Mode Selector */}
                    <div css={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                        marginBottom: "1.5rem",
                    }}>
                        {/* Single Video Option */}
                        <label css={{
                            display: "flex",
                            alignItems: "flex-start",
                            cursor: "pointer",
                            padding: "0.75rem",
                            borderRadius: 4,
                            border: `2px solid ${
                                quizMode === "single" ? COLORS.primary0 : COLORS.neutral25
                            }`,
                            backgroundColor:
                                quizMode === "single" ? COLORS.primary1 : "transparent",
                            transition: "all 0.2s",
                            "&:hover": {
                                borderColor: COLORS.primary0,
                            },
                        }}>
                            <input
                                type="radio"
                                value="single"
                                checked={quizMode === "single"}
                                onChange={() => setQuizMode("single")}
                                css={{
                                    marginRight: "0.75rem",
                                    marginTop: "0.25rem",
                                    cursor: "pointer",
                                }}
                            />
                            <div css={{ flex: 1 }}>
                                <div css={{ fontWeight: 500, marginBottom: "0.25rem" }}>
                                    {t("video.ai-quiz.single-mode", "This video only")}
                                </div>
                                <div css={{ fontSize: "0.85rem", color: COLORS.neutral40 }}>
                                    {singleQuestionCount > 0
                                        ? t("video.ai-quiz.question-count", "{{count}} questions", {
                                            count: singleQuestionCount,
                                        })
                                        : t("video.ai-quiz.not-generated", "Not yet generated")
                                    }
                                </div>
                            </div>
                        </label>

                        {/* Cumulative Option */}
                        <label css={{
                            display: "flex",
                            alignItems: "flex-start",
                            cursor: "pointer",
                            padding: "0.75rem",
                            borderRadius: 4,
                            border: `2px solid ${
                                quizMode === "cumulative" ? COLORS.primary0 : COLORS.neutral25
                            }`,
                            backgroundColor:
                                quizMode === "cumulative" ? COLORS.primary1 : "transparent",
                            transition: "all 0.2s",
                            "&:hover": {
                                borderColor: COLORS.primary0,
                            },
                        }}>
                            <input
                                type="radio"
                                value="cumulative"
                                checked={quizMode === "cumulative"}
                                onChange={() => setQuizMode("cumulative")}
                                css={{
                                    marginRight: "0.75rem",
                                    marginTop: "0.25rem",
                                    cursor: "pointer",
                                }}
                            />
                            <div css={{ flex: 1 }}>
                                <div css={{ fontWeight: 500, marginBottom: "0.25rem" }}>
                                    {t(
                                        "video.ai-quiz.cumulative-mode",
                                        "Cumulative - All {{count}} videos up to here",
                                        { count: event.seriesVideoPosition },
                                    )}
                                </div>
                                <div css={{ fontSize: "0.85rem", color: COLORS.neutral40 }}>
                                    {cumulativeQuestionCount > 0
                                        ? t("video.ai-quiz.question-count", "{{count}} questions", {
                                            count: cumulativeQuestionCount,
                                        })
                                        : t(
                                            "video.ai-quiz.will-generate",
                                            "Will be generated on request",
                                        )
                                    }
                                </div>
                            </div>
                        </label>
                    </div>

                    {/* Quiz Display */}
                    {quizMode === "single" && event.aiQuiz ? (
                        <AiQuiz
                            fragmentRef={event.aiQuiz}
                            onSeekToTimestamp={onSeekToTimestamp}
                        />
                    ) : quizMode === "cumulative" && event.aiCumulativeQuiz ? (
                        <AiCumulativeQuiz
                            fragmentRef={event.aiCumulativeQuiz}
                            onSeekToTimestamp={onSeekToTimestamp}
                            currentEventId={event.databaseId}
                        />
                    ) : (
                        <div css={{
                            padding: "2rem",
                            textAlign: "center",
                            color: COLORS.neutral40,
                            backgroundColor: COLORS.neutral05,
                            borderRadius: 4,
                        }}>
                            {quizMode === "single" ? (
                                <p>
                                    {t(
                                        "video.ai-quiz.not-available-single",
                                        "Quiz not yet available for this video. "
                                        + "Generate it using the AI service.",
                                    )}
                                </p>
                            ) : (
                                <p>
                                    {t(
                                        "video.ai-quiz.not-available-cumulative",
                                        "Cumulative quiz not yet generated. "
                                        + "This will include questions from all {{count}} videos "
                                        + "in the series.",
                                        { count: event.seriesVideoPosition },
                                    )}
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
