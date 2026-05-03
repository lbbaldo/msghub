import { NextResponse, type NextRequest } from "next/server";

import { listTicketsWithMessages } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticketId = request.nextUrl.searchParams.get("ticketId") ?? undefined;
  const data = await listTicketsWithMessages(ticketId);

  return NextResponse.json(data);
}
