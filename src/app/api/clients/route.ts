import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  updateContactName,
  upsertContact,
} from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

const contactSchema = z.object({
  phone: z.string().trim().min(10),
  name: z.string().trim().min(1).max(160),
  businessName: z.string().trim().max(160).optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = contactSchema.parse(await request.json());
    const contact = await upsertContact({
      phone: body.phone,
      name: body.name,
      businessName: body.businessName || null,
      userId: user.id,
    });

    return NextResponse.json({ contact });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not save client";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = contactSchema.parse(await request.json());
    const contact = await updateContactName({
      phone: body.phone,
      name: body.name,
      businessName: body.businessName || null,
      userId: user.id,
    });

    return NextResponse.json({ contact });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not update client";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
