import { NextResponse, type NextRequest } from "next/server";

import { parseEvolutionWebhook } from "@/modules/support/services/evolution-webhook";
import {
  createAuditEvent,
  processEvolutionInboundMessage,
} from "@/modules/support/services/support-service";
import { getWebhookEnv } from "@/shared/config/env";

export const runtime = "nodejs";

const getClientAddress = (request: NextRequest): string | null =>
  request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");

export async function POST(request: NextRequest) {
  const providedApiKey = request.headers.get("x-api-key");
  const expectedApiKey = getWebhookEnv().webhookApiKey;

  if (providedApiKey !== expectedApiKey) {
    await createAuditEvent("invalid_evolution_webhook_token", {
      clientAddress: getClientAddress(request),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ error: "Unauthorized webhook request" }, { status: 401 });
  }

  const payload = await request.json();
  const inboundMessage = parseEvolutionWebhook(payload);
  const result = await processEvolutionInboundMessage(inboundMessage);

  if (result.kind === "attendant_command" || result.kind === "ignored") {
    return NextResponse.json({
      kind: result.kind,
      message: result.message,
    });
  }

  return NextResponse.json({
    kind: result.kind,
    ticketId: result.ticket.id,
    messageId: result.message.id,
  });
}
