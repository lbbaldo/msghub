import { NextResponse } from "next/server";

import { finishTicket } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/tickets/[ticketId]/finish">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await context.params;
  try {
    const ticket = await finishTicket(ticketId);

    return NextResponse.json({ ticket });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not finish ticket";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
