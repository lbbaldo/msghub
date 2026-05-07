import { BarChart3, MessageCircle, Settings, Store, Users, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  TicketCategory,
  SupportClientNote,
  SupportContact,
  SupportTicket,
  TicketStatus,
} from "@/modules/support/types";
import type { SupportSettings } from "@/modules/support/settings";
import type { CurrentUser, SupportUserSummary } from "@/shared/auth/types";

export type TicketFilter = "todos" | TicketStatus | "urgentes";
export type AppView =
  | "atendimentos"
  | "dashboard"
  | "clientes"
  | "mensagens"
  | "relatorios"
  | "integracoes"
  | "usuarios"
  | "configuracoes";
export type ReportPeriod = "7d" | "30d" | "90d" | "todos";
export type ReportStatus = "todos" | TicketStatus;
export type ReportCategory = "todas" | TicketCategory;
export type SettingsView = SupportSettings;

export type ClientSummary = {
  key: string;
  name: string;
  contactName: string;
  businessName: string | null;
  identity: string;
  phone: string | null;
  lid: string | null;
  tickets: SupportTicket[];
  latestTicket: SupportTicket | null;
  openTickets: number;
  finishedTickets: number;
  averageFeedback: number | null;
  updatedAt: string;
};

const formatClientDisplayName = (
  name: string,
  businessName: string | null,
): string => (businessName ? `${name} - ${businessName}` : name);
export type UsersResponse = {
  users: SupportUserSummary[];
};

export type UserResponse = {
  user: SupportUserSummary;
};

export type TransferTicketsResponse = {
  transferredCount: number;
};

export type SettingsResponse = {
  settings: SupportSettings;
  runtime: {
    evolutionApiUrl: string;
    evolutionInstanceName: string;
    webhookConfigured: boolean;
    attendantWhatsappNumber: string | null;
    attendantGroupJid: string | null;
  };
};

export type ClientNotesResponse = {
  notes: SupportClientNote[];
};

export type ClientNoteResponse = {
  note: SupportClientNote | null;
};

export type CreateUserForm = {
  name: string;
  email: string;
  role: CurrentUser["role"];
  password: string;
  whatsappPhone: string;
};

export type UserDraft = {
  whatsappPhone: string;
  active: boolean;
  password: string;
  transferToUserId: string;
};

export type SupportNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string | null;
  ticketId: string | null;
  tone: "danger" | "warning" | "info";
};

export type DashboardMetrics = {
  queueTickets: SupportTicket[];
  activeTickets: SupportTicket[];
  finishedToday: number;
  waitingFeedback: number;
  averageFirstResponseMs: number | null;
  averageResolutionMs: number | null;
  averageFeedback: number | null;
  criticalQueue: Array<{
    ticket: SupportTicket;
    waitingMs: number;
  }>;
  attendantRows: Array<{
    label: string;
    openTickets: number;
    finishedTickets: number;
  }>;
};

export type SupportDashboardProps = {
  currentUser: CurrentUser;
  initialView: AppView;
};

export const filters: Array<{ label: string; value: TicketFilter }> = [
  { label: "Todos", value: "todos" },
  { label: "Em fila", value: "em_fila" },
  { label: "Em atendimento", value: "em_atendimento" },
  { label: "Aguardando nota", value: "aguardando_feedback" },
  { label: "Aguardando comentário", value: "aguardando_feedback_comentario" },
  { label: "Finalizados", value: "finalizado" },
  { label: "Urgentes", value: "urgentes" },
];

export const sidebarItems: Array<{
  label: string;
  icon: LucideIcon;
  view: AppView;
  href: string;
}> = [
  { label: "Atendimentos", icon: MessageCircle, view: "atendimentos", href: "/atendimentos" },
  { label: "Dashboard", icon: BarChart3, view: "dashboard", href: "/dashboard" },
  { label: "Clientes", icon: Users, view: "clientes", href: "/clientes" },
  { label: "Relatórios", icon: Store, view: "relatorios", href: "/relatorios" },
  { label: "Mensagens", icon: MessageCircle, view: "mensagens", href: "/mensagens" },
  { label: "Configurações", icon: Settings, view: "configuracoes", href: "/configuracoes" },
  { label: "Usuários", icon: Users, view: "usuarios", href: "/usuarios" },
  { label: "Integrações", icon: Zap, view: "integracoes", href: "/integracoes" },
];

export const statusLabels: Record<TicketStatus, string> = {
  em_fila: "Em fila",
  em_atendimento: "Em atendimento",
  aguardando_feedback: "Aguardando feedback",
  aguardando_feedback_comentario: "Aguardando comentário",
  finalizado: "Finalizado",
};

export const statusSections: Array<{
  title: string;
  statuses: TicketStatus[];
  tone: "queue" | "active" | "done";
}> = [
  { title: "Em fila", statuses: ["em_fila"], tone: "queue" },
  {
    title: "Em atendimento",
    statuses: ["em_atendimento"],
    tone: "active",
  },
  {
    title: "Aguardando nota",
    statuses: ["aguardando_feedback"],
    tone: "active",
  },
  {
    title: "Aguardando comentário",
    statuses: ["aguardando_feedback_comentario"],
    tone: "active",
  },
  { title: "Finalizados", statuses: ["finalizado"], tone: "done" },
];

export const formatTime = (value: string | null): string => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

export const getTicketName = (ticket: SupportTicket): string =>
  ticket.contactName ?? ticket.customerPhone ?? ticket.customerLid ?? "Contato não resolvido";

export const getTicketIdentity = (ticket: SupportTicket): string =>
  ticket.customerPhone ?? ticket.customerLid ?? ticket.customerJid ?? "Sem identificador";

export const getTicketCode = (ticket: SupportTicket): string => ticket.id.slice(0, 3);

export const getInitial = (name: string): string => name.slice(0, 1).toUpperCase();

export const canSendToCustomerPhone = (phone: string | null): boolean => Boolean(phone);

export const minutesToMs = (minutes: number): number => minutes * 60_000;

export const isTicketUnansweredFor = (
  ticket: SupportTicket,
  referenceDate: Date,
  waitingMs: number,
): boolean =>
  ticket.status !== "finalizado" &&
  ticket.status !== "aguardando_feedback" &&
  ticket.status !== "aguardando_feedback_comentario" &&
  !ticket.firstResponseAt &&
  referenceDate.getTime() - new Date(ticket.createdAt).getTime() >= waitingMs;

export const formatDuration = (milliseconds: number | null): string => {
  if (milliseconds === null) {
    return "-";
  }

  const totalMinutes = Math.max(0, Math.round(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
};

export const getAverage = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
};

export const isSameDay = (value: string | null, referenceDate: Date): boolean => {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
};

export const buildDashboardMetrics = (tickets: SupportTicket[]): DashboardMetrics => {
  const now = new Date();
  const queueTickets = tickets.filter((ticket) => ticket.status === "em_fila");
  const activeTickets = tickets.filter((ticket) => ticket.status === "em_atendimento");
  const finishedToday = tickets.filter((ticket) => isSameDay(ticket.closedAt, now)).length;
  const waitingFeedback = tickets.filter(
    (ticket) => ticket.status === "aguardando_feedback",
  ).length;
  const firstResponseDurations = tickets
    .filter((ticket) => ticket.firstResponseAt)
    .map(
      (ticket) =>
        new Date(ticket.firstResponseAt as string).getTime() -
        new Date(ticket.createdAt).getTime(),
    )
    .filter((duration) => duration >= 0);
  const resolutionDurations = tickets
    .filter((ticket) => ticket.closedAt)
    .map(
      (ticket) =>
        new Date(ticket.closedAt as string).getTime() -
        new Date(ticket.createdAt).getTime(),
    )
    .filter((duration) => duration >= 0);
  const feedbackScores = tickets
    .map((ticket) => ticket.feedbackScore)
    .filter((score): score is number => typeof score === "number");
  const criticalQueue = [...queueTickets]
    .sort(
      (firstTicket, secondTicket) =>
        new Date(firstTicket.createdAt).getTime() -
        new Date(secondTicket.createdAt).getTime(),
    )
    .slice(0, 5)
    .map((ticket) => ({
      ticket,
      waitingMs: now.getTime() - new Date(ticket.createdAt).getTime(),
    }));
  const attendantRows = Array.from(
    tickets.reduce<Map<string, SupportTicket[]>>((groups, ticket) => {
      if (!ticket.assignedTo) {
        return groups;
      }

      const currentTickets = groups.get(ticket.assignedTo) ?? [];

      return new Map(groups).set(ticket.assignedTo, [...currentTickets, ticket]);
    }, new Map<string, SupportTicket[]>()),
  ).map(([label, attendantTickets]) => ({
    label,
    openTickets: attendantTickets.filter((ticket) => ticket.status !== "finalizado").length,
    finishedTickets: attendantTickets.filter((ticket) => ticket.status === "finalizado").length,
  }));

  return {
    queueTickets,
    activeTickets,
    finishedToday,
    waitingFeedback,
    averageFirstResponseMs: getAverage(firstResponseDurations),
    averageResolutionMs: getAverage(resolutionDurations),
    averageFeedback: getAverage(feedbackScores),
    criticalQueue,
    attendantRows,
  };
};

export const buildSupportNotifications = (
  tickets: SupportTicket[],
  settings: SupportSettings,
): SupportNotification[] => {
  const now = new Date();
  const urgentNotifications = tickets
    .filter(
      (ticket) =>
        ticket.priority === "urgente" ||
        isTicketUnansweredFor(ticket, now, minutesToMs(settings.urgentUnansweredMinutes)),
    )
    .map((ticket) => ({
      id: `urgent-${ticket.id}`,
      title: "Urgência: sem resposta",
      description: `${getTicketName(ticket)} está há ${formatDuration(
        now.getTime() - new Date(ticket.createdAt).getTime(),
      )} sem primeira resposta.`,
      createdAt: ticket.createdAt,
      ticketId: ticket.id,
      tone: "danger",
    }) satisfies SupportNotification);
  const queueNotifications = tickets
    .filter((ticket) => ticket.status === "em_fila")
    .filter(
      (ticket) =>
        ticket.priority !== "urgente" &&
        !isTicketUnansweredFor(ticket, now, minutesToMs(settings.urgentUnansweredMinutes)),
    )
    .map((ticket) => {
      const waitingMs = now.getTime() - new Date(ticket.createdAt).getTime();
      const isCritical = waitingMs >= minutesToMs(settings.queueCriticalMinutes);

      return {
        id: `queue-${ticket.id}`,
        title: isCritical ? "Fila crítica" : "Novo atendimento em fila",
        description: `${getTicketName(ticket)} aguarda há ${formatDuration(waitingMs)}.`,
        createdAt: ticket.createdAt,
        ticketId: ticket.id,
        tone: isCritical ? "danger" : "warning",
      } satisfies SupportNotification;
    });
  const staleActiveNotifications = tickets
    .filter((ticket) => ticket.status === "em_atendimento" && ticket.lastMessageAt)
    .filter(
      (ticket) =>
        now.getTime() - new Date(ticket.lastMessageAt as string).getTime() >=
        minutesToMs(settings.staleTicketMinutes),
    )
    .map((ticket) => ({
      id: `stale-${ticket.id}`,
      title: "Atendimento parado",
      description: `${getTicketName(ticket)} está sem atualização há ${formatDuration(
        now.getTime() - new Date(ticket.lastMessageAt as string).getTime(),
      )}.`,
      createdAt: ticket.lastMessageAt,
      ticketId: ticket.id,
      tone: "warning",
    }) satisfies SupportNotification);
  const feedbackNotifications = tickets
    .filter(
      (ticket) =>
        ticket.status === "aguardando_feedback" ||
        ticket.status === "aguardando_feedback_comentario",
    )
    .filter(
      (ticket) =>
        now.getTime() - new Date(ticket.updatedAt).getTime() <
        minutesToMs(settings.feedbackExpirationMinutes),
    )
    .map((ticket) => ({
      id: `feedback-${ticket.id}`,
      title:
        ticket.status === "aguardando_feedback"
          ? "Aguardando nota"
          : "Aguardando comentário",
      description:
        ticket.status === "aguardando_feedback"
          ? `${getTicketName(ticket)} ainda não enviou a nota.`
          : `${getTicketName(ticket)} pode enviar um comentário opcional.`,
      createdAt: ticket.updatedAt,
      ticketId: ticket.id,
      tone: "info",
    }) satisfies SupportNotification);
  const lowFeedbackNotifications = tickets
    .filter(
      (ticket) =>
        ticket.feedbackScore !== null && ticket.feedbackScore <= settings.lowFeedbackScore,
    )
    .map((ticket) => ({
      id: `low-feedback-${ticket.id}`,
      title: "Avaliação baixa",
      description: `${getTicketName(ticket)} avaliou com nota ${ticket.feedbackScore}.`,
      createdAt: ticket.feedbackReceivedAt,
      ticketId: ticket.id,
      tone: "danger",
    }) satisfies SupportNotification);
  const unresolvedIdentityNotifications = tickets
    .filter((ticket) => ticket.status !== "finalizado" && !ticket.customerPhone)
    .map((ticket) => ({
      id: `unresolved-${ticket.id}`,
      title: "Contato sem telefone",
      description: `${getTicketName(ticket)} chegou apenas com LID. Resposta pelo hub pode ficar limitada.`,
      createdAt: ticket.createdAt,
      ticketId: ticket.id,
      tone: "warning",
    }) satisfies SupportNotification);

  return [
    ...urgentNotifications,
    ...queueNotifications,
    ...staleActiveNotifications,
    ...feedbackNotifications,
    ...lowFeedbackNotifications,
    ...unresolvedIdentityNotifications,
  ]
    .sort(
      (firstNotification, secondNotification) =>
        new Date(secondNotification.createdAt ?? 0).getTime() -
        new Date(firstNotification.createdAt ?? 0).getTime(),
    )
    .slice(0, 12);
};

export const getRoleLabel = (role: CurrentUser["role"]): string => {
  const labels: Record<CurrentUser["role"], string> = {
    admin: "Admin",
    supervisor: "Supervisor",
    atendente: "Atendente",
  };

  return labels[role];
};

export const getUserPermissions = (role: CurrentUser["role"]): string[] => {
  if (role === "admin") {
    return [
      "Gerenciar usuários",
      "Ver relatórios",
      "Ver feedbacks",
      "Configurar hub",
    ];
  }

  if (role === "supervisor") {
    return ["Ver relatórios", "Ver feedbacks", "Transferir tickets", "Acompanhar fila"];
  }

  return ["Assumir tickets", "Responder clientes", "Finalizar atendimento"];
};

export const buildUserDraft = (user: SupportUserSummary): UserDraft => ({
  whatsappPhone: user.whatsappPhone ?? "",
  active: user.active,
  password: "",
  transferToUserId: "",
});

export const mergeUser = (
  users: SupportUserSummary[],
  nextUser: SupportUserSummary,
): SupportUserSummary[] =>
  users.map((user) => (user.id === nextUser.id ? nextUser : user));

export const normalizeOptionalPhone = (phone: string): string | null => {
  const normalizedPhone = phone.replace(/\D/gu, "");

  return normalizedPhone.length > 0 ? normalizedPhone : null;
};

export const normalizeBrazilianPhone = (phone: string): string | null => {
  const normalizedPhone = normalizeOptionalPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  return normalizedPhone.startsWith("55") ? normalizedPhone : `55${normalizedPhone}`;
};

export const formatBrazilianPhone = (phone: string | null): string => {
  if (!phone) {
    return "";
  }

  const normalizedPhone = phone.replace(/\D/gu, "");
  const localPhone =
    normalizedPhone.startsWith("55") && normalizedPhone.length > 11
      ? normalizedPhone.slice(2)
      : normalizedPhone;

  if (localPhone.length === 11) {
    return `(${localPhone.slice(0, 2)}) ${localPhone.slice(2, 7)}-${localPhone.slice(7)}`;
  }

  if (localPhone.length === 10) {
    return `(${localPhone.slice(0, 2)}) ${localPhone.slice(2, 6)}-${localPhone.slice(6)}`;
  }

  return localPhone;
};

export const maskBrazilianPhoneInput = (phone: string): string => {
  const normalizedPhone = phone.replace(/\D/gu, "");
  const localPhone =
    normalizedPhone.startsWith("55") && normalizedPhone.length > 11
      ? normalizedPhone.slice(2, 13)
      : normalizedPhone.slice(0, 11);

  if (localPhone.length <= 2) {
    return localPhone;
  }

  if (localPhone.length <= 6) {
    return `(${localPhone.slice(0, 2)}) ${localPhone.slice(2)}`;
  }

  if (localPhone.length <= 10) {
    return `(${localPhone.slice(0, 2)}) ${localPhone.slice(2, 6)}-${localPhone.slice(6)}`;
  }

  return `(${localPhone.slice(0, 2)}) ${localPhone.slice(2, 7)}-${localPhone.slice(7)}`;
};

export const requestJson = async <T,>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, init);
  const data = (await response.json()) as unknown;

  if (!response.ok) {
    const errorData =
      typeof data === "object" && data !== null && "error" in data
        ? (data as { error?: unknown })
        : null;
    const message =
      typeof errorData?.error === "string"
        ? errorData.error
        : `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data as T;
};

export const getCountForFilter = (
  tickets: SupportTicket[],
  filter: TicketFilter,
): number =>
  filter === "todos"
    ? tickets.length
    : filter === "urgentes"
      ? tickets.filter((ticket) => ticket.priority === "urgente").length
      : tickets.filter((ticket) => ticket.status === filter).length;

const isSameLocalDay = (dateValue: string | null, referenceDate: Date): boolean => {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
};

export const isTicketVisibleInTodayQueue = (
  ticket: SupportTicket,
  referenceDate = new Date(),
): boolean =>
  ticket.status !== "finalizado" ||
  isSameLocalDay(ticket.createdAt, referenceDate) ||
  isSameLocalDay(ticket.updatedAt, referenceDate) ||
  isSameLocalDay(ticket.lastMessageAt, referenceDate);

export const buildClientSummaries = (
  tickets: SupportTicket[],
  contacts: SupportContact[] = [],
): ClientSummary[] => {
  const groupedTickets = tickets.reduce<Map<string, SupportTicket[]>>((groups, ticket) => {
    const key = getTicketIdentity(ticket);
    const currentTickets = groups.get(key) ?? [];

    return new Map(groups).set(key, [...currentTickets, ticket]);
  }, new Map<string, SupportTicket[]>());
  const groupedContacts = contacts.reduce<Map<string, SupportContact>>(
    (groups, contact) => new Map(groups).set(contact.phone, contact),
    new Map<string, SupportContact>(),
  );

  return Array.from(new Set([...groupedTickets.keys(), ...groupedContacts.keys()]))
    .map((key) => {
      const ticketsForClient = groupedTickets.get(key) ?? [];
      const contact = groupedContacts.get(key);
      const sortedTickets = [...ticketsForClient].sort(
        (firstTicket, secondTicket) =>
          new Date(secondTicket.updatedAt).getTime() -
          new Date(firstTicket.updatedAt).getTime(),
      );
      const latestTicket = sortedTickets[0] ?? null;
      const feedbackScores = sortedTickets
        .map((ticket) => ticket.feedbackScore)
        .filter((score): score is number => typeof score === "number");
      const feedbackTotal = feedbackScores.reduce((total, score) => total + score, 0);
      const fallbackIdentity = contact?.phone ?? key;

      return {
        key,
        name: contact
          ? formatClientDisplayName(contact.name, contact.businessName)
          : latestTicket
            ? getTicketName(latestTicket)
            : fallbackIdentity,
        contactName: contact?.name ?? (latestTicket ? getTicketName(latestTicket) : fallbackIdentity),
        businessName: contact?.businessName ?? null,
        identity: fallbackIdentity,
        phone: contact?.phone ?? latestTicket?.customerPhone ?? null,
        lid: latestTicket?.customerLid ?? null,
        tickets: sortedTickets,
        latestTicket,
        openTickets: sortedTickets.filter((ticket) => ticket.status !== "finalizado").length,
        finishedTickets: sortedTickets.filter((ticket) => ticket.status === "finalizado").length,
        averageFeedback:
          feedbackScores.length > 0 ? feedbackTotal / feedbackScores.length : null,
        updatedAt: latestTicket?.updatedAt ?? contact?.updatedAt ?? new Date(0).toISOString(),
      };
    })
    .sort(
      (firstClient, secondClient) =>
        new Date(secondClient.updatedAt).getTime() -
        new Date(firstClient.updatedAt).getTime(),
    );
};
