import type { NextRequest } from "next/server";

import type { CurrentUser } from "@/shared/auth/types";
import { query } from "@/shared/lib/postgres";

type RateLimitEntry = {
  count: number;
  resetsAt: number;
};

const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 20;
const rateLimits = new Map<string, RateLimitEntry>();

export const assertSameOrigin = (request: NextRequest): void => {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    throw new Error("Missing same-origin headers");
  }

  if (new URL(origin).host !== host) {
    throw new Error("Invalid request origin");
  }
};

export const assertAdmin = (user: CurrentUser): void => {
  if (user.role !== "admin") {
    throw new Error("Admin permission required");
  }
};

export const assertSupervisorOrAdmin = (user: CurrentUser): void => {
  if (user.role !== "admin" && user.role !== "supervisor") {
    throw new Error("Supervisor permission required");
  }
};

export const consumeAdminRateLimit = (userId: string, action: string): void => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const currentEntry = rateLimits.get(key);

  if (!currentEntry || currentEntry.resetsAt <= now) {
    rateLimits.set(key, { count: 1, resetsAt: now + rateLimitWindowMs });
    return;
  }

  if (currentEntry.count >= rateLimitMaxRequests) {
    throw new Error("Too many administrative requests");
  }

  rateLimits.set(key, {
    count: currentEntry.count + 1,
    resetsAt: currentEntry.resetsAt,
  });
};

export const createSecurityAuditEvent = async (
  event: string,
  metadata: Record<string, unknown>,
): Promise<void> => {
  await query(
    `
      insert into public.support_audit_events (event, metadata)
      values ($1, $2::jsonb)
    `,
    [event, JSON.stringify(metadata)],
  );
};
