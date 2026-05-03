import type { QueryResultRow } from "pg";

import {
  defaultSupportSettings,
  supportSettingsKey,
  type SupportSettings,
} from "@/modules/support/settings";
import { query } from "@/shared/lib/postgres";

type SupportSettingsRow = QueryResultRow & {
  value: Partial<SupportSettings>;
};

const normalizePositiveInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
};

const normalizeText = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;

export const normalizeSupportSettings = (
  value: Partial<SupportSettings>,
): SupportSettings => ({
  queueCriticalMinutes: normalizePositiveInteger(
    value.queueCriticalMinutes,
    defaultSupportSettings.queueCriticalMinutes,
    1,
    240,
  ),
  staleTicketMinutes: normalizePositiveInteger(
    value.staleTicketMinutes,
    defaultSupportSettings.staleTicketMinutes,
    1,
    240,
  ),
  urgentUnansweredMinutes: normalizePositiveInteger(
    value.urgentUnansweredMinutes,
    defaultSupportSettings.urgentUnansweredMinutes,
    1,
    480,
  ),
  feedbackExpirationMinutes: normalizePositiveInteger(
    value.feedbackExpirationMinutes,
    defaultSupportSettings.feedbackExpirationMinutes,
    1,
    10_080,
  ),
  lowFeedbackScore: normalizePositiveInteger(
    value.lowFeedbackScore,
    defaultSupportSettings.lowFeedbackScore,
    1,
    5,
  ),
  openingMessage: normalizeText(
    value.openingMessage,
    defaultSupportSettings.openingMessage,
  ),
  finishMessage: normalizeText(
    value.finishMessage,
    defaultSupportSettings.finishMessage,
  ),
  feedbackCommentPromptMessage: normalizeText(
    value.feedbackCommentPromptMessage,
    defaultSupportSettings.feedbackCommentPromptMessage,
  ),
  feedbackThanksMessage: normalizeText(
    value.feedbackThanksMessage,
    defaultSupportSettings.feedbackThanksMessage,
  ),
});

export const getSupportSettings = async (): Promise<SupportSettings> => {
  const rows = await query<SupportSettingsRow>(
    `
      select value
      from public.support_settings
      where key = $1
      limit 1
    `,
    [supportSettingsKey],
  );

  return normalizeSupportSettings(rows[0]?.value ?? defaultSupportSettings);
};

export const updateSupportSettings = async (
  value: Partial<SupportSettings>,
): Promise<SupportSettings> => {
  const settings = normalizeSupportSettings(value);
  const rows = await query<SupportSettingsRow>(
    `
      insert into public.support_settings (key, value)
      values ($1, $2::jsonb)
      on conflict (key)
      do update set value = excluded.value
      returning value
    `,
    [supportSettingsKey, JSON.stringify(settings)],
  );

  return normalizeSupportSettings(rows[0]?.value ?? settings);
};
