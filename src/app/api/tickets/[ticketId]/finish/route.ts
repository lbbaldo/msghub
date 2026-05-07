import { NextResponse } from "next/server";
import { z } from "zod";

import { finishTicket } from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

const finishTicketSchema = z.object({
  category: z.enum([
    "financeiro",
    "suporte",
    "pedido",
    "cadastro",
    "cardapio",
    "outro",
  ]),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/tickets/[ticketId]/finish">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await context.params;
  try {
    const body = finishTicketSchema.parse(await request.json());
    const ticket = await finishTicket({
      ticketId,
      category: body.category,
    });

    return NextResponse.json({ ticket });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not finish ticket";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
