import { NextResponse } from "next/server";

import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({ user });
}
