import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  listClientNotes,
  updateClientNote,
} from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";
import {
  assertSameOrigin,
  consumeAdminRateLimit,
  createSecurityAuditEvent,
} from "@/shared/security/admin-actions";

export const runtime = "nodejs";

const clientNoteSchema = z.object({
  clientKey: z.string().trim().min(1).max(255),
  content: z.string().max(2000),
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notes = await listClientNotes();

  return NextResponse.json({ notes });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    consumeAdminRateLimit(user.id, "save_client_note");

    const payload = clientNoteSchema.parse(await request.json());
    const note = await updateClientNote({
      clientKey: payload.clientKey,
      content: payload.content,
      userId: user.id,
    });

    await createSecurityAuditEvent("support_client_note_updated", {
      actorId: user.id,
      clientKey: payload.clientKey,
      contentLength: payload.content.trim().length,
    });

    return NextResponse.json({ note });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not save client note";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
