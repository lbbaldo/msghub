import type { PoolClient, QueryResultRow } from "pg";

import type {
  MessageKind,
  SupportClientNote,
  SupportContact,
  SupportMessage,
  SupportTicket,
  TicketFinishCategory,
  TicketStatus,
  TicketWithMessages,
} from "@/modules/support/types";
import { ticketFinishCategories } from "@/modules/support/types";
import {
  mapClientNoteRow,
  mapContactRow,
  mapMessageRow,
  mapTicketRow,
} from "@/modules/support/services/mappers";
import type { EvolutionInboundMessage } from "@/modules/support/services/evolution-webhook";
import {
  getEvolutionMediaBase64,
  resolveEvolutionContactPhone,
  sendEvolutionTextMessage,
  sendEvolutionWhatsAppAudio,
} from "@/modules/support/services/evolution";
import { getSupportSettings } from "@/modules/support/services/settings-service";
import { getSupportEnv } from "@/shared/config/env";
import { query, withTransaction } from "@/shared/lib/postgres";

type TicketRow = Parameters<typeof mapTicketRow>[0] & QueryResultRow;
type MessageRow = Parameters<typeof mapMessageRow>[0] & QueryResultRow;
type ClientNoteRow = Parameters<typeof mapClientNoteRow>[0] & QueryResultRow;
type ContactRow = Parameters<typeof mapContactRow>[0] & QueryResultRow;

type AttendantSessionRow = {
  id: string;
  attendant_jid: string;
  attendant_phone: string | null;
  attendant_name: string | null;
  active_ticket_id: string | null;
  created_at: string;
  updated_at: string;
} & QueryResultRow;

type AttendantSession = {
  id: string;
  attendantJid: string;
  attendantPhone: string | null;
  attendantName: string | null;
  activeTicketId: string | null;
};

type SaveMessageParams = {
  ticketId: string;
  direction: SupportMessage["direction"];
  content: string;
  kind: MessageKind;
  sentBy: SupportMessage["sentBy"];
  attendantId: string | null;
  externalMessageId: string | null;
  fromMe: boolean;
  createdAt?: string;
  payload?: Record<string, unknown>;
};

type SavedMessageResult = {
  message: SupportMessage;
  created: boolean;
};

type SendAttendantMessageParams = {
  ticketId: string;
  content: string;
  attendantId: string;
  attendantName: string;
};

type StartConversationParams = {
  customerPhone: string;
  contactName: string | null;
  content: string;
  attendantId: string;
  attendantName: string;
};

type UpsertContactParams = {
  phone: string;
  name: string;
  businessName: string | null;
  userId: string;
};

type UpdateContactNameParams = {
  phone: string;
  name: string;
  businessName: string | null;
  userId: string;
};

type SendAttendantAudioMessageParams = {
  ticketId: string;
  audioBase64: string;
  attendantId: string;
};

type FinishTicketParams = {
  ticketId: string;
  category: TicketFinishCategory;
};

type SupportMessageMedia = {
  base64: string;
  mimetype: string;
};

type ProcessEvolutionResult =
  | {
      kind: "ticket_message";
      ticket: SupportTicket;
      message: SupportMessage;
    }
  | {
      kind: "attendant_command";
      message: string;
    }
  | {
      kind: "ignored";
      message: string;
    };

const openStatuses: TicketStatus[] = [
  "em_fila",
  "em_atendimento",
  "aguardando_feedback",
  "aguardando_feedback_comentario",
];

const finishCategoryLabels: Record<TicketFinishCategory, string> = {
  financeiro: "financeiro",
  suporte: "suporte",
  pedido: "pedido",
  cadastro: "cadastro",
  cardapio: "cardápio",
  outro: "outro",
};

const parseFinishCategory = (content: string): TicketFinishCategory | null => {
  const normalizedContent = content.trim().toLowerCase();

  return ticketFinishCategories.find((category) =>
    normalizedContent === `finalizar ${category}`,
  ) ?? null;
};

const attendantId = "atendente-whatsapp";
const botId = "hubaiq-bot";

const normalizePhone = (value: string): string => value.replace(/\D/gu, "");

const getConfiguredAttendantPhone = (): string | null => {
  const phone = getSupportEnv().attendantWhatsappNumber;

  return phone ? normalizePhone(phone) : null;
};

const getConfiguredAttendantGroupJid = (): string | null =>
  getSupportEnv().attendantGroupJid;

const isConfiguredAttendantPhone = (phone: string | null): boolean => {
  const attendantPhone = getConfiguredAttendantPhone();

  return Boolean(phone && attendantPhone && normalizePhone(phone) === attendantPhone);
};

const isConfiguredAttendantGroup = (chatJid: string): boolean => {
  const groupJid = getConfiguredAttendantGroupJid();

  return Boolean(groupJid && chatJid === groupJid);
};

const getTicketReference = (ticketId: string): string => ticketId.slice(0, 8);

const mapAttendantSessionRow = (
  row: AttendantSessionRow,
): AttendantSession => ({
  id: row.id,
  attendantJid: row.attendant_jid,
  attendantPhone: row.attendant_phone,
  attendantName: row.attendant_name,
  activeTicketId: row.active_ticket_id,
});

const canSendToCustomerPhone = (phone: string | null): phone is string =>
  Boolean(phone);

const getCustomerIdentifier = (ticket: SupportTicket): string =>
  ticket.customerPhone ?? ticket.customerLid ?? ticket.customerJid ?? "sem identificador";

const getCustomerPhoneForSend = (ticket: SupportTicket): string => {
  const phone = ticket.customerPhone;

  if (!canSendToCustomerPhone(phone)) {
    throw new Error(
      `Cannot send WhatsApp message because ticket ${ticket.id} has unresolved customer identity ${getCustomerIdentifier(ticket)}`,
    );
  }

  return phone;
};

const normalizeCustomerPhoneForStart = (phone: string): string => {
  const normalizedPhone = normalizePhone(phone);

  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
    throw new Error("Customer phone must include country code and area code");
  }

  return normalizedPhone;
};

const formatAttendantCustomerMessage = (
  attendantName: string,
  content: string,
): string => `*${attendantName.trim()}:*\n\n${content.trim()}`;

const buildTicketNotification = (
  ticket: SupportTicket,
  message: SupportMessage,
): string => {
  const customerName = ticket.contactName ?? "Sem nome";

  return [
    `Novo atendimento #${getTicketReference(ticket.id)}`,
    `Cliente: ${customerName}`,
    `Telefone: ${ticket.customerPhone ?? "não resolvido"}`,
    ticket.customerLid ? `LID: ${ticket.customerLid}` : null,
    "",
    message.content,
    "",
    `ASSUMIR ${getTicketReference(ticket.id)}`,
  ].filter((line): line is string => line !== null).join("\n");
};

const buildCustomerForwardMessage = (
  ticket: SupportTicket,
  message: SupportMessage,
): string =>
  [
    `Cliente respondeu no atendimento #${getTicketReference(ticket.id)}`,
    `Cliente: ${ticket.contactName ?? getCustomerIdentifier(ticket)}`,
    "",
    message.content,
  ].join("\n");

const sendAttendantNotification = async (
  ticket: SupportTicket,
  message: SupportMessage,
): Promise<void> => {
  const settings = await getSupportSettings();

  if (!settings.automaticBotMessagesEnabled) {
    await createAuditEvent("support_attendant_notification_skipped", {
      reason: "automatic bot messages are disabled",
      ticketId: ticket.id,
      messageId: message.id,
    });
    return;
  }

  const groupJid = getConfiguredAttendantGroupJid();

  if (groupJid) {
    await sendEvolutionTextMessage({
      phone: groupJid,
      message: buildTicketNotification(ticket, message),
    });
    return;
  }

  const phone = getConfiguredAttendantPhone();

  if (!phone) {
    await createAuditEvent("support_attendant_notification_skipped", {
      reason: "SUPPORT_ATTENDANT_GROUP_JID and SUPPORT_ATTENDANT_WHATSAPP_NUMBER are not configured",
      ticketId: ticket.id,
    });
    return;
  }

  await sendEvolutionTextMessage({
    phone,
    message: buildTicketNotification(ticket, message),
  });
};

const sendCustomerQueueConfirmation = async (
  ticket: SupportTicket,
): Promise<SupportMessage> => {
  const customerPhone = getCustomerPhoneForSend(ticket);
  const settings = await getSupportSettings();

  if (!settings.automaticBotMessagesEnabled) {
    throw new Error(
      `Cannot send queue confirmation for ticket ${ticket.id} because automatic bot messages are disabled`,
    );
  }

  const externalMessageId = await sendEvolutionTextMessage({
    phone: customerPhone,
    message: settings.openingMessage,
  });
  const now = new Date().toISOString();

  return withTransaction(async (client) => {
    const savedMessage = await saveMessage(client, {
      ticketId: ticket.id,
      direction: "enviada",
      content: settings.openingMessage,
      kind: "texto",
      sentBy: "bot",
      attendantId: botId,
      externalMessageId,
      fromMe: true,
      createdAt: now,
    });

    await updateTicketLastMessage(
      client,
      ticket.id,
      settings.openingMessage,
      now,
    );

    return savedMessage.message;
  });
};

const saveBotMessageIfEnabled = async (
  ticket: SupportTicket,
  content: string,
  auditEvent: string,
): Promise<SupportMessage | null> => {
  const settings = await getSupportSettings();

  if (!settings.automaticBotMessagesEnabled) {
    await createAuditEvent(auditEvent, {
      reason: "automatic bot messages are disabled",
      ticketId: ticket.id,
      contentLength: content.length,
    });
    return null;
  }

  return saveBotMessage(ticket, content);
};

const saveBotMessage = async (
  ticket: SupportTicket,
  content: string,
): Promise<SupportMessage> => {
  const customerPhone = getCustomerPhoneForSend(ticket);

  const externalMessageId = await sendEvolutionTextMessage({
    phone: customerPhone,
    message: content,
  });
  const now = new Date().toISOString();

  return withTransaction(async (client) => {
    const savedMessage = await saveMessage(client, {
      ticketId: ticket.id,
      direction: "enviada",
      content,
      kind: "texto",
      sentBy: "bot",
      attendantId: botId,
      externalMessageId,
      fromMe: true,
      createdAt: now,
    });

    await updateTicketLastMessage(client, ticket.id, content, now);

    return savedMessage.message;
  });
};

const assertRow = <T>(row: T | undefined, message: string): T => {
  if (!row) {
    throw new Error(message);
  }

  return row;
};

const assertPresent = <T>(
  value: T | null | undefined,
  message: string,
): T => {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value;
};

const queryWithClient = async <T extends QueryResultRow>(
  client: PoolClient,
  text: string,
  values: unknown[] = [],
): Promise<T[]> => {
  const result = await client.query<T>(text, values);

  return result.rows;
};

const upsertAttendantSession = async (
  client: PoolClient,
  params: {
    attendantJid: string;
    attendantPhone: string | null;
    attendantName: string | null;
    activeTicketId: string | null;
  },
): Promise<AttendantSession> => {
  const rows = await queryWithClient<AttendantSessionRow>(
    client,
    `
      insert into public.support_attendant_sessions (
        attendant_jid,
        attendant_phone,
        attendant_name,
        active_ticket_id
      )
      values ($1, $2, $3, $4)
      on conflict (attendant_jid)
      do update
      set attendant_phone = coalesce(excluded.attendant_phone, public.support_attendant_sessions.attendant_phone),
          attendant_name = coalesce(excluded.attendant_name, public.support_attendant_sessions.attendant_name),
          active_ticket_id = excluded.active_ticket_id
      returning *
    `,
    [
      params.attendantJid,
      params.attendantPhone,
      params.attendantName,
      params.activeTicketId,
    ],
  );

  return mapAttendantSessionRow(
    assertRow(rows[0], "Attendant session upsert returned no row"),
  );
};

const findActiveAttendantSession = async (
  attendantJid: string,
): Promise<AttendantSession | null> => {
  const rows = await query<AttendantSessionRow>(
    `
      select *
      from public.support_attendant_sessions
      where attendant_jid = $1
        and active_ticket_id is not null
      limit 1
    `,
    [attendantJid],
  );

  return rows[0] ? mapAttendantSessionRow(rows[0]) : null;
};

const clearAttendantSession = async (
  client: PoolClient,
  attendantJid: string,
): Promise<void> => {
  await queryWithClient(
    client,
    `
      update public.support_attendant_sessions
      set active_ticket_id = null
      where attendant_jid = $1
    `,
    [attendantJid],
  );
};

const findSessionByTicketId = async (
  ticketId: string,
): Promise<AttendantSession | null> => {
  const rows = await query<AttendantSessionRow>(
    `
      select *
      from public.support_attendant_sessions
      where active_ticket_id = $1
      limit 1
    `,
    [ticketId],
  );

  return rows[0] ? mapAttendantSessionRow(rows[0]) : null;
};

const markUnansweredTicketsAsUrgent = async (): Promise<void> => {
  const settings = await getSupportSettings();

  await query(
    `
      update public.support_tickets
      set priority = 'urgente'
      where status = any($1::public.support_ticket_status[])
        and first_response_at is null
        and created_at <= now() - ($2::int * interval '1 minute')
        and priority <> 'urgente'
    `,
    [["em_fila", "em_atendimento"], settings.urgentUnansweredMinutes],
  );
};

const closeExpiredFeedbackTickets = async (): Promise<void> => {
  const settings = await getSupportSettings();

  await query(
    `
      update public.support_tickets
      set status = 'finalizado',
          closed_at = coalesce(closed_at, now()),
          last_message = 'Feedback expirado',
          last_message_at = now()
      where status in ('aguardando_feedback', 'aguardando_feedback_comentario')
        and updated_at <= now() - ($1::int * interval '1 minute')
    `,
    [settings.feedbackExpirationMinutes],
  );
};

export const listTicketsWithMessages = async (
  activeTicketId?: string,
): Promise<TicketWithMessages> => {
  await markUnansweredTicketsAsUrgent();
  await closeExpiredFeedbackTickets();

  const ticketRows = await query<TicketRow>(
    `
      select *
      from public.support_tickets
      order by updated_at desc
    `,
  );
  const tickets = ticketRows.map(mapTicketRow);
  const contactRows = await query<ContactRow>(
    `
      select *
      from public.support_contacts
      order by updated_at desc
    `,
  );
  const contacts = contactRows.map(mapContactRow);
  const activeTicket = activeTicketId
    ? tickets.find((ticket) => ticket.id === activeTicketId) ?? tickets[0] ?? null
    : tickets[0] ?? null;

  if (!activeTicket) {
    return { tickets, contacts, activeTicket: null, messages: [] };
  }

  const messageRows = await query<MessageRow>(
    `
      select *
      from public.support_messages
      where ticket_id = $1
      order by created_at asc
    `,
    [activeTicket.id],
  );

  const messages = messageRows
    .map(mapMessageRow)
    .filter((message) => !isFeedbackCommentMessage(activeTicket, message));

  return {
    tickets,
    contacts,
    activeTicket,
    messages,
  };
};

export const upsertContact = async ({
  phone,
  name,
  businessName,
  userId,
}: UpsertContactParams): Promise<SupportContact> => {
  const normalizedPhone = normalizeCustomerPhoneForStart(phone);
  const normalizedName = name.trim();
  const normalizedBusinessName = businessName?.trim() || null;

  if (!normalizedName) {
    throw new Error("Contact name is required");
  }

  const rows = await query<ContactRow>(
    `
      insert into public.support_contacts (
        phone,
        name,
        business_name,
        created_by,
        updated_by
      )
      values ($1, $2, $3, $4, $4)
      on conflict (phone)
      do update
      set name = excluded.name,
          business_name = excluded.business_name,
          updated_by = excluded.updated_by
      returning *
    `,
    [normalizedPhone, normalizedName, normalizedBusinessName, userId],
  );

  await query(
    `
      update public.support_tickets
      set contact_name = $2
      where customer_phone = $1
    `,
    [normalizedPhone, normalizedName],
  );

  return mapContactRow(assertRow(rows[0], "Contact was not saved"));
};

export const updateContactName = async ({
  phone,
  name,
  businessName,
  userId,
}: UpdateContactNameParams): Promise<SupportContact> =>
  upsertContact({ phone, name, businessName, userId });

export const updateTicketInternalNote = async ({
  ticketId,
  content,
  userId,
}: {
  ticketId: string;
  content: string;
  userId: string;
}): Promise<SupportTicket> => {
  const normalizedContent = content.trim();
  const nextNote = normalizedContent || null;
  const nextUpdatedAt = nextNote ? new Date().toISOString() : null;

  const rows = await query<TicketRow>(
    `
      update public.support_tickets
      set internal_note = $2,
          internal_note_updated_at = $3
      where id = $1
      returning *
    `,
    [ticketId, nextNote, nextUpdatedAt],
  );
  const ticket = mapTicketRow(
    assertRow(rows[0], `Ticket ${ticketId} was not found for internal note update`),
  );

  await createAuditEvent("support_ticket_internal_note_saved", {
    actorId: userId,
    ticketId,
    contentLength: normalizedContent.length,
  });

  return ticket;
};

export const listClientNotes = async (): Promise<SupportClientNote[]> => {
  const rows = await query<ClientNoteRow>(
    `
      select *
      from public.support_client_notes
      order by updated_at desc
    `,
  );

  return rows.map(mapClientNoteRow);
};

export const updateClientNote = async ({
  clientKey,
  content,
  userId,
}: {
  clientKey: string;
  content: string;
  userId: string;
}): Promise<SupportClientNote | null> => {
  const normalizedClientKey = clientKey.trim();
  const normalizedContent = content.trim();

  if (!normalizedClientKey) {
    throw new Error("Client key is required to save a note");
  }

  if (!normalizedContent) {
    await query(
      `
        delete from public.support_client_notes
        where client_key = $1
      `,
      [normalizedClientKey],
    );
    await createAuditEvent("support_client_note_deleted", {
      actorId: userId,
      clientKey: normalizedClientKey,
    });

    return null;
  }

  const rows = await query<ClientNoteRow>(
    `
      insert into public.support_client_notes (
        client_key,
        note,
        created_by,
        updated_by
      )
      values ($1, $2, $3, $3)
      on conflict (client_key)
      do update
      set note = excluded.note,
          updated_by = excluded.updated_by
      returning *
    `,
    [normalizedClientKey, normalizedContent, userId],
  );
  const note = mapClientNoteRow(
    assertRow(rows[0], `Client note ${normalizedClientKey} was not saved`),
  );

  await createAuditEvent("support_client_note_saved", {
    actorId: userId,
    clientKey: normalizedClientKey,
    contentLength: normalizedContent.length,
  });

  return note;
};

export const resolveTicketContactPhone = async (
  ticketId: string,
): Promise<SupportTicket> => {
  const ticketRows = await query<TicketRow>(
    `
      select *
      from public.support_tickets
      where id = $1
      limit 1
    `,
    [ticketId],
  );
  const ticket = mapTicketRow(assertRow(ticketRows[0], `Ticket ${ticketId} was not found`));

  if (ticket.customerPhone) {
    return ticket;
  }

  const resolvedPhone = await resolveEvolutionContactPhone({
    customerJid: ticket.customerJid,
    customerLid: ticket.customerLid,
  });

  if (!resolvedPhone) {
    await createAuditEvent("support_contact_phone_not_resolved", {
      ticketId: ticket.id,
      customerJid: ticket.customerJid,
      customerLid: ticket.customerLid,
    });
    throw new Error("Ainda não foi possível resolver o telefone desse contato");
  }

  const updatedRows = await query<TicketRow>(
    `
      update public.support_tickets
      set customer_phone = $2,
          customer_jid = coalesce(customer_jid, $3)
      where id = $1
      returning *
    `,
    [ticket.id, resolvedPhone, ticket.customerJid],
  );

  await createAuditEvent("support_contact_phone_resolved", {
    ticketId: ticket.id,
    customerJid: ticket.customerJid,
    customerLid: ticket.customerLid,
    customerPhone: resolvedPhone,
  });

  return mapTicketRow(assertRow(updatedRows[0], "Updated resolved ticket was empty"));
};

const isSameTimestamp = (firstValue: string, secondValue: string): boolean =>
  new Date(firstValue).getTime() === new Date(secondValue).getTime();

const isFeedbackCommentMessage = (
  ticket: SupportTicket,
  message: SupportMessage,
): boolean =>
  Boolean(
    ticket.feedbackComment &&
      ticket.feedbackCommentReceivedAt &&
      message.direction === "recebida" &&
      message.sentBy === "cliente" &&
      message.content === ticket.feedbackComment &&
      isSameTimestamp(message.createdAt, ticket.feedbackCommentReceivedAt),
  );

const findOpenTicketByIdentity = async (
  client: PoolClient,
  inboundMessage: EvolutionInboundMessage,
): Promise<SupportTicket | null> => {
  const rows = await queryWithClient<TicketRow>(
    client,
    `
      select *
      from public.support_tickets
      where (
          ($1::text is not null and customer_phone = $1)
          or ($2::text is not null and customer_lid = $2)
          or ($3::text is not null and customer_jid = $3)
        )
        and status = any($4::public.support_ticket_status[])
      order by updated_at desc
      limit 1
    `,
    [
      inboundMessage.customerPhone,
      inboundMessage.customerLid,
      inboundMessage.customerJid,
      openStatuses,
    ],
  );

  return rows[0] ? mapTicketRow(rows[0]) : null;
};

const findOpenTicketByCustomerPhone = async (
  client: PoolClient,
  customerPhone: string,
): Promise<SupportTicket | null> => {
  const rows = await queryWithClient<TicketRow>(
    client,
    `
      select *
      from public.support_tickets
      where customer_phone = $1
        and status = any($2::public.support_ticket_status[])
      order by updated_at desc
      limit 1
    `,
    [customerPhone, openStatuses],
  );

  return rows[0] ? mapTicketRow(rows[0]) : null;
};

const createTicket = async (
  client: PoolClient,
  inboundMessage: EvolutionInboundMessage,
): Promise<SupportTicket> => {
  const rows = await queryWithClient<TicketRow>(
    client,
    `
      insert into public.support_tickets (
        customer_phone,
        customer_lid,
        customer_jid,
        contact_name,
        status,
        priority,
        last_message,
        last_message_at
      )
      values ($1, $2, $3, $4, 'em_fila', 'normal', $5, $6)
      returning *
    `,
    [
      inboundMessage.customerPhone,
      inboundMessage.customerLid,
      inboundMessage.customerJid,
      inboundMessage.contactName,
      inboundMessage.content,
      inboundMessage.timestamp,
    ],
  );

  return mapTicketRow(assertRow(rows[0], "Created ticket was empty"));
};

const updateTicketIdentity = async (
  client: PoolClient,
  ticket: SupportTicket,
  inboundMessage: EvolutionInboundMessage,
): Promise<SupportTicket> => {
  const nextCustomerPhone = ticket.customerPhone ?? inboundMessage.customerPhone;
  const nextCustomerLid = ticket.customerLid ?? inboundMessage.customerLid;
  const nextCustomerJid = inboundMessage.customerJid ?? ticket.customerJid;

  if (
    nextCustomerPhone === ticket.customerPhone &&
    nextCustomerLid === ticket.customerLid &&
    nextCustomerJid === ticket.customerJid
  ) {
    return ticket;
  }

  const rows = await queryWithClient<TicketRow>(
    client,
    `
      update public.support_tickets
      set customer_phone = $2,
          customer_lid = $3,
          customer_jid = $4
      where id = $1
      returning *
    `,
    [ticket.id, nextCustomerPhone, nextCustomerLid, nextCustomerJid],
  );

  return mapTicketRow(assertRow(rows[0], "Updated ticket identity was empty"));
};

const updateTicketLastMessage = async (
  client: PoolClient,
  ticketId: string,
  content: string,
  timestamp: string,
): Promise<void> => {
  await queryWithClient(
    client,
    `
      update public.support_tickets
      set last_message = $2,
          last_message_at = $3
      where id = $1
    `,
    [ticketId, content, timestamp],
  );
};

const findMessageByExternalId = async (
  client: PoolClient,
  externalMessageId: string,
): Promise<SupportMessage | null> => {
  const rows = await queryWithClient<MessageRow>(
    client,
    `
      select *
      from public.support_messages
      where external_message_id = $1
      limit 1
    `,
    [externalMessageId],
  );

  return rows[0] ? mapMessageRow(rows[0]) : null;
};

const hasCustomerQueueConfirmation = async (
  client: PoolClient,
  ticketId: string,
): Promise<boolean> => {
  const settings = await getSupportSettings();
  const rows = await queryWithClient(
    client,
    `
      select 1
      from public.support_messages
      where ticket_id = $1
        and sent_by = 'bot'
        and content = $2
      limit 1
    `,
    [ticketId, settings.openingMessage],
  );

  return Boolean(rows[0]);
};

const trySendCustomerQueueConfirmation = async (
  ticket: SupportTicket,
): Promise<void> => {
  const settings = await getSupportSettings();

  if (!settings.automaticBotMessagesEnabled) {
    await createAuditEvent("support_customer_confirmation_skipped", {
      reason: "automatic bot messages are disabled",
      ticketId: ticket.id,
    });
    return;
  }

  if (!canSendToCustomerPhone(ticket.customerPhone)) {
    await createAuditEvent("support_customer_confirmation_skipped", {
      reason: "customer phone is not resolved",
      ticketId: ticket.id,
      customerPhone: ticket.customerPhone,
      customerLid: ticket.customerLid,
      customerJid: ticket.customerJid,
    });
    return;
  }

  await sendCustomerQueueConfirmation(ticket);
};

const parseFeedbackScore = (content: string): number | null => {
  const match = /^\s*([1-5])\s*$/u.exec(content);

  return match ? Number(match[1]) : null;
};

const processFeedbackResponse = async (
  ticket: SupportTicket,
  inboundMessage: EvolutionInboundMessage,
): Promise<{ message: string }> => {
  const score = parseFeedbackScore(inboundMessage.content);

  if (!score) {
    const helpMessage = "Para avaliar o atendimento, responda apenas com uma nota de 1 a 5.";

    await saveBotMessageIfEnabled(
      ticket,
      helpMessage,
      "support_feedback_help_message_skipped",
    );

    return { message: helpMessage };
  }

  await withTransaction(async (client) => {
    await queryWithClient(
      client,
      `
        update public.support_tickets
        set status = 'aguardando_feedback_comentario',
            feedback_score = $2,
            feedback_received_at = $3,
            closed_at = null,
            last_message = 'Nota de feedback recebida',
            last_message_at = $3
        where id = $1
      `,
      [ticket.id, score, inboundMessage.timestamp],
    );
  });

  const settings = await getSupportSettings();

  await saveBotMessageIfEnabled(
    {
      ...ticket,
      status: "aguardando_feedback_comentario",
      feedbackScore: score,
      feedbackReceivedAt: inboundMessage.timestamp,
      closedAt: null,
    },
    settings.feedbackCommentPromptMessage,
    "support_feedback_comment_prompt_skipped",
  );

  return { message: settings.feedbackCommentPromptMessage };
};

const processFeedbackComment = async (
  ticket: SupportTicket,
  inboundMessage: EvolutionInboundMessage,
): Promise<{ message: string }> => {
  const settings = await getSupportSettings();

  await withTransaction(async (client) => {
    await queryWithClient(
      client,
      `
        update public.support_tickets
        set status = 'finalizado',
            feedback_comment = $2,
            feedback_comment_received_at = $3,
            closed_at = $3,
            last_message = 'Feedback escrito recebido',
            last_message_at = $3
        where id = $1
      `,
      [ticket.id, inboundMessage.content, inboundMessage.timestamp],
    );
  });

  await saveBotMessageIfEnabled(
    {
      ...ticket,
      status: "finalizado",
      feedbackComment: inboundMessage.content,
      feedbackCommentReceivedAt: inboundMessage.timestamp,
      closedAt: inboundMessage.timestamp,
    },
    settings.feedbackThanksMessage,
    "support_feedback_thanks_message_skipped",
  );

  return { message: settings.feedbackThanksMessage };
};

const saveMessage = async (
  client: PoolClient,
  params: SaveMessageParams,
): Promise<SavedMessageResult> => {
  const rows = await queryWithClient<MessageRow>(
    client,
    `
      insert into public.support_messages (
        ticket_id,
        direction,
        content,
        kind,
        sent_by,
        attendant_id,
        external_message_id,
        from_me,
        created_at,
        payload
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce($9::timestamptz, now()), $10::jsonb)
      on conflict (external_message_id)
      where external_message_id is not null
      do nothing
      returning *
    `,
    [
      params.ticketId,
      params.direction,
      params.content,
      params.kind,
      params.sentBy,
      params.attendantId,
      params.externalMessageId,
      params.fromMe,
      params.createdAt ?? null,
      JSON.stringify(params.payload ?? {}),
    ],
  );

  if (rows[0]) {
    return {
      message: mapMessageRow(rows[0]),
      created: true,
    };
  }

  if (!params.externalMessageId) {
    throw new Error("Created message was empty and no external id was available");
  }

  const existingMessage = await findMessageByExternalId(
    client,
    params.externalMessageId,
  );

  return {
    message: assertRow(existingMessage ?? undefined, "Existing message was not found"),
    created: false,
  };
};

const findTicketByReference = async (
  client: PoolClient,
  reference: string,
): Promise<SupportTicket> => {
  const normalizedReference = reference.trim();
  const rows = await queryWithClient<TicketRow>(
    client,
    `
      select *
      from public.support_tickets
      where id::text = $1
         or id::text like $2
      order by created_at desc
      limit 1
    `,
    [normalizedReference, `${normalizedReference}%`],
  );

  return mapTicketRow(assertRow(rows[0], `Ticket ${reference} was not found`));
};

const parseAttendantCommand = (
  content: string,
):
  | { command: "assumir"; ticketReference: string }
  | { command: "finalizar"; ticketReference: string }
  | { command: "responder"; ticketReference: string; message: string }
  | null => {
  const trimmedContent = content.trim();
  const match = /^(ASSUMIR|FINALIZAR|RESPONDER)\s+([a-f0-9-]{8,36})(?:\s+([\s\S]+))?$/iu.exec(
    trimmedContent,
  );

  if (!match) {
    return null;
  }

  const command = match[1]?.toLowerCase();
  const ticketReference = match[2] ?? "";
  const message = match[3]?.trim() ?? "";

  if (command === "assumir") {
    return { command: "assumir", ticketReference };
  }

  if (command === "finalizar") {
    return { command: "finalizar", ticketReference };
  }

  if (command === "responder" && message) {
    return { command: "responder", ticketReference, message };
  }

  return null;
};

const processAttendantCommand = async (
  inboundMessage: EvolutionInboundMessage,
): Promise<{ message: string }> => {
  const command = parseAttendantCommand(inboundMessage.content);

  if (!command) {
    const helpMessage = [
      "Comando não reconhecido.",
      "Use:",
      "ASSUMIR codigo",
      "RESPONDER codigo mensagem",
      "FINALIZAR codigo",
    ].join("\n");

    await sendEvolutionTextMessage({
      phone: assertPresent(
        inboundMessage.customerPhone,
        "Cannot reply to attendant command without sender phone",
      ),
      message: helpMessage,
    });

    return { message: helpMessage };
  }

  if (command.command === "assumir") {
    const ticket = await withTransaction(async (client) => {
      const foundTicket = await findTicketByReference(client, command.ticketReference);
      const rows = await queryWithClient<TicketRow>(
        client,
        `
          update public.support_tickets
          set assigned_to = $2,
              status = 'em_atendimento'
          where id = $1
          returning *
        `,
        [foundTicket.id, attendantId],
      );

      return mapTicketRow(assertRow(rows[0], "Assigned ticket was empty"));
    });
    const response = `Atendimento #${getTicketReference(ticket.id)} assumido.`;

    await sendEvolutionTextMessage({
      phone: assertPresent(
        inboundMessage.customerPhone,
        "Cannot confirm attendant command without sender phone",
      ),
      message: response,
    });

    return { message: response };
  }

  if (command.command === "finalizar") {
    const ticket = await withTransaction(async (client) => {
      const foundTicket = await findTicketByReference(client, command.ticketReference);
      const rows = await queryWithClient<TicketRow>(
        client,
        `
          update public.support_tickets
          set status = 'aguardando_feedback',
              closed_at = null
          where id = $1
          returning *
        `,
        [foundTicket.id],
      );

      return mapTicketRow(assertRow(rows[0], "Finished ticket was empty"));
    });

    const settings = await getSupportSettings();

    await saveBotMessageIfEnabled(
      ticket,
      settings.finishMessage,
      "support_finish_message_skipped",
    );

    const response = `Atendimento #${getTicketReference(ticket.id)} finalizado. Aguardando feedback do cliente.`;

    await sendEvolutionTextMessage({
      phone: assertPresent(
        inboundMessage.customerPhone,
        "Cannot confirm attendant command without sender phone",
      ),
      message: response,
    });

    return { message: response };
  }

  const ticket = await query<TicketRow>(
    `
      select *
      from public.support_tickets
      where id::text = $1
         or id::text like $2
      order by created_at desc
      limit 1
    `,
    [command.ticketReference, `${command.ticketReference}%`],
  ).then((rows) =>
    mapTicketRow(assertRow(rows[0], `Ticket ${command.ticketReference} was not found`)),
  );

  await sendAttendantMessage({
    ticketId: ticket.id,
    content: command.message,
    attendantId,
    attendantName: inboundMessage.senderName ?? "Atendente",
  });

  const response = `Resposta enviada no atendimento #${getTicketReference(ticket.id)}.`;

  await sendEvolutionTextMessage({
    phone: assertPresent(
      inboundMessage.customerPhone,
      "Cannot confirm attendant command without sender phone",
    ),
    message: response,
  });

  return { message: response };
};

const processGroupAttendantCommand = async (
  inboundMessage: EvolutionInboundMessage,
): Promise<{ message: string }> => {
  const command = parseAttendantCommand(inboundMessage.content);

  if (!command || command.command !== "assumir") {
    return { message: "Group message ignored" };
  }

  const attendantJid = inboundMessage.senderJid;
  const attendantPhone = inboundMessage.senderPhone;
  const activeSession = await findActiveAttendantSession(attendantJid);

  if (activeSession?.activeTicketId) {
    const message = `Você já está atendendo o #${getTicketReference(activeSession.activeTicketId)}. Finalize antes de assumir outro.`;

    await sendEvolutionTextMessage({
      phone: attendantPhone ?? inboundMessage.chatJid,
      message,
    });

    return { message: "Attendant already has an active ticket" };
  }

  const ticket = await withTransaction(async (client) => {
    const foundTicket = await findTicketByReference(client, command.ticketReference);

    if (foundTicket.status !== "em_fila") {
      throw new Error(
        `Cannot assign ticket ${foundTicket.id} because it is ${foundTicket.status}`,
      );
    }

    const rows = await queryWithClient<TicketRow>(
      client,
      `
        update public.support_tickets
        set assigned_to = $2,
            status = 'em_atendimento'
        where id = $1
        returning *
      `,
      [foundTicket.id, attendantJid],
    );
    const assignedTicket = mapTicketRow(
      assertRow(rows[0], "Assigned ticket was empty"),
    );

    await upsertAttendantSession(client, {
      attendantJid,
      attendantPhone,
      attendantName: inboundMessage.senderName,
      activeTicketId: assignedTicket.id,
    });

    return assignedTicket;
  });
  const privateMessage = [
    `Você assumiu o atendimento #${getTicketReference(ticket.id)}.`,
    `Cliente: ${ticket.contactName ?? getCustomerIdentifier(ticket)}`,
    "",
    "Agora é só responder aqui normalmente.",
    "Para finalizar, envie FINALIZAR.",
  ].join("\n");

  if (attendantPhone) {
    await sendEvolutionTextMessage({
      phone: attendantPhone,
      message: privateMessage,
    });
  }

  await sendEvolutionTextMessage({
    phone: inboundMessage.chatJid,
    message: attendantPhone
      ? `Atendimento #${getTicketReference(ticket.id)} assumido por ${inboundMessage.senderName ?? attendantPhone}.`
      : `Atendimento #${getTicketReference(ticket.id)} assumido por ${inboundMessage.senderName ?? attendantJid}. Envie qualquer mensagem no privado do bot para ativar o envio direto por lá.`,
  });

  return { message: privateMessage };
};

const processPrivateAttendantSession = async (
  inboundMessage: EvolutionInboundMessage,
): Promise<{ message: string }> => {
  const session = await findActiveAttendantSession(inboundMessage.senderJid);

  if (!session?.activeTicketId) {
    return { message: "No active attendant session" };
  }

  const attendantPhone = assertPresent(
    inboundMessage.senderPhone,
    "Cannot process attendant private session without sender phone",
  );

  await withTransaction(async (client) => {
    await upsertAttendantSession(client, {
      attendantJid: inboundMessage.senderJid,
      attendantPhone,
      attendantName: inboundMessage.senderName,
      activeTicketId: session.activeTicketId,
    });
  });

  const isFinishCommand = /^FINALIZAR(?:\s+\S+)?$/iu.test(inboundMessage.content.trim());

  if (isFinishCommand) {
    const category = parseFinishCategory(inboundMessage.content);

    if (!category) {
      await sendEvolutionTextMessage({
        phone: attendantPhone,
        message:
          "Informe a categoria para finalizar: FINALIZAR FINANCEIRO, FINALIZAR SUPORTE, FINALIZAR PEDIDO, FINALIZAR CADASTRO, FINALIZAR CARDAPIO ou FINALIZAR OUTRO.",
      });

      return {
        message: "Finish command requires category",
      };
    }

    const ticket = await finishTicket({
      ticketId: session.activeTicketId,
      category,
    });

    await withTransaction(async (client) => {
      await clearAttendantSession(client, inboundMessage.senderJid);
    });

    const response = `Atendimento #${getTicketReference(ticket.id)} finalizado como ${finishCategoryLabels[category]}. Aguardando feedback do cliente.`;

    await sendEvolutionTextMessage({
      phone: attendantPhone,
      message: response,
    });

    return { message: response };
  }

  await sendAttendantMessage({
    ticketId: session.activeTicketId,
    content: inboundMessage.content,
    attendantId: inboundMessage.senderJid,
    attendantName: inboundMessage.senderName ?? session.attendantName ?? "Atendente",
  });

  return { message: "Private attendant response forwarded to customer" };
};

const forwardCustomerMessageToAssignedAttendant = async (
  ticket: SupportTicket,
  message: SupportMessage,
): Promise<void> => {
  const settings = await getSupportSettings();

  if (!settings.automaticBotMessagesEnabled) {
    await createAuditEvent("support_customer_forward_skipped", {
      reason: "automatic bot messages are disabled",
      ticketId: ticket.id,
      messageId: message.id,
    });
    return;
  }

  if (ticket.status !== "em_atendimento") {
    return;
  }

  const session = await findSessionByTicketId(ticket.id);

  if (!session?.attendantPhone) {
    return;
  }

  await sendEvolutionTextMessage({
    phone: session.attendantPhone,
    message: buildCustomerForwardMessage(ticket, message),
  });
};

export const processEvolutionInboundMessage = async (
  inboundMessage: EvolutionInboundMessage,
): Promise<ProcessEvolutionResult> => {
  if (inboundMessage.isGroup) {
    if (inboundMessage.fromMe || !isConfiguredAttendantGroup(inboundMessage.chatJid)) {
      return {
        kind: "ignored",
        message: "Group message ignored",
      };
    }

    const result = await processGroupAttendantCommand(inboundMessage);

    return {
      kind: "attendant_command",
      message: result.message,
    };
  }

  if (inboundMessage.fromMe && isConfiguredAttendantPhone(inboundMessage.customerPhone)) {
    await createAuditEvent("support_attendant_outgoing_message_ignored", {
      externalMessageId: inboundMessage.externalMessageId,
      phone: inboundMessage.customerPhone,
    });

    return {
      kind: "ignored",
      message: "Outgoing attendant notification ignored",
    };
  }

  if (!inboundMessage.fromMe) {
    const session = await findActiveAttendantSession(inboundMessage.senderJid);

    if (session) {
      const result = await processPrivateAttendantSession(inboundMessage);

      return {
        kind: "attendant_command",
        message: result.message,
      };
    }
  }

  if (!inboundMessage.fromMe && isConfiguredAttendantPhone(inboundMessage.customerPhone)) {
    const result = await processAttendantCommand(inboundMessage);

    return {
      kind: "attendant_command",
      message: result.message,
    };
  }

  if (inboundMessage.fromMe && inboundMessage.externalMessageId) {
    const existingMessageRows = await query<MessageRow>(
      `
        select *
        from public.support_messages
        where external_message_id = $1
        limit 1
      `,
      [inboundMessage.externalMessageId],
    );

    if (existingMessageRows[0]) {
      return {
        kind: "ignored",
        message: "Duplicate outgoing message ignored",
      };
    }
  }

  const settings = await getSupportSettings();

  if (!settings.customerWebhookEnabled) {
    await createAuditEvent("support_customer_webhook_message_ignored", {
      reason: "customer webhook processing is disabled",
      externalMessageId: inboundMessage.externalMessageId,
      fromMe: inboundMessage.fromMe,
      customerPhone: inboundMessage.customerPhone,
      customerLid: inboundMessage.customerLid,
      customerJid: inboundMessage.customerJid,
      chatJid: inboundMessage.chatJid,
    });

    return {
      kind: "ignored",
      message: "Customer webhook processing is disabled",
    };
  }

  const result = await withTransaction(async (client) => {
    const existingTicket = await findOpenTicketByIdentity(client, inboundMessage);
    const ticketCreated = !existingTicket;
    const ticket = existingTicket
      ? await updateTicketIdentity(client, existingTicket, inboundMessage)
      : await createTicket(client, inboundMessage);

    if (!inboundMessage.fromMe && ticket.status === "aguardando_feedback") {
      return {
        ticket,
        message: null,
        messageCreated: false,
        shouldSendQueueConfirmation: false,
        shouldNotifyAttendants: false,
        shouldProcessFeedback: true,
        shouldProcessFeedbackComment: false,
      };
    }

    if (
      !inboundMessage.fromMe &&
      ticket.status === "aguardando_feedback_comentario"
    ) {
      return {
        ticket,
        message: null,
        messageCreated: false,
        shouldSendQueueConfirmation: false,
        shouldNotifyAttendants: false,
        shouldProcessFeedback: false,
        shouldProcessFeedbackComment: true,
      };
    }

    const queueConfirmationSent = await hasCustomerQueueConfirmation(
      client,
      ticket.id,
    );
    const direction = inboundMessage.fromMe ? "enviada" : "recebida";
    const sentBy = inboundMessage.fromMe ? "atendente" : "cliente";
    const attendantId = inboundMessage.fromMe ? "whatsapp-manual" : null;
    const savedMessage = await saveMessage(client, {
      ticketId: ticket.id,
      direction,
      content: inboundMessage.content,
      kind: inboundMessage.kind,
      sentBy,
      attendantId,
      externalMessageId: inboundMessage.externalMessageId,
      fromMe: inboundMessage.fromMe,
      createdAt: inboundMessage.timestamp,
      payload: inboundMessage.payload,
    });

    await updateTicketLastMessage(
      client,
      ticket.id,
      inboundMessage.content,
      inboundMessage.timestamp,
    );

    return {
      ticket,
      message: savedMessage.message,
      messageCreated: savedMessage.created,
      shouldSendQueueConfirmation:
        !inboundMessage.fromMe &&
        ticket.status === "em_fila" &&
        (ticketCreated || !queueConfirmationSent),
      shouldNotifyAttendants: ticketCreated,
      shouldProcessFeedback: false,
      shouldProcessFeedbackComment: false,
    };
  });

  if (result.shouldProcessFeedback) {
    const feedbackResult = await processFeedbackResponse(result.ticket, inboundMessage);

    return {
      kind: "ignored",
      message: feedbackResult.message,
    };
  }

  if (result.shouldProcessFeedbackComment) {
    const feedbackResult = await processFeedbackComment(result.ticket, inboundMessage);

    return {
      kind: "ignored",
      message: feedbackResult.message,
    };
  }

  const savedMessage = assertRow(
    result.message ?? undefined,
    "Processed ticket message was empty",
  );

  if (!inboundMessage.fromMe && result.messageCreated) {
    if (result.shouldSendQueueConfirmation) {
      await trySendCustomerQueueConfirmation(result.ticket);
    }

    if (result.ticket.status === "em_atendimento") {
      await forwardCustomerMessageToAssignedAttendant(result.ticket, savedMessage);
    } else if (result.shouldNotifyAttendants) {
      await sendAttendantNotification(result.ticket, savedMessage);
    }
  }

  return {
    kind: "ticket_message",
    ticket: result.ticket,
    message: savedMessage,
  };
};

export const assignTicket = async (
  ticketId: string,
  attendantId: string,
): Promise<SupportTicket> => {
  const ticketRows = await query<TicketRow>(
    `
      select *
      from public.support_tickets
      where id = $1
      limit 1
    `,
    [ticketId],
  );
  const ticket = mapTicketRow(
    assertRow(ticketRows[0], "Ticket was not found for assignment"),
  );

  if (ticket.status === "em_atendimento") {
    return ticket;
  }

  if (ticket.status !== "em_fila") {
    throw new Error(
      `Cannot assign ticket ${ticketId} because it is ${ticket.status}`,
    );
  }

  const rows = await query<TicketRow>(
    `
      update public.support_tickets
      set assigned_to = $2,
          status = 'em_atendimento'
      where id = $1
      returning *
    `,
    [ticketId, attendantId],
  );

  return mapTicketRow(assertRow(rows[0], "Ticket was not found for assignment"));
};

export const finishTicket = async ({
  ticketId,
  category,
}: FinishTicketParams): Promise<SupportTicket> => {
  const ticketRows = await query<TicketRow>(
    `
      select *
      from public.support_tickets
      where id = $1
      limit 1
    `,
    [ticketId],
  );
  const currentTicket = mapTicketRow(
    assertRow(ticketRows[0], "Ticket was not found for finish"),
  );

  if (currentTicket.status !== "em_atendimento") {
    throw new Error(
      `Cannot finish ticket ${ticketId} because it is ${currentTicket.status}`,
    );
  }

  const currentCustomerPhone = getCustomerPhoneForSend(currentTicket);

  const rows = await query<TicketRow>(
    `
      update public.support_tickets
      set status = 'aguardando_feedback',
          category = $2,
          closed_at = null
      where id = $1
      returning *
    `,
    [ticketId, category],
  );

  const ticket = mapTicketRow(assertRow(rows[0], "Ticket was not found for finish"));

  const settings = await getSupportSettings();

  await saveBotMessageIfEnabled(
    { ...ticket, customerPhone: currentCustomerPhone },
    settings.finishMessage,
    "support_finish_message_skipped",
  );
  await query(
    `
      update public.support_attendant_sessions
      set active_ticket_id = null
      where active_ticket_id = $1
    `,
    [ticketId],
  );

  return ticket;
};

export const sendAttendantMessage = async ({
  ticketId,
  content,
  attendantId,
  attendantName,
}: SendAttendantMessageParams): Promise<SupportMessage> => {
  const ticketRows = await query<TicketRow>(
    `
      select *
      from public.support_tickets
      where id = $1
      limit 1
    `,
    [ticketId],
  );
  const ticket = mapTicketRow(assertRow(ticketRows[0], "Ticket was not found"));

  if (ticket.status !== "em_atendimento") {
    throw new Error(
      `Cannot send message to ticket ${ticketId} because it is ${ticket.status}`,
    );
  }

  const customerPhone = getCustomerPhoneForSend(ticket);
  const customerMessage = formatAttendantCustomerMessage(attendantName, content);

  const externalMessageId = await sendEvolutionTextMessage({
    phone: customerPhone,
    message: customerMessage,
  });
  const now = new Date().toISOString();

  return withTransaction(async (client) => {
    const savedMessage = await saveMessage(client, {
      ticketId,
      direction: "enviada",
      content,
      kind: "texto",
      sentBy: "atendente",
      attendantId,
      externalMessageId,
      fromMe: true,
      createdAt: now,
    });
    const firstResponseAt = ticket.firstResponseAt ?? now;

    await queryWithClient(
      client,
      `
        update public.support_tickets
        set last_message = $2,
            last_message_at = $3,
            first_response_at = $4,
            status = $5,
            assigned_to = $6
        where id = $1
      `,
      [
        ticketId,
        content,
        now,
        firstResponseAt,
        ticket.status === "em_fila" ? "em_atendimento" : ticket.status,
        ticket.assignedTo ?? attendantId,
      ],
    );

    return savedMessage.message;
  });
};

export const sendRestaurantRegistrationMessage = async (
  ticketId: string,
): Promise<SupportMessage> => {
  const ticketRows = await query<TicketRow>(
    `
      select *
      from public.support_tickets
      where id = $1
      limit 1
    `,
    [ticketId],
  );
  const ticket = mapTicketRow(assertRow(ticketRows[0], "Ticket was not found"));

  if (ticket.status !== "em_atendimento") {
    throw new Error(
      `Cannot send restaurant registration message to ticket ${ticketId} because it is ${ticket.status}`,
    );
  }

  const settings = await getSupportSettings();

  return saveBotMessage(ticket, settings.restaurantRegistrationMessage);
};

export const startConversation = async ({
  customerPhone,
  contactName,
  content,
  attendantId,
  attendantName,
}: StartConversationParams): Promise<{ ticket: SupportTicket; message: SupportMessage }> => {
  const normalizedPhone = normalizeCustomerPhoneForStart(customerPhone);
  const trimmedContent = content.trim();
  const trimmedContactName = contactName?.trim() || null;
  const customerMessage = formatAttendantCustomerMessage(attendantName, trimmedContent);
  const externalMessageId = await sendEvolutionTextMessage({
    phone: normalizedPhone,
    message: customerMessage,
  });
  const now = new Date().toISOString();

  return withTransaction(async (client) => {
    if (trimmedContactName) {
      await queryWithClient(
        client,
        `
          insert into public.support_contacts (
            phone,
            name,
            created_by,
            updated_by
          )
          values ($1, $2, $3, $3)
          on conflict (phone)
          do update
          set name = excluded.name,
              updated_by = excluded.updated_by
        `,
        [normalizedPhone, trimmedContactName, attendantId],
      );
    }

    const existingTicket = await findOpenTicketByCustomerPhone(client, normalizedPhone);
    const ticket = existingTicket
      ? existingTicket
      : mapTicketRow(
          assertRow(
            (
              await queryWithClient<TicketRow>(
                client,
                `
                  insert into public.support_tickets (
                    customer_phone,
                    contact_name,
                    status,
                    assigned_to,
                    priority,
                    last_message,
                    last_message_at,
                    first_response_at
                  )
                  values ($1, $2, 'em_atendimento', $3, 'normal', $4, $5, $5)
                  returning *
                `,
                [
                  normalizedPhone,
                  trimmedContactName,
                  attendantId,
                  trimmedContent,
                  now,
                ],
              )
            )[0],
            "Created ticket was empty",
          ),
        );

    const savedMessage = await saveMessage(client, {
      ticketId: ticket.id,
      direction: "enviada",
      content: trimmedContent,
      kind: "texto",
      sentBy: "atendente",
      attendantId,
      externalMessageId,
      fromMe: true,
      createdAt: now,
    });
    const updatedRows = await queryWithClient<TicketRow>(
      client,
      `
        update public.support_tickets
        set contact_name = coalesce($2, contact_name),
            assigned_to = $3,
            status = 'em_atendimento',
            last_message = $4,
            last_message_at = $5,
            first_response_at = coalesce(first_response_at, $5)
        where id = $1
        returning *
      `,
      [ticket.id, trimmedContactName, attendantId, trimmedContent, now],
    );

    return {
      ticket: mapTicketRow(assertRow(updatedRows[0], "Updated ticket was empty")),
      message: savedMessage.message,
    };
  });
};

export const sendAttendantAudioMessage = async ({
  ticketId,
  audioBase64,
  attendantId,
}: SendAttendantAudioMessageParams): Promise<SupportMessage> => {
  const ticketRows = await query<TicketRow>(
    `
      select *
      from public.support_tickets
      where id = $1
      limit 1
    `,
    [ticketId],
  );
  const ticket = mapTicketRow(assertRow(ticketRows[0], "Ticket was not found"));

  if (ticket.status !== "em_atendimento") {
    throw new Error(
      `Cannot send audio message to ticket ${ticketId} because it is ${ticket.status}`,
    );
  }

  const customerPhone = getCustomerPhoneForSend(ticket);
  const externalMessageId = await sendEvolutionWhatsAppAudio({
    phone: customerPhone,
    audioBase64,
  });
  const now = new Date().toISOString();
  const content = "Áudio enviado";

  return withTransaction(async (client) => {
    const savedMessage = await saveMessage(client, {
      ticketId,
      direction: "enviada",
      content,
      kind: "audio",
      sentBy: "atendente",
      attendantId,
      externalMessageId,
      fromMe: true,
      createdAt: now,
    });
    const firstResponseAt = ticket.firstResponseAt ?? now;

    await queryWithClient(
      client,
      `
        update public.support_tickets
        set last_message = $2,
            last_message_at = $3,
            first_response_at = $4,
            status = $5,
            assigned_to = $6
        where id = $1
      `,
      [
        ticketId,
        content,
        now,
        firstResponseAt,
        ticket.status === "em_fila" ? "em_atendimento" : ticket.status,
        ticket.assignedTo ?? attendantId,
      ],
    );

    return savedMessage.message;
  });
};

export const getSupportMessageMedia = async (
  ticketId: string,
  messageId: string,
): Promise<SupportMessageMedia> => {
  const messageRows = await query<MessageRow>(
    `
      select *
      from public.support_messages
      where id = $1
        and ticket_id = $2
      limit 1
    `,
    [messageId, ticketId],
  );
  const message = mapMessageRow(assertRow(messageRows[0], "Message was not found"));

  if (message.kind !== "audio") {
    throw new Error(`Message ${messageId} is not an audio message`);
  }

  if (!message.externalMessageId) {
    throw new Error(`Audio message ${messageId} does not have an external id`);
  }

  return getEvolutionMediaBase64(message.externalMessageId);
};

export const createAuditEvent = async (
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
