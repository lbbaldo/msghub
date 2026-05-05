import { NextResponse, type NextRequest } from "next/server";

import { resolveTicketContactPhone } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: RouteContext<"/api/tickets/[ticketId]/resolve-contact">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await context.params;

  try {
    const ticket = await resolveTicketContactPhone(ticketId);

    return NextResponse.json({ ticket });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Could not resolve ticket contact";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
