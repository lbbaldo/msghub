import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser, updateSupportUser } from "@/shared/auth/service";
import {
  assertAdmin,
  assertSameOrigin,
  consumeAdminRateLimit,
  createSecurityAuditEvent,
} from "@/shared/security/admin-actions";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  whatsappPhone: z.string().trim().min(8).nullable(),
  active: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/users/[userId]">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    assertAdmin(user);
    consumeAdminRateLimit(user.id, "update_user");

    const { userId } = await context.params;
    const payload = updateUserSchema.parse(await request.json());
    const updatedUser = await updateSupportUser(userId, payload);

    await createSecurityAuditEvent("support_user_updated", {
      actorId: user.id,
      targetUserId: updatedUser.id,
      active: updatedUser.active,
      whatsappLinked: Boolean(updatedUser.whatsappPhone),
    });

    return NextResponse.json({ user: updatedUser });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not update user";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
