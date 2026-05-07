import { NextResponse } from "next/server";

import { getSupportMessageMedia } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/tickets/[ticketId]/messages/[messageId]/media">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId, messageId } = await context.params;

  try {
    const media = await getSupportMessageMedia(ticketId, messageId);
    const mediaBuffer = Buffer.from(media.base64, "base64");

    return new Response(mediaBuffer, {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": media.mimetype,
      },
    });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not load media";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
