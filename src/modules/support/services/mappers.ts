import type {
  SupportClientNote,
  SupportMessage,
  SupportTicket,
} from "@/modules/support/types";

type TicketRow = {
  id: string;
  customer_phone: string | null;
  customer_lid: string | null;
  customer_jid: string | null;
  contact_name: string | null;
  status: SupportTicket["status"];
  assigned_to: string | null;
  category: SupportTicket["category"];
  priority: SupportTicket["priority"];
  last_message: string | null;
  last_message_at: string | null;
  first_response_at: string | null;
  feedback_score: number | null;
  feedback_received_at: string | null;
  feedback_comment: string | null;
  feedback_comment_received_at: string | null;
  internal_note: string | null;
  internal_note_updated_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

type MessageRow = {
  id: string;
  ticket_id: string;
  direction: SupportMessage["direction"];
  content: string;
  kind: SupportMessage["kind"];
  sent_by: SupportMessage["sentBy"];
  attendant_id: string | null;
  external_message_id: string | null;
  from_me: boolean;
  created_at: string;
};

type ClientNoteRow = {
  client_key: string;
  note: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

export const mapTicketRow = (row: TicketRow): SupportTicket => ({
  id: row.id,
  customerPhone: row.customer_phone,
  customerLid: row.customer_lid,
  customerJid: row.customer_jid,
  contactName: row.contact_name,
  status: row.status,
  assignedTo: row.assigned_to,
  category: row.category,
  priority: row.priority,
  lastMessage: row.last_message,
  lastMessageAt: row.last_message_at,
  firstResponseAt: row.first_response_at,
  feedbackScore: row.feedback_score,
  feedbackReceivedAt: row.feedback_received_at,
  feedbackComment: row.feedback_comment,
  feedbackCommentReceivedAt: row.feedback_comment_received_at,
  internalNote: row.internal_note,
  internalNoteUpdatedAt: row.internal_note_updated_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  closedAt: row.closed_at,
});

export const mapMessageRow = (row: MessageRow): SupportMessage => ({
  id: row.id,
  ticketId: row.ticket_id,
  direction: row.direction,
  content: row.content,
  kind: row.kind,
  sentBy: row.sent_by,
  attendantId: row.attendant_id,
  externalMessageId: row.external_message_id,
  fromMe: row.from_me,
  createdAt: row.created_at,
});

export const mapClientNoteRow = (row: ClientNoteRow): SupportClientNote => ({
  clientKey: row.client_key,
  note: row.note,
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
