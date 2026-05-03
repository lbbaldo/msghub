import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  getSupportSettings,
  updateSupportSettings,
} from "@/modules/support/services/settings-service";
import { getCurrentUser } from "@/shared/auth/service";
import { getEvolutionEnv, getSupportEnv, getWebhookEnv } from "@/shared/config/env";
import {
  assertAdmin,
  assertSameOrigin,
  assertSupervisorOrAdmin,
  consumeAdminRateLimit,
  createSecurityAuditEvent,
} from "@/shared/security/admin-actions";

export const runtime = "nodejs";

const settingsSchema = z.object({
  queueCriticalMinutes: z.number().int().min(1).max(240),
  staleTicketMinutes: z.number().int().min(1).max(240),
  urgentUnansweredMinutes: z.number().int().min(1).max(480),
  feedbackExpirationMinutes: z.number().int().min(1).max(10080),
  lowFeedbackScore: z.number().int().min(1).max(5),
  openingMessage: z.string().trim().min(1).max(1000),
  finishMessage: z.string().trim().min(1).max(1000),
  feedbackCommentPromptMessage: z.string().trim().min(1).max(1000),
  feedbackThanksMessage: z.string().trim().min(1).max(1000),
});

const getRuntimeSettings = () => {
  const evolutionEnv = getEvolutionEnv();
  const supportEnv = getSupportEnv();
  const webhookEnv = getWebhookEnv();

  return {
    evolutionApiUrl: evolutionEnv.evolutionApiUrl,
    evolutionInstanceName: evolutionEnv.evolutionInstanceName,
    webhookConfigured: Boolean(webhookEnv.webhookApiKey),
    attendantWhatsappNumber: supportEnv.attendantWhatsappNumber,
    attendantGroupJid: supportEnv.attendantGroupJid,
  };
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSupervisorOrAdmin(user);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getSupportSettings();

  return NextResponse.json({
    settings,
    runtime: getRuntimeSettings(),
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    assertAdmin(user);
    consumeAdminRateLimit(user.id, "update_settings");

    const payload = settingsSchema.parse(await request.json());
    const settings = await updateSupportSettings(payload);

    await createSecurityAuditEvent("support_settings_updated", {
      actorId: user.id,
      settings,
    });

    return NextResponse.json({ settings, runtime: getRuntimeSettings() });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not update settings";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
