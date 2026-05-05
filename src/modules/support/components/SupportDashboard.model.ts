import { BarChart3, MessageCircle, Settings, Store, Users, Zap } from "lucide-react";
import type { CSSProperties } from "react";

import type {
  SupportClientNote,
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
  | "usuarios"
  | "configuracoes";
export type SettingsView = SupportSettings;

export type ClientSummary = {
  key: string;
  name: string;
  identity: string;
  phone: string | null;
  lid: string | null;
  tickets: SupportTicket[];
  latestTicket: SupportTicket;
  openTickets: number;
  finishedTickets: number;
  averageFeedback: number | null;
};

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
  icon: typeof MessageCircle;
  view?: AppView;
}> = [
  { label: "Atendimentos", icon: MessageCircle, view: "atendimentos" },
  { label: "Dashboard", icon: BarChart3, view: "dashboard" },
  { label: "Clientes", icon: Users, view: "clientes" },
  { label: "Relatórios", icon: Store },
  { label: "Mensagens", icon: MessageCircle },
  { label: "Configurações", icon: Settings, view: "configuracoes" },
  { label: "Usuários", icon: Users, view: "usuarios" },
  { label: "Integrações", icon: Zap },
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

export const buildClientSummaries = (tickets: SupportTicket[]): ClientSummary[] => {
  const groupedTickets = tickets.reduce<Map<string, SupportTicket[]>>((groups, ticket) => {
    const key = getTicketIdentity(ticket);
    const currentTickets = groups.get(key) ?? [];

    return new Map(groups).set(key, [...currentTickets, ticket]);
  }, new Map<string, SupportTicket[]>());

  return Array.from(groupedTickets.entries())
    .map(([key, clientTickets]) => {
      const sortedTickets = [...clientTickets].sort(
        (firstTicket, secondTicket) =>
          new Date(secondTicket.updatedAt).getTime() -
          new Date(firstTicket.updatedAt).getTime(),
      );
      const latestTicket = sortedTickets[0] as SupportTicket;
      const feedbackScores = sortedTickets
        .map((ticket) => ticket.feedbackScore)
        .filter((score): score is number => typeof score === "number");
      const feedbackTotal = feedbackScores.reduce((total, score) => total + score, 0);

      return {
        key,
        name: getTicketName(latestTicket),
        identity: key,
        phone: latestTicket.customerPhone,
        lid: latestTicket.customerLid,
        tickets: sortedTickets,
        latestTicket,
        openTickets: sortedTickets.filter((ticket) => ticket.status !== "finalizado").length,
        finishedTickets: sortedTickets.filter((ticket) => ticket.status === "finalizado").length,
        averageFeedback:
          feedbackScores.length > 0 ? feedbackTotal / feedbackScores.length : null,
      };
    })
    .sort(
      (firstClient, secondClient) =>
        new Date(secondClient.latestTicket.updatedAt).getTime() -
        new Date(firstClient.latestTicket.updatedAt).getTime(),
    );
};

export const ui = {
  shell: {
    height: "100dvh",
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "230px minmax(0, 1fr)",
    background: "#071016",
    color: "#f8fafc",
    overflow: "hidden",
  },
  sidebar: {
    height: "100dvh",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #1f2c35",
    background: "linear-gradient(180deg, #111c24 0%, #071016 100%)",
  },
  logo: {
    height: 76,
    display: "flex",
    alignItems: "center",
    padding: "0 34px",
    borderBottom: "1px solid #1f2c35",
    fontSize: 32,
    fontWeight: 900,
  },
  navigation: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "22px 12px",
  },
  navItem: {
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    gap: 14,
    border: 0,
    borderRadius: 8,
    padding: "0 18px",
    background: "transparent",
    color: "#d7dde4",
    fontWeight: 650,
    cursor: "pointer",
  },
  navItemActive: {
    background: "#0d3029",
    color: "#22c55e",
    boxShadow: "inset 4px 0 0 #22c55e",
  },
  userCard: {
    minHeight: 84,
    display: "grid",
    gridTemplateColumns: "44px 1fr auto",
    gap: 12,
    alignItems: "center",
    margin: "auto 8px 16px",
    padding: "14px 16px",
    border: "1px solid #1f2c35",
    borderRadius: 8,
    background: "#0e171f",
  },
  userAvatar: {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "#22c55e",
    color: "#052e16",
    fontWeight: 900,
  },
  mutedText: {
    color: "#9ca3af",
    fontSize: 13,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#22c55e",
  },
  workspace: {
    minWidth: 0,
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "76px auto minmax(0, 1fr)",
    padding: "0 24px 20px",
    overflow: "hidden",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    borderBottom: "1px solid #1f2c35",
  },
  title: {
    fontSize: 24,
    lineHeight: 1.2,
  },
  topbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  searchBox: {
    width: "min(36vw, 360px)",
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #263542",
    borderRadius: 8,
    padding: "0 14px",
    background: "#0b141b",
    color: "#95a3af",
  },
  searchInput: {
    width: "100%",
    border: 0,
    outline: 0,
    background: "transparent",
    color: "#f8fafc",
  },
  iconButton: {
    position: "relative",
    width: 44,
    height: 44,
    display: "inline-grid",
    placeItems: "center",
    border: "1px solid #263542",
    borderRadius: 8,
    background: "#0b141b",
    color: "#cbd5e1",
    cursor: "pointer",
  },
  badge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 18,
    height: 18,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "#ef4444",
    color: "#fff",
    fontSize: 11,
    fontWeight: 900,
  },
  notificationWrapper: {
    position: "relative",
  },
  notificationPanel: {
    position: "absolute",
    top: 54,
    right: 0,
    zIndex: 30,
    width: 380,
    maxHeight: "min(520px, calc(100dvh - 110px))",
    border: "1px solid #263542",
    borderRadius: 8,
    background: "linear-gradient(180deg, #151f28 0%, #0c141b 100%)",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
    overflow: "hidden",
  },
  notificationPanelHeader: {
    minHeight: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid #263542",
    padding: "0 14px",
  },
  notificationList: {
    maxHeight: "calc(min(520px, calc(100dvh - 110px)) - 50px)",
    overflowY: "auto",
  },
  notificationItem: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "8px minmax(0, 1fr)",
    gap: 12,
    border: 0,
    borderBottom: "1px solid #1f2c35",
    padding: 14,
    background: "transparent",
    color: "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
  },
  notificationTone: {
    width: 8,
    minHeight: 42,
    borderRadius: 999,
    background: "#38bdf8",
  },
  notificationToneDanger: {
    background: "#ef4444",
  },
  notificationToneWarning: {
    background: "#f59e0b",
  },
  filterTabs: {
    minHeight: 72,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 18,
    borderBottom: "1px solid #1f2c35",
  },
  filterTab: {
    minHeight: 72,
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    border: 0,
    borderBottomWidth: 3,
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    background: "transparent",
    color: "#f8fafc",
    fontWeight: 750,
    cursor: "pointer",
  },
  filterTabActive: {
    color: "#22c55e",
    borderBottomColor: "#22c55e",
  },
  countPill: {
    minWidth: 24,
    minHeight: 22,
    display: "grid",
    placeItems: "center",
    borderRadius: 7,
    background: "#22303b",
    color: "#dce5ec",
    fontSize: 12,
  },
  contentGrid: {
    minHeight: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "360px minmax(420px, 1fr) 300px",
    gap: 12,
    paddingTop: 14,
    overflow: "hidden",
  },
  ticketColumn: {
    minHeight: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  panel: {
    minHeight: 120,
    maxHeight: "100%",
    display: "grid",
    gridTemplateRows: "46px minmax(0, auto)",
    border: "1px solid #263542",
    borderRadius: 8,
    background: "linear-gradient(180deg, #151f28 0%, #0c141b 100%)",
    overflow: "hidden",
  },
  groupTitle: {
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    padding: "0 18px",
    borderBottom: "1px solid #263542",
    fontSize: 15,
  },
  ticketList: {
    minHeight: 74,
    maxHeight: "calc(100dvh - 286px)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
  },
  ticketButton: {
    width: "100%",
    minHeight: 74,
    display: "grid",
    gridTemplateColumns: "38px minmax(0, 1fr) 22px",
    gap: 12,
    alignItems: "center",
    border: 0,
    borderBottom: "1px solid #1f2c35",
    padding: "14px 16px",
    background: "transparent",
    color: "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
  },
  ticketButtonActive: {
    background: "rgba(255, 255, 255, 0.06)",
  },
  ticketCode: {
    width: 38,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 900,
  },
  queueCode: {
    background: "linear-gradient(135deg, #ffb020, #ff7a00)",
  },
  activeCode: {
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  },
  doneCode: {
    background: "linear-gradient(135deg, #64748b, #334155)",
  },
  chatPanel: {
    minWidth: 0,
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "74px minmax(0, 1fr) auto",
    border: "1px solid #263542",
    borderRadius: 8,
    background: "linear-gradient(180deg, #151f28 0%, #0c141b 100%)",
    overflow: "hidden",
  },
  chatHeader: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
    gap: 12,
    alignItems: "center",
    padding: "0 16px",
    borderBottom: "1px solid #263542",
    background: "#111a22",
    color: "#f8fafc",
  },
  statusBadge: {
    width: "fit-content",
    display: "inline-flex",
    alignItems: "center",
    minHeight: 25,
    padding: "0 10px",
    borderRadius: 7,
    background: "#133f2d",
    color: "#22c55e",
    fontSize: 12,
    fontWeight: 850,
  },
  chatActions: {
    display: "flex",
    gap: 10,
  },
  button: {
    minHeight: 36,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: "1px solid #263542",
    borderRadius: 8,
    padding: "0 14px",
    background: "#0f1820",
    color: "#f8fafc",
    fontWeight: 800,
    cursor: "pointer",
  },
  primaryButton: {
    borderColor: "#16a34a",
    background: "linear-gradient(180deg, #22c55e, #15803d)",
  },
  dangerButton: {
    borderColor: "#dc2626",
    background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  },
  disabledActionButton: {
    borderColor: "#334155",
    background: "#1f2937",
    color: "#cbd5e1",
  },
  messages: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 18,
    overflowY: "auto",
    overscrollBehavior: "contain",
    backgroundColor: "#0a1117",
  },
  dayPill: {
    alignSelf: "center",
    padding: "7px 12px",
    borderRadius: 8,
    background: "#111b24",
    color: "#d1d5db",
    fontSize: 13,
  },
  message: {
    maxWidth: "min(70%, 620px)",
    padding: "11px 13px",
    border: "1px solid #24323e",
    borderRadius: 8,
    background: "#17222c",
    color: "#f8fafc",
  },
  messageSent: {
    alignSelf: "flex-end",
    borderColor: "#0f8f55",
    background: "linear-gradient(180deg, #087a48, #065f38)",
  },
  messageReceived: {
    alignSelf: "flex-start",
  },
  composer: {
    borderTop: "1px solid #263542",
    background: "#111a22",
  },
  composerTabs: {
    display: "flex",
    gap: 20,
    padding: "0 16px",
  },
  composerTab: {
    minHeight: 50,
    borderWidth: 0,
    borderBottomWidth: 3,
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    background: "transparent",
    color: "#cbd5e1",
    fontWeight: 750,
    cursor: "pointer",
  },
  composerTabActive: {
    color: "#22c55e",
    borderBottomColor: "#22c55e",
  },
  messageComposer: {
    margin: "0 16px 14px",
    border: "1px solid #263542",
    borderRadius: 8,
    background: "#0c141b",
  },
  textarea: {
    width: "100%",
    minHeight: 64,
    border: 0,
    outline: 0,
    resize: "vertical",
    padding: 14,
    background: "transparent",
    color: "#f8fafc",
  },
  composerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 8px 8px",
  },
  sendButton: {
    marginLeft: "auto",
    minHeight: 44,
  },
  detailsColumn: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
  },
  detailCard: {
    border: "1px solid #263542",
    borderRadius: 8,
    paddingBottom: 18,
    background: "linear-gradient(180deg, #151f28 0%, #0c141b 100%)",
    overflow: "hidden",
  },
  detailHeader: {
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 18px",
    borderBottom: "1px solid #263542",
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 18px",
  },
  emptyState: {
    display: "grid",
    placeItems: "center",
    minHeight: 80,
    padding: 18,
    color: "#9ca3af",
    textAlign: "center",
  },
  error: {
    marginTop: 12,
    border: "1px solid #7f1d1d",
    borderRadius: 8,
    padding: 14,
    background: "#2a1113",
    color: "#fecaca",
  },
  notice: {
    marginTop: 12,
    border: "1px solid #14532d",
    borderRadius: 8,
    padding: 14,
    background: "#0d2d20",
    color: "#bbf7d0",
  },
  clientsGrid: {
    minHeight: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "360px minmax(460px, 1fr) 320px",
    gap: 12,
    paddingTop: 14,
    overflow: "hidden",
  },
  clientList: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  clientButton: {
    width: "100%",
    minHeight: 82,
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr)",
    gap: 12,
    alignItems: "center",
    border: "1px solid #263542",
    borderRadius: 8,
    padding: 14,
    background: "linear-gradient(180deg, #151f28 0%, #0c141b 100%)",
    color: "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
  },
  profilePanel: {
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    border: "1px solid #263542",
    borderRadius: 8,
    background: "linear-gradient(180deg, #151f28 0%, #0c141b 100%)",
    overflow: "hidden",
  },
  profileHeader: {
    display: "grid",
    gridTemplateColumns: "52px minmax(0, 1fr)",
    gap: 14,
    alignItems: "center",
    padding: 18,
    borderBottom: "1px solid #263542",
    background: "#111a22",
  },
  profileBody: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: 18,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  metricCard: {
    minHeight: 72,
    border: "1px solid #263542",
    borderRadius: 8,
    padding: "12px 12px 16px",
    background: "#0b141b",
  },
  noteBox: {
    minHeight: 110,
    maxHeight: 160,
    border: "1px solid #263542",
    borderRadius: 8,
    padding: 14,
    background: "#0b141b",
    color: "#f8fafc",
    outline: 0,
    resize: "vertical",
    overflowY: "auto",
  },
  dashboardGrid: {
    minHeight: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: 12,
    paddingTop: 14,
    overflow: "hidden",
  },
  dashboardMain: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  dashboardMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  dashboardMetricCard: {
    minHeight: 112,
    border: "1px solid #263542",
    borderRadius: 8,
    padding: "16px 16px 20px",
    background: "linear-gradient(180deg, #151f28 0%, #0c141b 100%)",
  },
  dashboardMetricValue: {
    marginTop: 12,
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 900,
  },
  dashboardTwoColumns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: 12,
  },
  progressTrack: {
    height: 9,
    borderRadius: 999,
    background: "#1f2c35",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #22c55e, #f59e0b)",
  },
  usersGrid: {
    minHeight: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: 12,
    paddingTop: 14,
    overflow: "hidden",
  },
  usersList: {
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    alignContent: "start",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  userManagementCard: {
    minHeight: 176,
    border: "1px solid #263542",
    borderRadius: 8,
    padding: "16px 16px 20px",
    background: "linear-gradient(180deg, #151f28 0%, #0c141b 100%)",
  },
  permissionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 14,
  },
  permissionPill: {
    minHeight: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #263542",
    borderRadius: 8,
    padding: "0 10px",
    background: "#0b141b",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 750,
  },
  field: {
    width: "100%",
    minHeight: 38,
    border: "1px solid #263542",
    borderRadius: 8,
    padding: "0 12px",
    background: "#0b141b",
    color: "#f8fafc",
    outline: 0,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  compactFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(120px, 1fr))",
    gap: 10,
    padding: "18px 18px 22px",
  },
  formLabel: {
    display: "grid",
    gap: 6,
    alignContent: "start",
  },
  scrollableCardBody: {
    minHeight: 0,
    display: "grid",
    gap: 12,
    padding: 18,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  stickyCardFooter: {
    minHeight: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    borderTop: "1px solid #263542",
    padding: "5px 18px",
    background: "#0c141b",
  },
  footerButton: {
    width: "auto",
    minWidth: 220,
  },
  settingsMessagesCard: {
    maxHeight: "min(680px, calc(100dvh - 250px))",
    display: "grid",
    gridTemplateRows: "46px minmax(0, 1fr) 46px",
    paddingBottom: 0,
  },
} satisfies Record<string, CSSProperties>;
