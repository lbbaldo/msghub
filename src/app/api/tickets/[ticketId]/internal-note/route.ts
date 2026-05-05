import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { updateTicketInternalNote } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";
import {
  assertSameOrigin,
  consumeAdminRateLimit,
  createSecurityAuditEvent,
} from "@/shared/security/admin-actions";

export const runtime = "nodejs";

const internalNoteSchema = z.object({
  content: z.string().max(2000),
});

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/tickets/[ticketId]/internal-note">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    consumeAdminRateLimit(user.id, "save_ticket_internal_note");

    const { ticketId } = await context.params;
    const payload = internalNoteSchema.parse(await request.json());
    const ticket = await updateTicketInternalNote({
      ticketId,
      content: payload.content,
      userId: user.id,
    });

    await createSecurityAuditEvent("support_ticket_internal_note_updated", {
      actorId: user.id,
      ticketId,
      contentLength: payload.content.trim().length,
    });

    return NextResponse.json({ ticket });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not save note";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
