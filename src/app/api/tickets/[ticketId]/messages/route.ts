import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  sendAttendantAudioMessage,
  sendAttendantMessage,
} from "@/modules/support/services/support-service";
import { getCurrentUser } from "@/shared/auth/service";

export const runtime = "nodejs";

const sendMessageSchema = z.object({
  content: z.string().trim().min(1),
});

const maxAudioBytes = 10 * 1024 * 1024;

const parseAudioBase64 = async (request: NextRequest): Promise<string | null> => {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return null;
  }

  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof File)) {
    throw new Error("Audio file is required");
  }

  if (!audio.type.startsWith("audio/")) {
    throw new Error(`Unsupported audio type: ${audio.type || "unknown"}`);
  }

  if (audio.size > maxAudioBytes) {
    throw new Error("Audio file is larger than 10 MB");
  }

  const audioBuffer = Buffer.from(await audio.arrayBuffer());

  return audioBuffer.toString("base64");
};

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/tickets/[ticketId]/messages">,
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await context.params;
  try {
    const audioBase64 = await parseAudioBase64(request);

    if (audioBase64) {
      const message = await sendAttendantAudioMessage({
        ticketId,
        audioBase64,
        attendantId: user.id,
      });

      return NextResponse.json({ message });
    }

    const body = sendMessageSchema.parse(await request.json());
    const message = await sendAttendantMessage({
      ticketId,
      content: body.content,
      attendantId: user.id,
      attendantName: user.name,
    });

    return NextResponse.json({ message });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error ? caughtError.message : "Could not send message";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
