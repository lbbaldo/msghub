import { z } from "zod";

import type { MessageKind } from "@/modules/support/types";

const webhookSchema = z.record(z.string(), z.unknown());

export type EvolutionInboundMessage = {
  externalMessageId: string | null;
  customerPhone: string | null;
  customerLid: string | null;
  customerJid: string;
  chatJid: string;
  isGroup: boolean;
  senderJid: string;
  senderPhone: string | null;
  senderName: string | null;
  contactName: string | null;
  content: string;
  kind: MessageKind;
  fromMe: boolean;
  timestamp: string;
  payload: Record<string, unknown>;
};

const readRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];

  return typeof value === "string" && value.trim() !== "" ? value : null;
};

const readBoolean = (
  record: Record<string, unknown>,
  key: string,
): boolean | null => {
  const value = record[key];

  return typeof value === "boolean" ? value : null;
};

const normalizePhone = (value: string): string => {
  const digits = value
    .replace(/@s\.whatsapp\.net$|@c\.us$|@g\.us$|@lid$/u, "")
    .replace(/\D/gu, "");

  return digits;
};

const normalizeLid = (value: string): string | null => {
  if (!value.endsWith("@lid") && !value.startsWith("lid:")) {
    return null;
  }

  const digits = normalizePhone(value);

  return digits ? `lid:${digits}` : null;
};

const readRemoteJids = (
  key: Record<string, unknown> | null,
  data: Record<string, unknown>,
): { remoteJid: string | null; remoteJidAlt: string | null } => {
  const remoteJid =
    (key ? readString(key, "remoteJid") : null) ??
    readString(data, "remoteJid") ??
    readString(data, "from") ??
    readString(data, "sender");
  const remoteJidAlt =
    (key ? readString(key, "remoteJidAlt") : null) ??
    readString(data, "remoteJidAlt");

  return { remoteJid, remoteJidAlt };
};

const readParticipantJid = (
  key: Record<string, unknown> | null,
  data: Record<string, unknown>,
): string | null =>
  (key ? readString(key, "participant") : null) ??
  readString(data, "participant") ??
  readString(data, "senderJid");

const getPhoneFromJid = (jid: string | null): string | null => {
  if (!jid || jid.endsWith("@lid") || jid.endsWith("@g.us")) {
    return null;
  }

  const phone = normalizePhone(jid);

  return phone || null;
};

const getCustomerIdentity = (
  remoteJid: string,
  remoteJidAlt: string | null,
): { customerPhone: string | null; customerLid: string | null; customerJid: string } => {
  const customerPhone = getPhoneFromJid(remoteJid) ?? getPhoneFromJid(remoteJidAlt);
  const customerLid = normalizeLid(remoteJid) ?? normalizeLid(remoteJidAlt ?? "");

  return {
    customerPhone,
    customerLid,
    customerJid: remoteJid,
  };
};

const getSenderIdentity = (
  remoteJid: string,
  remoteJidAlt: string | null,
  participantJid: string | null,
): { senderJid: string; senderPhone: string | null } => {
  const senderJid = participantJid ?? remoteJid;
  const senderPhone = getPhoneFromJid(participantJid) ?? getPhoneFromJid(remoteJid) ?? getPhoneFromJid(remoteJidAlt);

  return { senderJid, senderPhone };
};

const getNestedRecord = (
  record: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | null =>
  keys.reduce<Record<string, unknown> | null>((current, key) => {
    if (!current) {
      return null;
    }

    return readRecord(current[key]);
  }, record);

const getMessageContent = (
  data: Record<string, unknown>,
  message: Record<string, unknown> | null,
): string => {
  const directText =
    readString(data, "text") ??
    readString(data, "body") ??
    readString(data, "message") ??
    readString(data, "caption");

  if (directText) {
    return directText;
  }

  const conversation = message ? readString(message, "conversation") : null;

  if (conversation) {
    return conversation;
  }

  const extendedText = message
    ? getNestedRecord(message, ["extendedTextMessage"])
    : null;
  const extendedTextContent = extendedText ? readString(extendedText, "text") : null;

  if (extendedTextContent) {
    return extendedTextContent;
  }

  const image = message ? getNestedRecord(message, ["imageMessage"]) : null;
  const imageCaption = image ? readString(image, "caption") : null;

  if (imageCaption) {
    return imageCaption;
  }

  return "[mensagem sem texto]";
};

const getMessageKind = (message: Record<string, unknown> | null): MessageKind => {
  if (!message) {
    return "texto";
  }

  if (message.imageMessage) {
    return "imagem";
  }

  if (message.audioMessage) {
    return "audio";
  }

  if (message.documentMessage) {
    return "documento";
  }

  if (message.videoMessage) {
    return "video";
  }

  if (message.stickerMessage) {
    return "sticker";
  }

  return "texto";
};

const getTimestamp = (data: Record<string, unknown>): string => {
  const rawTimestamp = data.messageTimestamp ?? data.timestamp;

  if (typeof rawTimestamp === "number") {
    const milliseconds = rawTimestamp > 9_999_999_999 ? rawTimestamp : rawTimestamp * 1000;

    return new Date(milliseconds).toISOString();
  }

  if (typeof rawTimestamp === "string" && rawTimestamp.trim() !== "") {
    const parsed = new Date(rawTimestamp);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
};

export const parseEvolutionWebhook = (
  payload: unknown,
): EvolutionInboundMessage => {
  const root = webhookSchema.parse(payload);
  const data = readRecord(root.data) ?? root;
  const key = readRecord(data.key);
  const message = readRecord(data.message);
  const { remoteJid, remoteJidAlt } = readRemoteJids(key, data);
  const participantJid = readParticipantJid(key, data);

  if (!remoteJid) {
    throw new Error("Evolution webhook payload does not include sender phone");
  }

  const isGroup = remoteJid.endsWith("@g.us");
  const customerIdentity = getCustomerIdentity(remoteJid, remoteJidAlt);
  const senderIdentity = getSenderIdentity(remoteJid, remoteJidAlt, participantJid);

  if (!isGroup && !customerIdentity.customerPhone && !customerIdentity.customerLid) {
    throw new Error(`Evolution webhook sender identity is invalid: ${remoteJid}`);
  }

  return {
    externalMessageId: key ? readString(key, "id") : readString(data, "id"),
    ...customerIdentity,
    chatJid: remoteJid,
    isGroup,
    ...senderIdentity,
    senderName: readString(data, "pushName") ?? readString(data, "senderName"),
    contactName: readString(data, "pushName") ?? readString(data, "senderName"),
    content: getMessageContent(data, message),
    kind: getMessageKind(message),
    fromMe: (key ? readBoolean(key, "fromMe") : null) ?? false,
    timestamp: getTimestamp(data),
    payload: root,
  };
};
