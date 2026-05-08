import { NextResponse } from "next/server";

import { sendRestaurantRegistrationMessage } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/tickets/[ticketId]/restaurant-registration">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await context.params;

  try {
    const message = await sendRestaurantRegistrationMessage(ticketId);

    return NextResponse.json({ message });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Could not send restaurant registration message";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
