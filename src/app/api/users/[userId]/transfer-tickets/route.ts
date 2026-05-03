import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser, transferOpenTickets } from "@/shared/auth/service";
import {
  assertSameOrigin,
  assertSupervisorOrAdmin,
  consumeAdminRateLimit,
  createSecurityAuditEvent,
} from "@/shared/security/admin-actions";

export const runtime = "nodejs";

const transferTicketsSchema = z.object({
  toUserId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/users/[userId]/transfer-tickets">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    assertSupervisorOrAdmin(user);
    consumeAdminRateLimit(user.id, "transfer_user_tickets");

    const { userId } = await context.params;
    const payload = transferTicketsSchema.parse(await request.json());
    const transferredCount = await transferOpenTickets(userId, payload.toUserId);

    await createSecurityAuditEvent("support_user_tickets_transferred", {
      actorId: user.id,
      fromUserId: userId,
      toUserId: payload.toUserId,
      transferredCount,
    });

    return NextResponse.json({ transferredCount });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not transfer tickets";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
