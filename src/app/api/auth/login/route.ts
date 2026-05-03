import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  authenticateUser,
  createSessionToken,
  getSessionCookieOptions,
  sessionCookieName,
} from "@/shared/auth/service";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = loginSchema.parse(await request.json());
  const user = await authenticateUser(body.email, body.password);
  const response = NextResponse.json({ user });

  response.cookies.set(
    sessionCookieName,
    createSessionToken(user.id),
    getSessionCookieOptions(),
  );

  return response;
}
