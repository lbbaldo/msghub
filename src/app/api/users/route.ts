import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  createSupportUser,
  getCurrentUser,
  listSupportUsers,
} from "@/shared/auth/service";
import { supportUserRoles } from "@/shared/auth/types";
import {
  assertAdmin,
  assertSameOrigin,
  assertSupervisorOrAdmin,
  consumeAdminRateLimit,
  createSecurityAuditEvent,
} from "@/shared/security/admin-actions";

export const runtime = "nodejs";

const createUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  role: z.enum(supportUserRoles),
  password: z.string().min(8),
  whatsappPhone: z.string().trim().min(8).nullable(),
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSupervisorOrAdmin(user);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await listSupportUsers();

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    assertAdmin(user);
    consumeAdminRateLimit(user.id, "create_user");

    const payload = createUserSchema.parse(await request.json());
    const createdUser = await createSupportUser(payload);

    await createSecurityAuditEvent("support_user_created", {
      actorId: user.id,
      targetUserId: createdUser.id,
      role: createdUser.role,
    });

    return NextResponse.json({ user: createdUser });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not create user";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
