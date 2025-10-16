import React, { useState } from "react";
import { graphql, useMutation } from "react-relay/hooks";
import { useTranslation } from "react-i18next";
import { Button } from "@opencast/appkit";
import { LuFlag, LuX } from "react-icons/lu";

import {
    FlagContentButtonFlagSummaryMutation,
} from "./__generated__/FlagContentButtonFlagSummaryMutation.graphql";
import {
    FlagContentButtonFlagQuizMutation,
} from "./__generated__/FlagContentButtonFlagQuizMutation.graphql";
import { COLORS } from "../color";

const flagSummaryMutation = graphql`
  mutation FlagContentButtonFlagSummaryMutation(
    $eventId: ID!,
    $language: String!,
    $reason: String,
  ) {
    flagAiSummary(eventId: $eventId, language: $language, reason: $reason) {
      flagged
      flagCount
    }
  }
`;

const flagQuizMutation = graphql`
  mutation FlagContentButtonFlagQuizMutation(
    $eventId: ID!,
    $language: String!,
    $reason: String,
  ) {
    flagAiQuiz(eventId: $eventId, language: $language, reason: $reason) {
      flagged
      flagCount
    }
  }
`;

type Props = {
    eventId: string;
    language: string;
    contentType: "summary" | "quiz";
    flagged?: boolean;
};

export const FlagContentButton: React.FC<Props> = ({
    eventId,
    language,
    contentType,
    flagged,
}) => {
    const { t } = useTranslation();
    const [showDialog, setShowDialog] = useState(false);
    const [reason, setReason] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [commitSummaryMutation] = useMutation<FlagContentButtonFlagSummaryMutation>(
        flagSummaryMutation,
    );
    const [commitQuizMutation] = useMutation<FlagContentButtonFlagQuizMutation>(
        flagQuizMutation,
    );

    const handleFlag = () => {
        if (flagged) {
            return; // Already flagged
        }
        setShowDialog(true);
    };

    const handleSubmit = () => {
        setIsSubmitting(true);

        const mutation = contentType === "summary" ? commitSummaryMutation : commitQuizMutation;

        mutation({
            variables: {
                eventId,
                language,
                reason: reason.trim() || null,
            },
            onCompleted: () => {
                setIsSubmitting(false);
                setShowDialog(false);
                setReason("");
            },
            onError: error => {
                setIsSubmitting(false);
                console.error("Failed to flag content:", error);
                alert(t("video.ai-content.flag-error", "Failed to report content. Please try again."));
            },
        });
    };

    const handleCancel = () => {
        setShowDialog(false);
        setReason("");
    };

    if (flagged) {
        return (
            <div css={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.85rem",
                color: COLORS.danger0,
                backgroundColor: COLORS.danger1,
                padding: "4px 10px",
                borderRadius: 4,
                fontWeight: 500,
            }} title={t(
                "video.ai-content.flagged-tooltip",
                "This content has been flagged for review",
            )}>
                <LuFlag size={14} />
                {t("video.ai-content.flagged", "Flagged")}
            </div>
        );
    }

    return (
        <>
            <Button
                kind="normal"
                onClick={handleFlag}
                css={{
                    fontSize: "0.85rem",
                    padding: "4px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                }}
                title={t(
                    "video.ai-content.flag-tooltip",
                    "Report an issue with this content",
                )}
            >
                <LuFlag size={14} />
                {t("video.ai-content.flag-button", "Report")}
            </Button>

            {showDialog && (
                <div css={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                }} onClick={handleCancel}>
                    <div css={{
                        backgroundColor: COLORS.neutral05,
                        borderRadius: 8,
                        padding: "24px",
                        maxWidth: "500px",
                        width: "90%",
                        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    }} onClick={e => e.stopPropagation()}>
                        <div css={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "16px",
                        }}>
                            <h3 css={{ margin: 0, fontSize: "1.2rem" }}>
                                {t("video.ai-content.flag-dialog-title", "Report Content Issue")}
                            </h3>
                            <button
                                onClick={handleCancel}
                                css={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    color: COLORS.neutral60,
                                    "&:hover": {
                                        color: COLORS.neutral90,
                                    },
                                }}
                            >
                                <LuX size={20} />
                            </button>
                        </div>

                        <p css={{ marginBottom: "16px", lineHeight: 1.5 }}>
                            {t(
                                "video.ai-content.flag-dialog-description",
                                "Help us improve by reporting issues with AI-generated content. "
                                + "Your report will be reviewed by administrators.",
                            )}
                        </p>

                        <div css={{ marginBottom: "16px" }}>
                            <label
                                htmlFor="flag-reason"
                                css={{
                                    display: "block",
                                    marginBottom: "8px",
                                    fontWeight: 500,
                                }}
                            >
                                {t(
                                    "video.ai-content.flag-reason-label",
                                    "Describe the issue (optional):",
                                )}
                            </label>
                            <textarea
                                id="flag-reason"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder={t(
                                    "video.ai-content.flag-reason-placeholder",
                                    "e.g., Contains inaccurate information, inappropriate content, etc.",
                                )}
                                css={{
                                    width: "100%",
                                    minHeight: "100px",
                                    padding: "8px",
                                    borderRadius: 4,
                                    border: `1px solid ${COLORS.neutral25}`,
                                    fontFamily: "inherit",
                                    fontSize: "0.95rem",
                                    resize: "vertical",
                                    "&:focus": {
                                        outline: `2px solid ${COLORS.primary0}`,
                                        outlineOffset: "1px",
                                    },
                                }}
                            />
                        </div>

                        <div css={{
                            display: "flex",
                            gap: "12px",
                            justifyContent: "flex-end",
                        }}>
                            <Button
                                kind="normal"
                                onClick={handleCancel}
                                disabled={isSubmitting}
                            >
                                {t("video.ai-content.flag-cancel", "Cancel")}
                            </Button>
                            <Button
                                kind="danger"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? t("video.ai-content.flag-submitting", "Reporting...")
                                    : t("video.ai-content.flag-submit", "Report Issue")
                                }
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
