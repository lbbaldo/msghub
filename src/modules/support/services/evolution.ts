import { getEvolutionEnv } from "@/shared/config/env";

type EvolutionSendTextParams = {
  phone: string;
  message: string;
};

type EvolutionSendResponse = {
  key?: {
    id?: string;
  };
  message?: unknown;
};

type EvolutionResolveContactParams = {
  customerJid: string | null;
  customerLid: string | null;
};

const joinUrl = (baseUrl: string, path: string): string =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

const readRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];

  return typeof value === "string" && value.trim() !== "" ? value : null;
};

const normalizePhone = (value: string): string =>
  value
    .replace(/@s\.whatsapp\.net$|@c\.us$|@g\.us$|@lid$/u, "")
    .replace(/\D/gu, "");

const normalizeLidJid = (customerLid: string | null): string | null => {
  if (!customerLid) {
    return null;
  }

  const digits = normalizePhone(customerLid);

  return digits ? `${digits}@lid` : null;
};

const getPhoneFromJid = (jid: string | null): string | null => {
  if (!jid || jid.endsWith("@lid") || jid.endsWith("@g.us")) {
    return null;
  }

  const phone = normalizePhone(jid);

  return phone || null;
};

const findPhoneInMessageLikeRecord = (value: unknown): string | null => {
  const record = readRecord(value);

  if (!record) {
    return null;
  }

  const key = readRecord(record.key);
  const directPhone =
    getPhoneFromJid(readString(record, "remoteJidAlt")) ??
    getPhoneFromJid(readString(record, "remoteJid")) ??
    getPhoneFromJid(key ? readString(key, "remoteJidAlt") : null) ??
    getPhoneFromJid(key ? readString(key, "remoteJid") : null);

  if (directPhone) {
    return directPhone;
  }

  return findPhoneInMessageLikeRecord(record.lastMessage);
};

const evolutionPostJson = async <T,>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> => {
  const env = getEvolutionEnv();
  const url = joinUrl(env.evolutionApiUrl, path);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.evolutionApiKey,
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Evolution request failed with status ${response.status}: ${responseText}`,
    );
  }

  return (responseText.trim() ? JSON.parse(responseText) : null) as T;
};

const findPhoneFromEvolutionChats = async (customerJid: string): Promise<string | null> => {
  const env = getEvolutionEnv();
  const chats = await evolutionPostJson<unknown[]>(
    `/chat/findChats/${env.evolutionInstanceName}`,
    { where: { remoteJid: customerJid } },
  );

  return chats.reduce<string | null>(
    (resolvedPhone, chat) => resolvedPhone ?? findPhoneInMessageLikeRecord(chat),
    null,
  );
};

const findPhoneFromEvolutionMessages = async (
  customerJid: string,
): Promise<string | null> => {
  const env = getEvolutionEnv();
  const response = await evolutionPostJson<unknown>(
    `/chat/findMessages/${env.evolutionInstanceName}`,
    { where: { key: { remoteJid: customerJid } }, page: 1, offset: 20 },
  );
  const responseRecord = readRecord(response);
  const messagesRecord = responseRecord ? readRecord(responseRecord.messages) : null;
  const records = messagesRecord?.records;

  if (!Array.isArray(records)) {
    throw new Error("Evolution findMessages response did not include message records");
  }

  return records.reduce<string | null>(
    (resolvedPhone, message) =>
      resolvedPhone ?? findPhoneInMessageLikeRecord(message),
    null,
  );
};

export const resolveEvolutionContactPhone = async ({
  customerJid,
  customerLid,
}: EvolutionResolveContactParams): Promise<string | null> => {
  const jid = customerJid ?? normalizeLidJid(customerLid);

  if (!jid) {
    throw new Error("Cannot resolve contact without customer JID or LID");
  }

  const phoneFromChat = await findPhoneFromEvolutionChats(jid);

  if (phoneFromChat) {
    return phoneFromChat;
  }

  return findPhoneFromEvolutionMessages(jid);
};

export const sendEvolutionTextMessage = async ({
  phone,
  message,
}: EvolutionSendTextParams): Promise<string | null> => {
  const env = getEvolutionEnv();
  const url = joinUrl(
    env.evolutionApiUrl,
    `/message/sendText/${env.evolutionInstanceName}`,
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.evolutionApiKey,
    },
    body: JSON.stringify({
      number: phone,
      text: message,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Evolution sendText failed with status ${response.status}: ${responseText}`,
    );
  }

  if (responseText.trim() === "") {
    return null;
  }

  const data = JSON.parse(responseText) as EvolutionSendResponse;

  return data.key?.id ?? null;
};
