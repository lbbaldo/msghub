import { NextResponse, type NextRequest } from "next/server";

import { assignTicket } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: RouteContext<"/api/tickets/[ticketId]/assign">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await context.params;
  try {
    const ticket = await assignTicket(ticketId, user.id);

    return NextResponse.json({ ticket });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not assign ticket";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
