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
    background: "var(--hub-bg-page, #071016)",
    color: "var(--hub-text, #f8fafc)",
    overflow: "hidden",
  },
  sidebar: {
    height: "100dvh",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--hub-border-muted)",
    background:
      "linear-gradient(180deg, var(--hub-bg-sidebar) 0%, var(--hub-bg-page) 100%)",
  },
  logo: {
    height: 76,
    display: "flex",
    alignItems: "center",
    padding: "0 34px",
    borderBottom: "1px solid var(--hub-border-muted)",
    fontSize: 32,
    fontWeight: 900,
  },
  navigation: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--hub-space-2)",
    padding: "22px 12px",
  },
  navItem: {
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    gap: "var(--hub-space-5)",
    border: 0,
    borderRadius: "var(--hub-radius-md)",
    padding: "0 var(--hub-space-6)",
    background: "transparent",
    color: "#d7dde4",
    fontWeight: 650,
    cursor: "pointer",
  },
  navItemActive: {
    background: "#0d3029",
    color: "var(--hub-success)",
    boxShadow: "inset 4px 0 0 var(--hub-success)",
  },
  userCard: {
    minHeight: 84,
    display: "grid",
    gridTemplateColumns: "44px 1fr auto",
    gap: "var(--hub-space-4)",
    alignItems: "center",
    margin: "auto 8px 16px",
    padding: "var(--hub-space-5) 16px",
    border: "1px solid var(--hub-border-muted)",
    borderRadius: "var(--hub-radius-md)",
    background: "#0e171f",
  },
  userAvatar: {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--hub-radius-pill)",
    background: "var(--hub-success)",
    color: "#052e16",
    fontWeight: 900,
  },
  mutedText: {
    color: "var(--hub-text-muted)",
    fontSize: 13,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: "var(--hub-radius-pill)",
    background: "var(--hub-success)",
  },
  workspace: {
    minWidth: 0,
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "76px auto minmax(0, 1fr)",
    padding: "0 var(--hub-space-7) 20px",
    background: "var(--hub-bg-page, #071016)",
    color: "var(--hub-text, #f8fafc)",
    overflow: "hidden",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--hub-space-6)",
    borderBottom: "1px solid var(--hub-border-muted)",
    background: "var(--hub-bg-page, #071016)",
  },
  title: {
    fontSize: 24,
    lineHeight: 1.2,
  },
  topbarActions: {
    display: "flex",
    alignItems: "center",
    gap: "var(--hub-space-5)",
  },
  searchBox: {
    width: "min(36vw, 360px)",
    minHeight: "var(--hub-control-min-height)",
    display: "flex",
    alignItems: "center",
    gap: "var(--hub-space-3)",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "0 var(--hub-space-5)",
    background: "var(--hub-bg-control)",
    color: "#95a3af",
  },
  searchInput: {
    width: "100%",
    border: 0,
    outline: 0,
    background: "transparent",
    color: "var(--hub-text)",
  },
  iconButton: {
    position: "relative",
    width: "var(--hub-control-min-height)",
    height: "var(--hub-control-min-height)",
    display: "inline-grid",
    placeItems: "center",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    background: "var(--hub-bg-control)",
    color: "var(--hub-text-soft)",
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
    borderRadius: "var(--hub-radius-pill)",
    background: "var(--hub-danger)",
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
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    background: "var(--hub-panel-gradient)",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
    overflow: "hidden",
  },
  notificationPanelHeader: {
    minHeight: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--hub-space-4)",
    borderBottom: "1px solid var(--hub-border)",
    padding: "0 var(--hub-space-5)",
  },
  notificationList: {
    maxHeight: "calc(min(520px, calc(100dvh - 110px)) - 50px)",
    overflowY: "auto",
  },
  notificationItem: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "8px minmax(0, 1fr)",
    gap: "var(--hub-space-4)",
    border: 0,
    borderBottom: "1px solid var(--hub-border-muted)",
    padding: "var(--hub-space-5)",
    background: "transparent",
    color: "var(--hub-text)",
    textAlign: "left",
    cursor: "pointer",
  },
  notificationTone: {
    width: 8,
    minHeight: 42,
    borderRadius: "var(--hub-radius-pill)",
    background: "#38bdf8",
  },
  notificationToneDanger: {
    background: "var(--hub-danger)",
  },
  notificationToneWarning: {
    background: "#f59e0b",
  },
  filterTabs: {
    minHeight: 72,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "var(--hub-space-6)",
    borderBottom: "1px solid var(--hub-border-muted)",
    background: "var(--hub-bg-page, #071016)",
  },
  filterTab: {
    minHeight: 72,
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--hub-space-3)",
    border: 0,
    borderBottomWidth: 3,
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    background: "transparent",
    color: "var(--hub-text)",
    fontWeight: 750,
    cursor: "pointer",
  },
  filterTabActive: {
    color: "var(--hub-success)",
    borderBottomColor: "var(--hub-success)",
  },
  countPill: {
    minWidth: 24,
    minHeight: 22,
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--hub-radius-sm)",
    background: "var(--hub-bg-muted)",
    color: "#dce5ec",
    fontSize: 12,
  },
  contentGrid: {
    minHeight: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "360px minmax(420px, 1fr) 300px",
    gap: "var(--hub-space-4)",
    paddingTop: "var(--hub-space-5)",
    overflow: "hidden",
  },
  ticketColumn: {
    minHeight: 0,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "var(--hub-space-2)",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  panel: {
    minHeight: 120,
    maxHeight: "100%",
    display: "grid",
    gridTemplateRows: "auto minmax(0, auto)",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    background: "var(--hub-panel-gradient)",
    overflow: "hidden",
  },
  groupTitle: {
    minHeight: "var(--hub-panel-header-min-height)",
    display: "flex",
    alignItems: "center",
    gap: "var(--hub-space-4)",
    padding: "var(--hub-space-5) var(--hub-space-6)",
    borderBottom: "1px solid var(--hub-border)",
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
    gap: "var(--hub-space-4)",
    alignItems: "center",
    border: 0,
    borderBottom: "1px solid var(--hub-border-muted)",
    padding: "var(--hub-space-5) 16px",
    background: "transparent",
    color: "var(--hub-text)",
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
    borderRadius: "var(--hub-radius-lg)",
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
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    background: "var(--hub-panel-gradient)",
    overflow: "hidden",
  },
  chatHeader: {
    minHeight: 74,
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto auto",
    gap: "var(--hub-space-4)",
    alignItems: "center",
    padding: "var(--hub-space-5) 16px",
    borderBottom: "1px solid var(--hub-border)",
    background: "#111a22",
    color: "var(--hub-text)",
  },
  statusBadge: {
    width: "fit-content",
    display: "inline-flex",
    alignItems: "center",
    minHeight: "var(--hub-badge-min-height)",
    padding: "0 var(--hub-space-3)",
    borderRadius: "var(--hub-radius-sm)",
    background: "var(--hub-success-bg)",
    color: "var(--hub-success)",
    fontSize: 12,
    fontWeight: 850,
  },
  chatActions: {
    display: "flex",
    gap: "var(--hub-space-3)",
  },
  button: {
    minHeight: "var(--hub-button-min-height)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--hub-space-2)",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "0 var(--hub-space-5)",
    background: "#0f1820",
    color: "var(--hub-text)",
    fontWeight: 800,
    cursor: "pointer",
  },
  primaryButton: {
    borderColor: "var(--hub-success-strong)",
    background: "var(--hub-primary-gradient)",
  },
  dangerButton: {
    borderColor: "#dc2626",
    background: "linear-gradient(180deg, #ef4444, #b91c1c)",
  },
  disabledActionButton: {
    borderColor: "#334155",
    background: "#1f2937",
    color: "var(--hub-text-soft)",
  },
  messages: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "var(--hub-space-4)",
    padding: "var(--hub-space-6)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    backgroundColor: "#0a1117",
  },
  dayPill: {
    alignSelf: "center",
    padding: "7px 12px",
    borderRadius: "var(--hub-radius-md)",
    background: "#111b24",
    color: "#d1d5db",
    fontSize: 13,
  },
  message: {
    maxWidth: "min(70%, 620px)",
    padding: "11px 13px",
    border: "1px solid #24323e",
    borderRadius: "var(--hub-radius-md)",
    background: "#17222c",
    color: "var(--hub-text)",
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
    borderTop: "1px solid var(--hub-border)",
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
    color: "var(--hub-text-soft)",
    fontWeight: 750,
    cursor: "pointer",
  },
  composerTabActive: {
    color: "var(--hub-success)",
    borderBottomColor: "var(--hub-success)",
  },
  messageComposer: {
    margin: "0 16px 14px",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    background: "var(--hub-bg-panel)",
  },
  textarea: {
    width: "100%",
    minHeight: 64,
    border: 0,
    outline: 0,
    resize: "vertical",
    padding: "var(--hub-space-5)",
    background: "transparent",
    color: "var(--hub-text)",
  },
  composerActions: {
    display: "flex",
    alignItems: "center",
    gap: "var(--hub-space-3)",
    padding: "0 8px 8px",
  },
  sendButton: {
    marginLeft: "auto",
    minHeight: "var(--hub-control-min-height)",
  },
  detailsColumn: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "var(--hub-space-2)",
    overflowY: "auto",
  },
  detailCard: {
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    paddingBottom: "var(--hub-space-6)",
    background: "var(--hub-panel-gradient)",
    overflow: "visible",
  },
  detailHeader: {
    minHeight: "var(--hub-panel-header-min-height)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--hub-space-4)",
    padding: "var(--hub-space-5) var(--hub-space-6)",
    borderBottom: "1px solid var(--hub-border)",
  },
  detailRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto)",
    gap: 16,
    padding: "var(--hub-space-4) var(--hub-space-6)",
  },
  emptyState: {
    display: "grid",
    placeItems: "center",
    minHeight: 80,
    padding: "var(--hub-space-6)",
    color: "var(--hub-text-muted)",
    textAlign: "center",
  },
  error: {
    marginTop: "var(--hub-space-4)",
    border: "1px solid #7f1d1d",
    borderRadius: "var(--hub-radius-md)",
    padding: "var(--hub-space-5)",
    background: "#2a1113",
    color: "var(--hub-danger-text)",
  },
  notice: {
    marginTop: "var(--hub-space-4)",
    border: "1px solid #14532d",
    borderRadius: "var(--hub-radius-md)",
    padding: "var(--hub-space-5)",
    background: "#0d2d20",
    color: "#bbf7d0",
  },
  clientsGrid: {
    minHeight: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "360px minmax(460px, 1fr) 320px",
    gap: "var(--hub-space-4)",
    paddingTop: "var(--hub-space-5)",
    overflow: "hidden",
  },
  clientList: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "var(--hub-space-2)",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  clientButton: {
    width: "100%",
    minHeight: 82,
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr)",
    gap: "var(--hub-space-4)",
    alignItems: "center",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "var(--hub-space-5)",
    background: "var(--hub-panel-gradient)",
    color: "var(--hub-text)",
    textAlign: "left",
    cursor: "pointer",
  },
  profilePanel: {
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    background: "var(--hub-panel-gradient)",
    overflow: "hidden",
  },
  profileHeader: {
    display: "grid",
    gridTemplateColumns: "52px minmax(0, 1fr)",
    gap: "var(--hub-space-5)",
    alignItems: "center",
    padding: "var(--hub-space-6)",
    borderBottom: "1px solid var(--hub-border)",
    background: "#111a22",
  },
  profileBody: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "var(--hub-space-4)",
    padding: "var(--hub-space-6)",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "var(--hub-space-3)",
  },
  metricCard: {
    minHeight: 72,
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "12px 12px 16px",
    background: "var(--hub-bg-control)",
  },
  noteBox: {
    minHeight: 110,
    maxHeight: 160,
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "var(--hub-space-5)",
    background: "var(--hub-bg-control)",
    color: "var(--hub-text)",
    outline: 0,
    resize: "vertical",
    overflowY: "auto",
  },
  dashboardGrid: {
    minHeight: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: "var(--hub-space-4)",
    paddingTop: "var(--hub-space-5)",
    overflow: "hidden",
  },
  dashboardMain: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "var(--hub-space-4)",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  dashboardMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "var(--hub-space-4)",
  },
  dashboardMetricCard: {
    minHeight: 112,
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "16px 16px 20px",
    background: "var(--hub-panel-gradient)",
  },
  dashboardMetricValue: {
    marginTop: "var(--hub-space-4)",
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 900,
  },
  dashboardTwoColumns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "var(--hub-space-4)",
  },
  progressTrack: {
    height: 9,
    borderRadius: "var(--hub-radius-pill)",
    background: "var(--hub-border-muted)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "var(--hub-radius-pill)",
    background: "linear-gradient(90deg, var(--hub-success), #f59e0b)",
  },
  usersGrid: {
    minHeight: 0,
    height: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: "var(--hub-space-4)",
    paddingTop: "var(--hub-space-5)",
    overflow: "hidden",
  },
  usersList: {
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "var(--hub-space-4)",
    alignContent: "start",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  userManagementCard: {
    minHeight: 176,
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "16px 16px 20px",
    background: "var(--hub-panel-gradient)",
  },
  permissionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "var(--hub-space-2)",
    marginTop: "var(--hub-space-5)",
  },
  permissionPill: {
    minHeight: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "0 var(--hub-space-3)",
    background: "var(--hub-bg-control)",
    color: "var(--hub-text-soft)",
    fontSize: 12,
    fontWeight: 750,
  },
  field: {
    width: "100%",
    minHeight: "var(--hub-field-min-height)",
    border: "1px solid var(--hub-border)",
    borderRadius: "var(--hub-radius-md)",
    padding: "0 var(--hub-space-4)",
    background: "var(--hub-bg-control)",
    color: "var(--hub-text)",
    outline: 0,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "var(--hub-space-3)",
  },
  compactFormGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(120px, 1fr))",
    gap: "var(--hub-space-3)",
    padding: "var(--hub-space-6) var(--hub-space-6) 22px",
  },
  formLabel: {
    display: "grid",
    gap: 6,
    alignContent: "start",
  },
  scrollableCardBody: {
    minHeight: 0,
    display: "grid",
    gap: "var(--hub-space-4)",
    padding: "var(--hub-space-6)",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  stickyCardFooter: {
    minHeight: "var(--hub-panel-header-min-height)",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    borderTop: "1px solid var(--hub-border)",
    padding: "var(--hub-space-5) var(--hub-space-6)",
    background: "var(--hub-bg-panel)",
  },
  footerButton: {
    width: "auto",
    minWidth: 220,
  },
  settingsMessagesCard: {
    maxHeight: "min(680px, calc(100dvh - 250px))",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    paddingBottom: 0,
  },
} satisfies Record<string, CSSProperties>;
