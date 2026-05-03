export const ticketStatuses = [
  "em_fila",
  "em_atendimento",
  "aguardando_feedback",
  "aguardando_feedback_comentario",
  "finalizado",
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

export const ticketCategories = [
  "financeiro",
  "suporte",
  "pedido",
  "cadastro",
  "cardapio",
  "outro",
] as const;

export type TicketCategory = (typeof ticketCategories)[number];

export const ticketPriorities = ["baixa", "normal", "alta", "urgente"] as const;

export type TicketPriority = (typeof ticketPriorities)[number];

export const messageDirections = ["recebida", "enviada"] as const;

export type MessageDirection = (typeof messageDirections)[number];

export const messageKinds = [
  "texto",
  "imagem",
  "audio",
  "documento",
  "video",
  "sticker",
  "outro",
] as const;

export type MessageKind = (typeof messageKinds)[number];

export const messageSenders = ["cliente", "bot", "atendente"] as const;

export type MessageSender = (typeof messageSenders)[number];

export type SupportTicket = {
  id: string;
  customerPhone: string | null;
  customerLid: string | null;
  customerJid: string | null;
  contactName: string | null;
  status: TicketStatus;
  assignedTo: string | null;
  category: TicketCategory | null;
  priority: TicketPriority;
  lastMessage: string | null;
  lastMessageAt: string | null;
  firstResponseAt: string | null;
  feedbackScore: number | null;
  feedbackReceivedAt: string | null;
  feedbackComment: string | null;
  feedbackCommentReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type SupportMessage = {
  id: string;
  ticketId: string;
  direction: MessageDirection;
  content: string;
  kind: MessageKind;
  sentBy: MessageSender;
  attendantId: string | null;
  externalMessageId: string | null;
  fromMe: boolean;
  createdAt: string;
};

export type TicketWithMessages = {
  tickets: SupportTicket[];
  activeTicket: SupportTicket | null;
  messages: SupportMessage[];
};
