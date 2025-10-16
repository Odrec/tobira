import React from "react";
import { useFragment, graphql } from "react-relay/hooks";
import { useTranslation } from "react-i18next";
import { LuSparkles, LuCheck, LuPencil } from "react-icons/lu";

import { AiSummary$key } from "./__generated__/AiSummary.graphql";
import { COLORS } from "../color";
import { FlagContentButton } from "./FlagContentButton";

const fragment = graphql`
  fragment AiSummary on AiSummary {
    eventId
    language
    summary
    model
    createdAt
    processingTimeMs
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
  fragmentRef: AiSummary$key;
};

export const AiSummary: React.FC<Props> = ({ fragmentRef }) => {
    const { t } = useTranslation();
    const data = useFragment(fragment, fragmentRef);

    if (!data) {
        return null;
    }

    return (
        <div css={{
            padding: "20px 22px",
            marginTop: "16px",
            backgroundColor: COLORS.neutral10,
            borderRadius: 8,
        }}>
            <div css={{
                display: "flex",
                alignItems: "center",
                marginBottom: "1rem",
                gap: "0.5rem",
                justifyContent: "space-between",
            }}>
                <div css={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <LuSparkles size={24} />
                    <h3 css={{ margin: 0 }}>
                        {t("video.ai-summary.title", "AI-Generated Summary")}
                    </h3>
                </div>
                <div css={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                }}>
                    <FlagContentButton
                        eventId={data.eventId}
                        language={data.language}
                        contentType="summary"
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
                                    "video.ai-summary.edited-by",
                                    "Edited by {{user}}",
                                    { user: data.lastEditedBy },
                                )
                                : t("video.ai-summary.edited", "Edited by human")
                        }>
                            <LuPencil size={14} />
                            {t("video.ai-summary.human-edited", "Edited")}
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
                                    "video.ai-summary.approved-by",
                                    "Approved by {{user}}",
                                    { user: data.approvedBy },
                                )
                                : t("video.ai-summary.approved", "Approved by admin")
                        }>
                            <LuCheck size={14} />
                            {t("video.ai-summary.approved-badge", "Approved")}
                        </div>
                    )}
                    <div css={{
                        fontSize: "0.85rem",
                        color: COLORS.neutral40,
                        fontWeight: 500,
                    }}>
                        {data.language.toUpperCase()}
                    </div>
                </div>
            </div>

            <div css={{
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
            }}>
                {data.summary}
            </div>

            <div css={{
                marginTop: "1rem",
                fontSize: "0.85rem",
                color: COLORS.neutral40,
                fontStyle: "italic",
            }}>
                {t("video.ai-summary.generated-by", "Generated by")} {data.model}
            </div>
        </div>
    );
};
