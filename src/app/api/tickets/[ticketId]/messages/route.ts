import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { sendAttendantMessage } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

const sendMessageSchema = z.object({
  content: z.string().trim().min(1),
});

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/tickets/[ticketId]/messages">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await context.params;
  try {
    const body = sendMessageSchema.parse(await request.json());
    const message = await sendAttendantMessage({
      ticketId,
      content: body.content,
      attendantId: user.id,
      attendantName: user.name,
    });

    return NextResponse.json({ message });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not send message";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
