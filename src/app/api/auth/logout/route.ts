import { NextResponse } from "next/server";

import { getSessionCookieOptions, sessionCookieName } from "@/shared/auth/service";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(sessionCookieName, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });

  return response;
}
