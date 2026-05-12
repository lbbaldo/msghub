import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  listTicketsWithMessages,
  startConversation,
} from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

const startConversationSchema = z.object({
  customerPhone: z.string().trim().min(10),
  contactName: z.string().trim().optional(),
  content: z.string().trim().min(1),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticketId = request.nextUrl.searchParams.get("ticketId") ?? undefined;
  const data = await listTicketsWithMessages({
    activeTicketId: ticketId,
    currentUser: user,
  });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = startConversationSchema.parse(await request.json());
    const result = await startConversation({
      customerPhone: body.customerPhone,
      contactName: body.contactName ?? null,
      content: body.content,
      attendantId: user.id,
      attendantName: user.name,
    });

    return NextResponse.json(result);
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not start conversation";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
