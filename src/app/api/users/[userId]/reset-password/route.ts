import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser, resetSupportUserPassword } from "@/shared/auth/service";
import {
  assertAdmin,
  assertSameOrigin,
  consumeAdminRateLimit,
  createSecurityAuditEvent,
} from "@/shared/security/admin-actions";

export const runtime = "nodejs";

const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/users/[userId]/reset-password">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    assertAdmin(user);
    consumeAdminRateLimit(user.id, "reset_user_password");

    const { userId } = await context.params;
    const payload = resetPasswordSchema.parse(await request.json());
    const updatedUser = await resetSupportUserPassword(userId, payload.password);

    await createSecurityAuditEvent("support_user_password_reset", {
      actorId: user.id,
      targetUserId: updatedUser.id,
    });

    return NextResponse.json({ user: updatedUser });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not reset password";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
