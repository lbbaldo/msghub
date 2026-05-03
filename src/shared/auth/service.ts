import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import type { QueryResultRow } from "pg";

import type {
  CurrentUser,
  SupportUserRole,
  SupportUserSummary,
} from "@/shared/auth/types";
import { getAuthEnv } from "@/shared/config/env";
import { query } from "@/shared/lib/postgres";

type UserRow = QueryResultRow & {
  id: string;
  name: string;
  email: string;
  role: SupportUserRole;
  whatsapp_phone: string | null;
  password_hash: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type SessionPayload = {
  userId: string;
  expiresAt: number;
};

type CreateSupportUserInput = {
  name: string;
  email: string;
  role: SupportUserRole;
  password: string;
  whatsappPhone: string | null;
};

type UpdateSupportUserInput = {
  whatsappPhone: string | null;
  active: boolean;
};

export const sessionCookieName = "hubaiq_session";

const sessionMaxAgeSeconds = 60 * 60 * 12;
const passwordHashKeyLength = 64;

const toBase64Url = (value: string | Buffer): string =>
  Buffer.from(value).toString("base64url");

const fromBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const sign = (payload: string): string =>
  createHmac("sha256", getAuthEnv().sessionSecret).update(payload).digest("base64url");

const createPasswordHash = (password: string): string => {
  const salt = randomBytes(16).toString("base64url");
  const key = scryptSync(password, salt, passwordHashKeyLength).toString("base64url");

  return `scrypt$${salt}$${key}`;
};

const verifyPassword = (password: string, passwordHash: string): boolean => {
  const [algorithm, salt, storedKey] = passwordHash.split("$");

  if (algorithm !== "scrypt" || !salt || !storedKey) {
    throw new Error("Unsupported password hash format");
  }

  const storedBuffer = Buffer.from(storedKey, "base64url");
  const candidate = scryptSync(password, salt, storedBuffer.length);

  return (
    storedBuffer.length === candidate.length &&
    timingSafeEqual(storedBuffer, candidate)
  );
};

const mapUser = (row: UserRow): CurrentUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
});

const mapUserSummary = (row: UserRow): SupportUserSummary => ({
  ...mapUser(row),
  whatsappPhone: row.whatsapp_phone,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const findUserByEmail = async (email: string): Promise<UserRow | null> => {
  const rows = await query<UserRow>(
    `
      select *
      from public.support_users
      where lower(email) = lower($1)
      limit 1
    `,
    [email],
  );

  return rows[0] ?? null;
};

const findUserById = async (userId: string): Promise<UserRow | null> => {
  const rows = await query<UserRow>(
    `
      select *
      from public.support_users
      where id = $1
        and active = true
      limit 1
    `,
    [userId],
  );

  return rows[0] ?? null;
};

export const ensureDefaultAdminUser = async (): Promise<void> => {
  const existingRows = await query<{ count: string }>(
    "select count(*)::text as count from public.support_users",
  );

  if (existingRows[0]?.count !== "0") {
    return;
  }

  const env = getAuthEnv();

  await query(
    `
      insert into public.support_users (name, email, role, password_hash)
      values ($1, $2, 'admin', $3)
    `,
    [
      env.defaultAdminName,
      env.defaultAdminEmail,
      createPasswordHash(env.defaultAdminPassword),
    ],
  );
};

export const authenticateUser = async (
  email: string,
  password: string,
): Promise<CurrentUser> => {
  await ensureDefaultAdminUser();

  const user = await findUserByEmail(email);

  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    throw new Error("E-mail ou senha inválidos");
  }

  return mapUser(user);
};

export const createSessionToken = (userId: string): string => {
  const payload: SessionPayload = {
    userId,
    expiresAt: Date.now() + sessionMaxAgeSeconds * 1000,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
};

const verifySessionToken = (token: string): SessionPayload | null => {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;

  if (!payload.userId || payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
};

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return null;
  }

  const payload = verifySessionToken(token);

  if (!payload) {
    return null;
  }

  const user = await findUserById(payload.userId);

  return user ? mapUser(user) : null;
};

export const requireCurrentUser = async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
};

export const listSupportUsers = async (): Promise<SupportUserSummary[]> => {
  const rows = await query<UserRow>(
    `
      select
        id,
        name,
        email,
        role,
        whatsapp_phone,
        password_hash,
        active,
        created_at,
        updated_at
      from public.support_users
      order by active desc, name asc
    `,
  );

  return rows.map(mapUserSummary);
};

export const createSupportUser = async (
  input: CreateSupportUserInput,
): Promise<SupportUserSummary> => {
  const rows = await query<UserRow>(
    `
      insert into public.support_users (
        name,
        email,
        role,
        password_hash,
        whatsapp_phone
      )
      values ($1, $2, $3, $4, $5)
      returning *
    `,
    [
      input.name.trim(),
      input.email.trim().toLowerCase(),
      input.role,
      createPasswordHash(input.password),
      input.whatsappPhone,
    ],
  );

  const user = rows[0];

  if (!user) {
    throw new Error("Created user was not returned by the database");
  }

  return mapUserSummary(user);
};

export const updateSupportUser = async (
  userId: string,
  input: UpdateSupportUserInput,
): Promise<SupportUserSummary> => {
  const rows = await query<UserRow>(
    `
      update public.support_users
      set whatsapp_phone = $2,
          active = $3
      where id = $1
      returning *
    `,
    [userId, input.whatsappPhone, input.active],
  );

  const user = rows[0];

  if (!user) {
    throw new Error(`Support user ${userId} was not found for update`);
  }

  return mapUserSummary(user);
};

export const resetSupportUserPassword = async (
  userId: string,
  password: string,
): Promise<SupportUserSummary> => {
  const rows = await query<UserRow>(
    `
      update public.support_users
      set password_hash = $2
      where id = $1
      returning *
    `,
    [userId, createPasswordHash(password)],
  );

  const user = rows[0];

  if (!user) {
    throw new Error(`Support user ${userId} was not found for password reset`);
  }

  return mapUserSummary(user);
};

export const transferOpenTickets = async (
  fromUserId: string,
  toUserId: string,
): Promise<number> => {
  const rows = await query<{ transferred_count: string }>(
    `
      with updated_tickets as (
        update public.support_tickets
        set assigned_to = $2
        where assigned_to = $1
          and status <> 'finalizado'
        returning id
      )
      select count(*)::text as transferred_count
      from updated_tickets
    `,
    [fromUserId, toUserId],
  );

  return Number(rows[0]?.transferred_count ?? 0);
};

export const getSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: sessionMaxAgeSeconds,
});
