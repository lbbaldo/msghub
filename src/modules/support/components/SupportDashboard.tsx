"use client";

import {
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  LogOut,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Smile,
  Store,
  Users,
  Zap,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  SupportMessage,
  SupportTicket,
  TicketStatus,
  TicketWithMessages,
} from "@/modules/support/types";
import {
  defaultSupportSettings,
  type SupportSettings,
} from "@/modules/support/settings";
import styles from "@/modules/support/components/SupportDashboard.module.css";
import type { CurrentUser, SupportUserSummary } from "@/shared/auth/types";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { SelectField, TextField, ToggleField } from "@/shared/ui/FormField";
import { LoadingLabel } from "@/shared/ui/LoadingLabel";

type TicketFilter = "todos" | TicketStatus;
type AppView =
  | "atendimentos"
  | "dashboard"
  | "clientes"
  | "usuarios"
  | "configuracoes";
type SettingsView = SupportSettings;

type ClientSummary = {
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

type UsersResponse = {
  users: SupportUserSummary[];
};

type UserResponse = {
  user: SupportUserSummary;
};

type TransferTicketsResponse = {
  transferredCount: number;
};

type SettingsResponse = {
  settings: SupportSettings;
  runtime: {
    evolutionApiUrl: string;
    evolutionInstanceName: string;
    webhookConfigured: boolean;
    attendantWhatsappNumber: string | null;
    attendantGroupJid: string | null;
  };
};

type CreateUserForm = {
  name: string;
  email: string;
  role: CurrentUser["role"];
  password: string;
  whatsappPhone: string;
};

type UserDraft = {
  whatsappPhone: string;
  active: boolean;
  password: string;
  transferToUserId: string;
};

type SupportNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string | null;
  ticketId: string | null;
  tone: "danger" | "warning" | "info";
};

type DashboardMetrics = {
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

type SupportDashboardProps = {
  currentUser: CurrentUser;
};

const filters: Array<{ label: string; value: TicketFilter }> = [
  { label: "Todos", value: "todos" },
  { label: "Em fila", value: "em_fila" },
  { label: "Em atendimento", value: "em_atendimento" },
  { label: "Finalizados", value: "finalizado" },
];

const sidebarItems: Array<{
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

const statusLabels: Record<TicketStatus, string> = {
  em_fila: "Em fila",
  em_atendimento: "Em atendimento",
  aguardando_feedback: "Aguardando feedback",
  aguardando_feedback_comentario: "Aguardando comentário",
  finalizado: "Finalizado",
};

const statusSections: Array<{
  title: string;
  statuses: TicketStatus[];
  tone: "queue" | "active" | "done";
}> = [
  { title: "Em fila", statuses: ["em_fila"], tone: "queue" },
  {
    title: "Em atendimento",
    statuses: ["em_atendimento", "aguardando_feedback", "aguardando_feedback_comentario"],
    tone: "active",
  },
  { title: "Finalizados", statuses: ["finalizado"], tone: "done" },
];

const formatTime = (value: string | null): string => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

const getTicketName = (ticket: SupportTicket): string =>
  ticket.contactName ?? ticket.customerPhone ?? ticket.customerLid ?? "Contato não resolvido";

const getTicketIdentity = (ticket: SupportTicket): string =>
  ticket.customerPhone ?? ticket.customerLid ?? ticket.customerJid ?? "Sem identificador";

const getTicketCode = (ticket: SupportTicket): string => ticket.id.slice(0, 3);

const getInitial = (name: string): string => name.slice(0, 1).toUpperCase();

const canSendToCustomerPhone = (phone: string | null): boolean => Boolean(phone);

const minutesToMs = (minutes: number): number => minutes * 60_000;

const isTicketUnansweredFor = (
  ticket: SupportTicket,
  referenceDate: Date,
  waitingMs: number,
): boolean =>
  ticket.status !== "finalizado" &&
  ticket.status !== "aguardando_feedback" &&
  ticket.status !== "aguardando_feedback_comentario" &&
  !ticket.firstResponseAt &&
  referenceDate.getTime() - new Date(ticket.createdAt).getTime() >= waitingMs;

const formatDuration = (milliseconds: number | null): string => {
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

const getAverage = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
};

const isSameDay = (value: string | null, referenceDate: Date): boolean => {
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

const buildDashboardMetrics = (tickets: SupportTicket[]): DashboardMetrics => {
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

const buildSupportNotifications = (
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

const getRoleLabel = (role: CurrentUser["role"]): string => {
  const labels: Record<CurrentUser["role"], string> = {
    admin: "Admin",
    supervisor: "Supervisor",
    atendente: "Atendente",
  };

  return labels[role];
};

const getUserPermissions = (role: CurrentUser["role"]): string[] => {
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

const buildUserDraft = (user: SupportUserSummary): UserDraft => ({
  whatsappPhone: user.whatsappPhone ?? "",
  active: user.active,
  password: "",
  transferToUserId: "",
});

const mergeUser = (
  users: SupportUserSummary[],
  nextUser: SupportUserSummary,
): SupportUserSummary[] =>
  users.map((user) => (user.id === nextUser.id ? nextUser : user));

const normalizeOptionalPhone = (phone: string): string | null => {
  const normalizedPhone = phone.replace(/\D/gu, "");

  return normalizedPhone.length > 0 ? normalizedPhone : null;
};

const requestJson = async <T,>(
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

const getCountForFilter = (
  tickets: SupportTicket[],
  filter: TicketFilter,
): number =>
  filter === "todos"
    ? tickets.length
    : tickets.filter((ticket) => ticket.status === filter).length;

const buildClientSummaries = (tickets: SupportTicket[]): ClientSummary[] => {
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

const ui = {
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
    border: 0,
    borderBottom: "3px solid transparent",
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
    maxHeight: "min(520px, calc(100dvh - 420px))",
    display: "grid",
    gap: 12,
    padding: "18px 18px 22px",
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  stickyCardFooter: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    justifyContent: "flex-end",
    borderTop: "1px solid #263542",
    padding: 18,
    background: "#0c141b",
  },
} satisfies Record<string, CSSProperties>;

export function SupportDashboard({ currentUser }: SupportDashboardProps) {
  const [data, setData] = useState<TicketWithMessages>({
    tickets: [],
    activeTicket: null,
    messages: [],
  });
  const [filter, setFilter] = useState<TicketFilter>("todos");
  const [activeView, setActiveView] = useState<AppView>("atendimentos");
  const [query, setQuery] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
  const [clientNotes, setClientNotes] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<SupportUserSummary[]>([]);
  const [settings, setSettings] = useState<SettingsView>(defaultSupportSettings);
  const [runtimeSettings, setRuntimeSettings] =
    useState<SettingsResponse["runtime"] | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    name: "",
    email: "",
    role: "atendente",
    password: "",
    whatsappPhone: "",
  });
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [composerTab, setComposerTab] = useState<"reply" | "note">("reply");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const fetchTickets = useCallback(async (
    ticketId?: string | null,
  ): Promise<TicketWithMessages> => {
    const params = ticketId ? `?ticketId=${encodeURIComponent(ticketId)}` : "";

    return requestJson<TicketWithMessages>(`/api/tickets${params}`);
  }, []);

  const loadTickets = useCallback(async (ticketId?: string | null) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const nextData = await fetchTickets(ticketId);
      setData(nextData);
      setSelectedTicketId(nextData.activeTicket?.id ?? null);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : "Erro ao carregar tickets";

      setError(nextError);
    } finally {
      setIsLoading(false);
    }
  }, [fetchTickets]);

  const refreshTickets = useCallback(async (ticketId?: string | null) => {
    try {
      const nextData = await fetchTickets(ticketId);

      setData(nextData);
      setSelectedTicketId((currentSelectedTicketId) => {
        const selectedTicketStillExists =
          currentSelectedTicketId &&
          nextData.tickets.some((ticket) => ticket.id === currentSelectedTicketId);

        if (selectedTicketStillExists) {
          return currentSelectedTicketId;
        }

        return nextData.activeTicket?.id ?? null;
      });
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : "Erro ao atualizar tickets";

      setError(nextError);
    }
  }, [fetchTickets]);

  const loadUsers = useCallback(async () => {
    setIsUsersLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await requestJson<UsersResponse>("/api/users");
      setUsers(response.users);
      setUserDrafts(
        Object.fromEntries(
          response.users.map((user) => [user.id, buildUserDraft(user)]),
        ),
      );
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : "Erro ao carregar usuários";

      setError(nextError);
    } finally {
      setIsUsersLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setIsSettingsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await requestJson<SettingsResponse>("/api/settings");
      setSettings(response.settings);
      setRuntimeSettings(response.runtime);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : "Erro ao carregar configurações";

      setError(nextError);
    } finally {
      setIsSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadTickets();
    });
  }, [loadTickets]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refreshTickets(selectedTicketId);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [refreshTickets, selectedTicketId]);

  useEffect(() => {
    const messagesElement = messagesRef.current;

    if (!messagesElement) {
      return;
    }

    messagesElement.scrollTo({
      top: messagesElement.scrollHeight,
      behavior: "smooth",
    });
  }, [data.activeTicket?.id, data.messages.length]);

  useEffect(() => {
    if (activeView !== "usuarios" || users.length > 0 || isUsersLoading) {
      return;
    }

    queueMicrotask(() => {
      void loadUsers();
    });
  }, [activeView, isUsersLoading, loadUsers, users.length]);

  useEffect(() => {
    if (activeView !== "configuracoes" || runtimeSettings || isSettingsLoading) {
      return;
    }

    queueMicrotask(() => {
      void loadSettings();
    });
  }, [activeView, isSettingsLoading, loadSettings, runtimeSettings]);

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredByStatus =
      filter === "todos"
        ? data.tickets
        : data.tickets.filter((ticket) => ticket.status === filter);

    if (!normalizedQuery) {
      return filteredByStatus;
    }

    return filteredByStatus.filter((ticket) => {
      const searchable = [
        getTicketName(ticket),
        getTicketIdentity(ticket),
        ticket.lastMessage ?? "",
        ticket.category ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [data.tickets, filter, query]);

  const clients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const summaries = buildClientSummaries(data.tickets);

    if (!normalizedQuery) {
      return summaries;
    }

    return summaries.filter((client) =>
      [
        client.name,
        client.identity,
        client.phone ?? "",
        client.lid ?? "",
        client.latestTicket.category ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [data.tickets, query]);

  const activeClient =
    clients.find((client) => client.key === selectedClientKey) ?? clients[0] ?? null;
  const dashboardMetrics = useMemo(
    () => buildDashboardMetrics(data.tickets),
    [data.tickets],
  );
  const notifications = useMemo(
    () => buildSupportNotifications(data.tickets, settings),
    [data.tickets, settings],
  );
  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) =>
      [
        user.name,
        user.email,
        user.role,
        user.whatsappPhone ?? "",
        user.active ? "ativo" : "inativo",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, users]);

  const runMutation = async (operation: () => Promise<void>) => {
    setIsMutating(true);
    setError(null);
    setNotice(null);

    try {
      await operation();
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : "Operação não concluída";

      setError(nextError);
    } finally {
      setIsMutating(false);
    }
  };

  const handleSelectTicket = (ticketId: string) => {
    setActiveView("atendimentos");
    setSelectedTicketId(ticketId);
    void loadTickets(ticketId);
  };

  const handleSelectClientTicket = (ticketId: string) => {
    setActiveView("atendimentos");
    setFilter("todos");
    setSelectedTicketId(ticketId);
    void loadTickets(ticketId);
  };

  const handleSelectNotification = (notification: SupportNotification) => {
    setIsNotificationsOpen(false);

    if (!notification.ticketId) {
      return;
    }

    handleSelectTicket(notification.ticketId);
  };

  const handleUpdateUserDraft = (
    userId: string,
    nextDraft: Partial<UserDraft>,
  ) => {
    setUserDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: {
        ...(currentDrafts[userId] ?? {
          whatsappPhone: "",
          active: true,
          password: "",
          transferToUserId: "",
        }),
        ...nextDraft,
      },
    }));
  };

  const handleCreateUser = () => {
    void runMutation(async () => {
      const response = await requestJson<UserResponse>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createUserForm,
          whatsappPhone: normalizeOptionalPhone(createUserForm.whatsappPhone),
        }),
      });

      setUsers((currentUsers) => [...currentUsers, response.user]);
      setUserDrafts((currentDrafts) => ({
        ...currentDrafts,
        [response.user.id]: buildUserDraft(response.user),
      }));
      setCreateUserForm({
        name: "",
        email: "",
        role: "atendente",
        password: "",
        whatsappPhone: "",
      });
      setNotice(`Usuário ${response.user.name} cadastrado.`);
    });
  };

  const handleSaveUser = (user: SupportUserSummary) => {
    const draft = userDrafts[user.id] ?? buildUserDraft(user);

    void runMutation(async () => {
      const response = await requestJson<UserResponse>(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappPhone: normalizeOptionalPhone(draft.whatsappPhone),
          active: draft.active,
        }),
      });

      setUsers((currentUsers) => mergeUser(currentUsers, response.user));
      setUserDrafts((currentDrafts) => ({
        ...currentDrafts,
        [response.user.id]: {
          ...buildUserDraft(response.user),
          password: currentDrafts[response.user.id]?.password ?? "",
          transferToUserId: currentDrafts[response.user.id]?.transferToUserId ?? "",
        },
      }));
      setNotice(`Usuário ${response.user.name} atualizado.`);
    });
  };

  const handleResetUserPassword = (user: SupportUserSummary) => {
    const draft = userDrafts[user.id] ?? buildUserDraft(user);

    void runMutation(async () => {
      const response = await requestJson<UserResponse>(
        `/api/users/${user.id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: draft.password }),
        },
      );

      setUsers((currentUsers) => mergeUser(currentUsers, response.user));
      setUserDrafts((currentDrafts) => ({
        ...currentDrafts,
        [response.user.id]: {
          ...(currentDrafts[response.user.id] ?? buildUserDraft(response.user)),
          password: "",
        },
      }));
      setNotice(`Senha de ${response.user.name} redefinida.`);
    });
  };

  const handleTransferTickets = (user: SupportUserSummary) => {
    const draft = userDrafts[user.id] ?? buildUserDraft(user);

    void runMutation(async () => {
      const response = await requestJson<TransferTicketsResponse>(
        `/api/users/${user.id}/transfer-tickets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toUserId: draft.transferToUserId }),
        },
      );

      await refreshTickets(selectedTicketId);
      setNotice(
        `${response.transferredCount} atendimento(s) transferido(s) de ${user.name}.`,
      );
    });
  };

  const handleUpdateSettings = (
    nextSettings: Partial<SettingsView>,
  ) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      ...nextSettings,
    }));
  };

  const handleSaveSettings = () => {
    void runMutation(async () => {
      const response = await requestJson<SettingsResponse>("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      setSettings(response.settings);
      setRuntimeSettings(response.runtime);
      setNotice("Configurações salvas.");
    });
  };

  const handleAssign = () => {
    if (!data.activeTicket) {
      return;
    }

    void runMutation(async () => {
      await requestJson(`/api/tickets/${data.activeTicket?.id}/assign`, {
        method: "POST",
      });
      await loadTickets(data.activeTicket?.id);
    });
  };

  const handleFinish = () => {
    if (!data.activeTicket) {
      return;
    }

    void runMutation(async () => {
      await requestJson(`/api/tickets/${data.activeTicket?.id}/finish`, {
        method: "POST",
      });
      await loadTickets(data.activeTicket?.id);
    });
  };

  const handleSendMessage = () => {
    const trimmedMessage = message.trim();

    if (!data.activeTicket || !trimmedMessage) {
      return;
    }

    void runMutation(async () => {
      await requestJson<{ message: SupportMessage }>(
        `/api/tickets/${data.activeTicket?.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmedMessage }),
        },
      );
      setMessage("");
      await loadTickets(data.activeTicket?.id);
    });
  };

  const handleLogout = () => {
    void runMutation(async () => {
      await requestJson("/api/auth/logout", { method: "POST" });
      window.location.reload();
    });
  };

  const activeTicket = data.activeTicket;
  const activeTicketName = activeTicket ? getTicketName(activeTicket) : "";
  const canSendToActiveCustomer = activeTicket
    ? canSendToCustomerPhone(activeTicket.customerPhone)
    : false;
  const canAssignTicket = activeTicket?.status === "em_fila";
  const canFinishTicket = activeTicket?.status === "em_atendimento";
  const canWriteToTicket =
    activeTicket?.status === "em_atendimento" && canSendToActiveCustomer;
  const assignedToLabel =
    activeTicket?.assignedTo === currentUser.id
      ? currentUser.name
      : activeTicket?.assignedTo ?? "-";
  const composerHint = (() => {
    if (!activeTicket) {
      return "Selecione um atendimento para responder.";
    }

    if (!canSendToActiveCustomer) {
      return "Este contato chegou como LID do WhatsApp. Ainda não temos o número real para enviar mensagens pelo hub.";
    }

    if (activeTicket.status === "em_fila") {
      return "Assuma o atendimento para liberar a resposta.";
    }

    if (activeTicket.status === "aguardando_feedback") {
      return "Atendimento finalizado. Agora o sistema aguarda a nota do cliente.";
    }

    if (activeTicket.status === "aguardando_feedback_comentario") {
      return "Nota recebida. Agora o sistema aguarda um comentário opcional do cliente.";
    }

    if (activeTicket.status === "finalizado") {
      return "Este atendimento já foi finalizado.";
    }

    return null;
  })();
  const assignButtonLabel = canAssignTicket
    ? "Assumir atendimento"
    : activeTicket?.assignedTo
      ? "Atendimento assumido"
      : "Assumir atendimento";
  const pageTitle =
    activeView === "clientes"
      ? "Clientes"
      : activeView === "dashboard"
        ? "Dashboard"
        : activeView === "usuarios"
          ? "Usuários"
          : activeView === "configuracoes"
            ? "Configurações"
        : "Atendimentos";
  const pageSubtitle =
    activeView === "clientes"
      ? `${clients.length} clientes no histórico`
      : activeView === "dashboard"
        ? "Operação do suporte em tempo real"
        : activeView === "usuarios"
          ? `${users.length} usuários cadastrados`
          : activeView === "configuracoes"
            ? "Regras do hub e integrações"
        : `${data.tickets.length} conversas no hub`;
  const searchPlaceholder =
    activeView === "clientes"
      ? "Buscar cliente..."
      : activeView === "dashboard"
        ? "Buscar atendimento..."
        : activeView === "usuarios"
          ? "Buscar usuário..."
          : activeView === "configuracoes"
            ? "Buscar configuração..."
        : "Buscar atendimento...";

  return (
    <main className={styles.shell} style={ui.shell} data-hub-shell>
      <aside className={styles.sidebar} style={ui.sidebar} data-hub-sidebar>
        <div className={styles.logo} style={ui.logo}>aiqfome</div>
        <nav className={styles.navigation} style={ui.navigation} aria-label="Menu principal">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.view === activeView;

            return (
              <button
                key={item.label}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
                style={{ ...ui.navItem, ...(isActive ? ui.navItemActive : {}) }}
                onClick={() => {
                  if (item.view) {
                    setActiveView(item.view);
                  }
                }}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className={styles.userCard} style={ui.userCard}>
          <div className={styles.userAvatar} style={ui.userAvatar}>
            {getInitial(currentUser.name)}
          </div>
          <div>
            <strong>{currentUser.name}</strong>
            <span style={ui.mutedText}>{statusLabels.em_atendimento}</span>
          </div>
          <span className={styles.onlineDot} style={ui.onlineDot} />
        </div>
      </aside>

      <section className={styles.workspace} style={ui.workspace} data-hub-workspace>
        <header className={styles.topbar} style={ui.topbar} data-hub-topbar>
          <div>
            <h1 style={ui.title}>{pageTitle}</h1>
            <p style={ui.mutedText}>{pageSubtitle}</p>
          </div>
          <div className={styles.topbarActions} style={ui.topbarActions}>
            <label className={styles.searchBox} style={ui.searchBox}>
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                style={ui.searchInput}
              />
            </label>
            <button className={styles.iconButton} style={ui.iconButton} title="Filtros">
              <SlidersHorizontal size={18} />
            </button>
            <div style={ui.notificationWrapper}>
              <button
                className={styles.iconButton}
                style={ui.iconButton}
                title="Notificações"
                onClick={() =>
                  setIsNotificationsOpen((currentValue) => !currentValue)
                }
              >
                <Bell size={18} />
                {notifications.length > 0 ? (
                  <span className={styles.notificationBadge} style={ui.badge}>
                    {notifications.length}
                  </span>
                ) : null}
              </button>
              {isNotificationsOpen ? (
                <section style={ui.notificationPanel}>
                  <header style={ui.notificationPanelHeader}>
                    <strong>Avisos</strong>
                    <span style={ui.mutedText}>
                      {notifications.length} pendência(s)
                    </span>
                  </header>
                  <div style={ui.notificationList}>
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        style={ui.notificationItem}
                        onClick={() => handleSelectNotification(notification)}
                      >
                        <span
                          style={{
                            ...ui.notificationTone,
                            ...(notification.tone === "danger"
                              ? ui.notificationToneDanger
                              : {}),
                            ...(notification.tone === "warning"
                              ? ui.notificationToneWarning
                              : {}),
                          }}
                        />
                        <span>
                          <strong>{notification.title}</strong>
                          <p style={{ ...ui.mutedText, marginTop: 4 }}>
                            {notification.description}
                          </p>
                          <span style={{ ...ui.mutedText, marginTop: 8 }}>
                            {formatDateTime(notification.createdAt)}
                          </span>
                        </span>
                      </button>
                    ))}
                    {notifications.length === 0 ? (
                      <div className={styles.emptyState} style={ui.emptyState}>
                        Nenhum aviso no momento.
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </header>

        {activeView === "dashboard" ? (
          <>
            <div className={styles.filterTabs} style={ui.filterTabs} data-hub-filter-tabs>
              <button
                className={`${styles.filterTab} ${styles.filterTabActive}`}
                style={{ ...ui.filterTab, ...ui.filterTabActive }}
              >
                Hoje
              </button>
              <button className={styles.filterTab} style={ui.filterTab}>
                Tempo real
                <span style={ui.countPill}>{data.tickets.length}</span>
              </button>
            </div>

            {error ? <div className={styles.error} style={ui.error}>{error}</div> : null}
            {notice ? <div style={ui.notice}>{notice}</div> : null}

            <div style={ui.dashboardGrid}>
              <section style={ui.dashboardMain}>
                <div style={ui.dashboardMetrics}>
                  <article style={ui.dashboardMetricCard}>
                    <span style={ui.mutedText}>Em fila</span>
                    <div style={ui.dashboardMetricValue}>
                      {dashboardMetrics.queueTickets.length}
                    </div>
                    <p style={ui.mutedText}>Aguardando atendimento</p>
                  </article>
                  <article style={ui.dashboardMetricCard}>
                    <span style={ui.mutedText}>Em atendimento</span>
                    <div style={ui.dashboardMetricValue}>
                      {dashboardMetrics.activeTickets.length}
                    </div>
                    <p style={ui.mutedText}>Com atendente ativo</p>
                  </article>
                  <article style={ui.dashboardMetricCard}>
                    <span style={ui.mutedText}>Primeira resposta média</span>
                    <div style={ui.dashboardMetricValue}>
                      {formatDuration(dashboardMetrics.averageFirstResponseMs)}
                    </div>
                    <p style={ui.mutedText}>Do ticket até a primeira resposta humana</p>
                  </article>
                  <article style={ui.dashboardMetricCard}>
                    <span style={ui.mutedText}>Finalizados hoje</span>
                    <div style={ui.dashboardMetricValue}>{dashboardMetrics.finishedToday}</div>
                    <p style={ui.mutedText}>Atendimentos encerrados</p>
                  </article>
                </div>

                <div style={ui.dashboardMetrics}>
                  <article style={ui.dashboardMetricCard}>
                    <span style={ui.mutedText}>Resolução média</span>
                    <div style={ui.dashboardMetricValue}>
                      {formatDuration(dashboardMetrics.averageResolutionMs)}
                    </div>
                    <p style={ui.mutedText}>Da abertura até finalizar</p>
                  </article>
                  <article style={ui.dashboardMetricCard}>
                    <span style={ui.mutedText}>Aguardando feedback</span>
                    <div style={ui.dashboardMetricValue}>{dashboardMetrics.waitingFeedback}</div>
                    <p style={ui.mutedText}>Esperando nota do cliente</p>
                  </article>
                  <article style={ui.dashboardMetricCard}>
                    <span style={ui.mutedText}>Nota média</span>
                    <div style={ui.dashboardMetricValue}>
                      {dashboardMetrics.averageFeedback
                        ? dashboardMetrics.averageFeedback.toFixed(1)
                        : "-"}
                    </div>
                    <p style={ui.mutedText}>Baseada nos feedbacks recebidos</p>
                  </article>
                  <article style={ui.dashboardMetricCard}>
                    <span style={ui.mutedText}>Pendentes</span>
                    <div style={ui.dashboardMetricValue}>
                      {dashboardMetrics.queueTickets.length +
                        dashboardMetrics.activeTickets.length +
                        dashboardMetrics.waitingFeedback}
                    </div>
                    <p style={ui.mutedText}>Não finalizados</p>
                  </article>
                </div>

                <div style={ui.dashboardTwoColumns}>
                  <section style={ui.detailCard}>
                    <header style={ui.detailHeader}>
                      <h2 style={{ fontSize: 15 }}>Fila crítica</h2>
                    </header>
                    {dashboardMetrics.criticalQueue.map(({ ticket, waitingMs }) => (
                      <button
                        key={ticket.id}
                        style={{
                          ...ui.ticketButton,
                          gridTemplateColumns: "38px minmax(0, 1fr) auto",
                        }}
                        onClick={() => handleSelectTicket(ticket.id)}
                      >
                        <div style={{ ...ui.ticketCode, ...ui.queueCode }}>
                          {getTicketCode(ticket)}
                        </div>
                        <div>
                          <strong>{getTicketName(ticket)}</strong>
                          <p style={ui.mutedText}>{ticket.lastMessage ?? "Sem mensagens"}</p>
                        </div>
                        <span style={ui.mutedText}>
                          {formatDuration(waitingMs)}
                        </span>
                      </button>
                    ))}
                    {dashboardMetrics.criticalQueue.length === 0 ? (
                      <div className={styles.emptyState} style={ui.emptyState}>
                        Nenhum atendimento aguardando na fila.
                      </div>
                    ) : null}
                  </section>

                  <section style={ui.detailCard}>
                    <header style={ui.detailHeader}>
                      <h2 style={{ fontSize: 15 }}>Atendentes</h2>
                    </header>
                    {dashboardMetrics.attendantRows.map((attendant) => (
                      <div key={attendant.label} style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <strong>{attendant.label === currentUser.id ? currentUser.name : attendant.label}</strong>
                          <span style={ui.mutedText}>
                            {attendant.openTickets} aberto(s) · {attendant.finishedTickets} fim
                          </span>
                        </div>
                        <div style={{ ...ui.progressTrack, marginTop: 10 }}>
                          <div
                            style={{
                              ...ui.progressFill,
                              width: `${Math.min(
                                100,
                                (attendant.openTickets + attendant.finishedTickets) * 20,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {dashboardMetrics.attendantRows.length === 0 ? (
                      <div className={styles.emptyState} style={ui.emptyState}>
                        Nenhum atendimento assumido ainda.
                      </div>
                    ) : null}
                  </section>
                </div>
              </section>

              <aside style={ui.detailsColumn}>
                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Status da operação</h2>
                  </header>
                  {filters.map((item) => (
                    <div key={item.value} style={ui.detailRow}>
                      <span style={ui.mutedText}>{item.label}</span>
                      <strong>{getCountForFilter(data.tickets, item.value)}</strong>
                    </div>
                  ))}
                </section>

                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Meta de primeira resposta</h2>
                  </header>
                  <div style={{ padding: 18 }}>
                    <div style={{ ...ui.progressTrack, marginBottom: 12 }}>
                      <div
                        style={{
                          ...ui.progressFill,
                          width:
                            dashboardMetrics.averageFirstResponseMs === null
                              ? "0%"
                              : `${Math.max(
                                  5,
                                  Math.min(
                                    100,
                                    100 -
                                      (dashboardMetrics.averageFirstResponseMs / 1_800_000) * 100,
                                  ),
                                )}%`,
                        }}
                      />
                    </div>
                    <strong>
                      {formatDuration(dashboardMetrics.averageFirstResponseMs)}
                    </strong>
                    <p style={ui.mutedText}>Referência visual usando meta de 30 minutos.</p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : activeView === "configuracoes" ? (
          <>
            <div className={styles.filterTabs} style={ui.filterTabs} data-hub-filter-tabs>
              <button
                className={`${styles.filterTab} ${styles.filterTabActive}`}
                style={{ ...ui.filterTab, ...ui.filterTabActive }}
              >
                Atendimento
              </button>
              <button className={styles.filterTab} style={ui.filterTab}>
                Evolution
              </button>
            </div>

            {error ? <div className={styles.error} style={ui.error}>{error}</div> : null}
            {notice ? <div style={ui.notice}>{notice}</div> : null}

            <div style={ui.dashboardGrid}>
              <section style={ui.dashboardMain}>
                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Tempos operacionais</h2>
                    <Badge tone="neutral">minutos</Badge>
                  </header>
                  <div style={ui.compactFormGrid}>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Fila crítica</span>
                      <TextField
                        type="number"
                        min={1}
                        max={240}
                        value={settings.queueCriticalMinutes}
                        onChange={(event) =>
                          handleUpdateSettings({
                            queueCriticalMinutes: Number(event.target.value),
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                      />
                    </label>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Atendimento parado</span>
                      <TextField
                        type="number"
                        min={1}
                        max={240}
                        value={settings.staleTicketMinutes}
                        onChange={(event) =>
                          handleUpdateSettings({
                            staleTicketMinutes: Number(event.target.value),
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                      />
                    </label>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Urgência sem primeira resposta</span>
                      <TextField
                        type="number"
                        min={1}
                        max={480}
                        value={settings.urgentUnansweredMinutes}
                        onChange={(event) =>
                          handleUpdateSettings({
                            urgentUnansweredMinutes: Number(event.target.value),
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                      />
                    </label>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Expirar feedback sem nota</span>
                      <TextField
                        type="number"
                        min={1}
                        max={10080}
                        value={settings.feedbackExpirationMinutes}
                        onChange={(event) =>
                          handleUpdateSettings({
                            feedbackExpirationMinutes: Number(event.target.value),
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                      />
                    </label>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Nota baixa até</span>
                      <TextField
                        type="number"
                        min={1}
                        max={5}
                        value={settings.lowFeedbackScore}
                        onChange={(event) =>
                          handleUpdateSettings({
                            lowFeedbackScore: Number(event.target.value),
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                      />
                    </label>
                  </div>
                </section>

                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Mensagens automáticas</h2>
                  </header>
                  <div style={ui.scrollableCardBody}>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Abertura do atendimento</span>
                      <textarea
                        value={settings.openingMessage}
                        onChange={(event) =>
                          handleUpdateSettings({ openingMessage: event.target.value })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                        style={{ ...ui.noteBox, width: "100%" }}
                      />
                    </label>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Finalização e pedido de nota</span>
                      <textarea
                        value={settings.finishMessage}
                        onChange={(event) =>
                          handleUpdateSettings({ finishMessage: event.target.value })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                        style={{ ...ui.noteBox, width: "100%" }}
                      />
                    </label>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Pedido de comentário após a nota</span>
                      <textarea
                        value={settings.feedbackCommentPromptMessage}
                        onChange={(event) =>
                          handleUpdateSettings({
                            feedbackCommentPromptMessage: event.target.value,
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                        style={{ ...ui.noteBox, width: "100%" }}
                      />
                    </label>
                    <label style={ui.formLabel}>
                      <span style={ui.mutedText}>Agradecimento do feedback</span>
                      <textarea
                        value={settings.feedbackThanksMessage}
                        onChange={(event) =>
                          handleUpdateSettings({
                            feedbackThanksMessage: event.target.value,
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                        style={{ ...ui.noteBox, width: "100%" }}
                      />
                    </label>
                  </div>
                  <footer style={ui.stickyCardFooter}>
                    <Button
                      variant="primary"
                      onClick={handleSaveSettings}
                      disabled={currentUser.role !== "admin" || isMutating}
                    >
                      <LoadingLabel
                        isLoading={isMutating}
                        label="Salvar configurações"
                        loadingLabel="Salvando..."
                      />
                    </Button>
                  </footer>
                </section>
              </section>

              <aside style={ui.detailsColumn}>
                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Evolution API</h2>
                  </header>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>URL</span>
                    <strong>{runtimeSettings?.evolutionApiUrl ?? "-"}</strong>
                  </div>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Instância</span>
                    <strong>{runtimeSettings?.evolutionInstanceName ?? "-"}</strong>
                  </div>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Webhook</span>
                    <Badge tone={runtimeSettings?.webhookConfigured ? "success" : "danger"}>
                      {runtimeSettings?.webhookConfigured ? "Configurado" : "Pendente"}
                    </Badge>
                  </div>
                  <Button
                    fullWidth
                    style={{ margin: "12px 18px 0", width: "calc(100% - 36px)" }}
                    onClick={() =>
                      window.open(
                        runtimeSettings
                          ? `${runtimeSettings.evolutionApiUrl}/manager`
                          : "/manager",
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    Abrir Manager
                    <ExternalLink size={15} />
                  </Button>
                </section>

                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Avisos aos atendentes</h2>
                  </header>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Grupo</span>
                    <strong>{runtimeSettings?.attendantGroupJid ?? "Não configurado"}</strong>
                  </div>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Número fallback</span>
                    <strong>
                      {runtimeSettings?.attendantWhatsappNumber ?? "Não configurado"}
                    </strong>
                  </div>
                  {isSettingsLoading ? (
                    <div className={styles.emptyState} style={ui.emptyState}>
                      Carregando configurações...
                    </div>
                  ) : null}
                </section>
              </aside>
            </div>
          </>
        ) : activeView === "usuarios" ? (
          <>
            <div className={styles.filterTabs} style={ui.filterTabs} data-hub-filter-tabs>
              <button
                className={`${styles.filterTab} ${styles.filterTabActive}`}
                style={{ ...ui.filterTab, ...ui.filterTabActive }}
              >
                Todos
                <span style={ui.countPill}>{users.length}</span>
              </button>
              <button className={styles.filterTab} style={ui.filterTab}>
                Ativos
                <span style={ui.countPill}>
                  {users.filter((user) => user.active).length}
                </span>
              </button>
              <button className={styles.filterTab} style={ui.filterTab}>
                Sem WhatsApp
                <span style={ui.countPill}>
                  {users.filter((user) => !user.whatsappPhone).length}
                </span>
              </button>
            </div>

            {error ? <div className={styles.error} style={ui.error}>{error}</div> : null}
            {notice ? <div style={ui.notice}>{notice}</div> : null}

            <div style={ui.usersGrid}>
              <section style={ui.usersList}>
                {visibleUsers.map((user) => {
                  const permissions = getUserPermissions(user.role);
                  const draft = userDrafts[user.id] ?? buildUserDraft(user);
                  const transferableUsers = users.filter(
                    (candidateUser) => candidateUser.id !== user.id && candidateUser.active,
                  );
                  const canManageUsers = currentUser.role === "admin";
                  const canTransferTickets =
                    currentUser.role === "admin" || currentUser.role === "supervisor";

                  return (
                    <article key={user.id} style={ui.userManagementCard}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "44px minmax(0, 1fr) auto",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <div style={{ ...ui.userAvatar, width: 44, height: 44 }}>
                          {getInitial(user.name)}
                        </div>
                        <div>
                          <h2 style={{ fontSize: 17 }}>{user.name}</h2>
                          <p style={ui.mutedText}>{user.email}</p>
                        </div>
                        <Badge tone={user.active ? "success" : "neutral"}>
                          {user.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      <div style={{ ...ui.detailRow, padding: "14px 0 0" }}>
                        <span style={ui.mutedText}>Perfil</span>
                        <strong>{getRoleLabel(user.role)}</strong>
                      </div>
                      <div style={{ ...ui.detailRow, padding: "8px 0 0" }}>
                        <span style={ui.mutedText}>WhatsApp</span>
                        <strong>{user.whatsappPhone ?? "Não vinculado"}</strong>
                      </div>

                      <div style={{ ...ui.formGrid, marginTop: 14 }}>
                        <TextField
                          value={draft.whatsappPhone}
                          onChange={(event) =>
                            handleUpdateUserDraft(user.id, {
                              whatsappPhone: event.target.value,
                            })
                          }
                          placeholder="WhatsApp do atendente"
                          disabled={!canManageUsers || isMutating}
                        />
                        <ToggleField>
                          <input
                            type="checkbox"
                            checked={draft.active}
                            onChange={(event) =>
                              handleUpdateUserDraft(user.id, {
                                active: event.target.checked,
                              })
                            }
                            disabled={!canManageUsers || isMutating}
                          />
                          Usuário ativo
                        </ToggleField>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <Button
                          style={{ flex: 1 }}
                          onClick={() => handleSaveUser(user)}
                          disabled={!canManageUsers || isMutating}
                        >
                          <LoadingLabel
                            isLoading={isMutating}
                            label="Salvar usuário"
                            loadingLabel="Salvando..."
                          />
                        </Button>
                        <TextField
                          value={draft.password}
                          onChange={(event) =>
                            handleUpdateUserDraft(user.id, {
                              password: event.target.value,
                            })
                          }
                          placeholder="Nova senha"
                          type="password"
                          disabled={!canManageUsers || isMutating}
                          style={{ flex: 1 }}
                        />
                        <Button
                          onClick={() => handleResetUserPassword(user)}
                          disabled={!canManageUsers || draft.password.length < 8 || isMutating}
                        >
                          <LoadingLabel
                            isLoading={isMutating}
                            label="Resetar"
                            loadingLabel="Resetando..."
                          />
                        </Button>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <SelectField
                          value={draft.transferToUserId}
                          onChange={(event) =>
                            handleUpdateUserDraft(user.id, {
                              transferToUserId: event.target.value,
                            })
                          }
                          disabled={!canTransferTickets || isMutating}
                          style={{ flex: 1 }}
                        >
                          <option value="">Transferir tickets para...</option>
                          {transferableUsers.map((candidateUser) => (
                            <option key={candidateUser.id} value={candidateUser.id}>
                              {candidateUser.name}
                            </option>
                          ))}
                        </SelectField>
                        <Button
                          onClick={() => handleTransferTickets(user)}
                          disabled={
                            !canTransferTickets ||
                            !draft.transferToUserId ||
                            isMutating
                          }
                        >
                          <LoadingLabel
                            isLoading={isMutating}
                            label="Transferir"
                            loadingLabel="Transferindo..."
                          />
                        </Button>
                      </div>

                      <div style={ui.permissionGrid}>
                        {permissions.map((permission) => (
                          <span key={permission} style={ui.permissionPill}>
                            {permission}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
                {!isUsersLoading && visibleUsers.length === 0 ? (
                  <div className={styles.emptyState} style={ui.emptyState}>
                    Nenhum usuário encontrado.
                  </div>
                ) : null}
                {isUsersLoading ? (
                  <div className={styles.emptyState} style={ui.emptyState}>
                    Carregando usuários...
                  </div>
                ) : null}
              </section>

              <aside style={ui.detailsColumn}>
                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Gestão de acessos</h2>
                  </header>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Admins</span>
                    <strong>{users.filter((user) => user.role === "admin").length}</strong>
                  </div>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Supervisores</span>
                    <strong>
                      {users.filter((user) => user.role === "supervisor").length}
                    </strong>
                  </div>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Atendentes</span>
                    <strong>
                      {users.filter((user) => user.role === "atendente").length}
                    </strong>
                  </div>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>WhatsApp vinculado</span>
                    <strong>
                      {users.filter((user) => Boolean(user.whatsappPhone)).length}
                    </strong>
                  </div>
                </section>

                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Cadastrar atendente</h2>
                  </header>
                  <div style={{ display: "grid", gap: 10, padding: 18 }}>
                    <TextField
                      value={createUserForm.name}
                      onChange={(event) =>
                        setCreateUserForm((currentForm) => ({
                          ...currentForm,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Nome"
                      disabled={currentUser.role !== "admin" || isMutating}
                    />
                    <TextField
                      value={createUserForm.email}
                      onChange={(event) =>
                        setCreateUserForm((currentForm) => ({
                          ...currentForm,
                          email: event.target.value,
                        }))
                      }
                      placeholder="E-mail"
                      disabled={currentUser.role !== "admin" || isMutating}
                    />
                    <SelectField
                      value={createUserForm.role}
                      onChange={(event) =>
                        setCreateUserForm((currentForm) => ({
                          ...currentForm,
                          role: event.target.value as CurrentUser["role"],
                        }))
                      }
                      disabled={currentUser.role !== "admin" || isMutating}
                    >
                      <option value="atendente">Atendente</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </SelectField>
                    <TextField
                      value={createUserForm.whatsappPhone}
                      onChange={(event) =>
                        setCreateUserForm((currentForm) => ({
                          ...currentForm,
                          whatsappPhone: event.target.value,
                        }))
                      }
                      placeholder="WhatsApp"
                      disabled={currentUser.role !== "admin" || isMutating}
                    />
                    <TextField
                      value={createUserForm.password}
                      onChange={(event) =>
                        setCreateUserForm((currentForm) => ({
                          ...currentForm,
                          password: event.target.value,
                        }))
                      }
                      placeholder="Senha inicial"
                      type="password"
                      disabled={currentUser.role !== "admin" || isMutating}
                    />
                    <Button
                      variant="primary"
                      onClick={handleCreateUser}
                      disabled={
                        currentUser.role !== "admin" ||
                        createUserForm.name.trim().length < 2 ||
                        createUserForm.password.length < 8 ||
                        !createUserForm.email.includes("@") ||
                        isMutating
                      }
                    >
                      <LoadingLabel
                        isLoading={isMutating}
                        label="Cadastrar usuário"
                        loadingLabel="Cadastrando..."
                      />
                    </Button>
                    {currentUser.role !== "admin" ? (
                      <p style={ui.mutedText}>
                        Apenas admins podem cadastrar, editar, resetar senha e desativar usuários.
                      </p>
                    ) : null}
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : activeView === "clientes" ? (
          <>
            <div className={styles.filterTabs} style={ui.filterTabs} data-hub-filter-tabs>
              <button
                className={`${styles.filterTab} ${styles.filterTabActive}`}
                style={{ ...ui.filterTab, ...ui.filterTabActive }}
              >
                Todos os clientes
                <span style={ui.countPill}>{clients.length}</span>
              </button>
            </div>

            {error ? <div className={styles.error} style={ui.error}>{error}</div> : null}
            {notice ? <div style={ui.notice}>{notice}</div> : null}

            <div style={ui.clientsGrid}>
              <aside style={ui.clientList}>
                {clients.map((client) => {
                  const isSelected = activeClient?.key === client.key;

                  return (
                    <button
                      key={client.key}
                      style={{
                        ...ui.clientButton,
                        ...(isSelected ? ui.ticketButtonActive : {}),
                      }}
                      onClick={() => setSelectedClientKey(client.key)}
                    >
                      <div style={{ ...ui.ticketCode, ...ui.activeCode }}>
                        {getInitial(client.name)}
                      </div>
                      <div>
                        <strong>{client.name}</strong>
                        <p style={ui.mutedText}>{client.identity}</p>
                        <p style={ui.mutedText}>
                          {client.openTickets} aberto(s) · {client.finishedTickets} finalizado(s)
                        </p>
                      </div>
                    </button>
                  );
                })}
                {!isLoading && clients.length === 0 ? (
                  <div className={styles.emptyState} style={ui.emptyState}>
                    Nenhum cliente encontrado.
                  </div>
                ) : null}
              </aside>

              <section style={ui.profilePanel}>
                {activeClient ? (
                  <>
                    <header style={ui.profileHeader}>
                      <div style={{ ...ui.ticketCode, ...ui.activeCode, width: 52, height: 52 }}>
                        {getInitial(activeClient.name)}
                      </div>
                      <div>
                        <h2>{activeClient.name}</h2>
                        <p style={ui.mutedText}>{activeClient.identity}</p>
                      </div>
                    </header>

                    <div style={ui.profileBody}>
                      <div style={ui.metricGrid}>
                        <div style={ui.metricCard}>
                          <span style={ui.mutedText}>Atendimentos</span>
                          <h2>{activeClient.tickets.length}</h2>
                        </div>
                        <div style={ui.metricCard}>
                          <span style={ui.mutedText}>Em aberto</span>
                          <h2>{activeClient.openTickets}</h2>
                        </div>
                        <div style={ui.metricCard}>
                          <span style={ui.mutedText}>Finalizados</span>
                          <h2>{activeClient.finishedTickets}</h2>
                        </div>
                        <div style={ui.metricCard}>
                          <span style={ui.mutedText}>Nota média</span>
                          <h2>
                            {activeClient.averageFeedback
                              ? activeClient.averageFeedback.toFixed(1)
                              : "-"}
                          </h2>
                        </div>
                      </div>

                      <section style={ui.detailCard}>
                        <header style={ui.detailHeader}>
                          <h2 style={{ fontSize: 15 }}>Dados do cliente</h2>
                        </header>
                        <div style={ui.detailRow}>
                          <span style={ui.mutedText}>Telefone</span>
                          <strong>{activeClient.phone ?? "Não resolvido"}</strong>
                        </div>
                        <div style={ui.detailRow}>
                          <span style={ui.mutedText}>LID</span>
                          <strong>{activeClient.lid ?? "-"}</strong>
                        </div>
                        <div style={ui.detailRow}>
                          <span style={ui.mutedText}>Último atendimento</span>
                          <strong>{formatDateTime(activeClient.latestTicket.updatedAt)}</strong>
                        </div>
                      </section>

                      <section style={ui.detailCard}>
                        <header style={ui.detailHeader}>
                          <h2 style={{ fontSize: 15 }}>Observações internas</h2>
                        </header>
                        <div style={{ padding: 18 }}>
                          <textarea
                            value={clientNotes[activeClient.key] ?? ""}
                            onChange={(event) =>
                              setClientNotes((currentNotes) => ({
                                ...currentNotes,
                                [activeClient.key]: event.target.value,
                              }))
                            }
                            placeholder="Adicione uma observação sobre este cliente..."
                            style={{ ...ui.noteBox, width: "100%" }}
                          />
                        </div>
                      </section>

                      <section style={ui.detailCard}>
                        <header style={ui.detailHeader}>
                          <h2 style={{ fontSize: 15 }}>Histórico de atendimentos</h2>
                        </header>
                        {activeClient.tickets.map((ticket) => (
                          <button
                            key={ticket.id}
                            style={{
                              ...ui.ticketButton,
                              gridTemplateColumns: "38px minmax(0, 1fr) auto",
                            }}
                            onClick={() => handleSelectClientTicket(ticket.id)}
                          >
                            <div style={{ ...ui.ticketCode, ...ui.doneCode }}>
                              {getTicketCode(ticket)}
                            </div>
                            <div>
                              <strong>{statusLabels[ticket.status]}</strong>
                              <p style={ui.mutedText}>{ticket.lastMessage ?? "Sem mensagens"}</p>
                            </div>
                            <span style={ui.mutedText}>{formatDateTime(ticket.updatedAt)}</span>
                          </button>
                        ))}
                      </section>
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyState} style={ui.emptyState}>
                    Selecione um cliente.
                  </div>
                )}
              </section>

              <aside style={ui.detailsColumn}>
                <section style={ui.detailCard}>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Resumo</h2>
                  </header>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Clientes</span>
                    <strong>{clients.length}</strong>
                  </div>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Com ticket aberto</span>
                    <strong>{clients.filter((client) => client.openTickets > 0).length}</strong>
                  </div>
                  <div style={ui.detailRow}>
                    <span style={ui.mutedText}>Sem telefone resolvido</span>
                    <strong>{clients.filter((client) => !client.phone).length}</strong>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : (
          <>
            <div className={styles.filterTabs} style={ui.filterTabs} data-hub-filter-tabs>
          {filters.map((item) => (
            <button
              key={item.value}
              className={`${styles.filterTab} ${
                filter === item.value ? styles.filterTabActive : ""
              }`}
              style={{
                ...ui.filterTab,
                ...(filter === item.value ? ui.filterTabActive : {}),
              }}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span style={ui.countPill}>{getCountForFilter(data.tickets, item.value)}</span>
            </button>
          ))}
            </div>

            {error ? <div className={styles.error} style={ui.error}>{error}</div> : null}
            {notice ? <div style={ui.notice}>{notice}</div> : null}

            <div className={styles.contentGrid} style={ui.contentGrid} data-hub-content-grid>
          <aside className={styles.ticketColumn} style={ui.ticketColumn} data-hub-ticket-column>
            {statusSections.map((section) => {
              const sectionTickets = visibleTickets.filter((ticket) =>
                section.statuses.includes(ticket.status),
              );

              if (sectionTickets.length === 0) {
                return null;
              }

              return (
                <section
                  className={styles.ticketGroup}
                  style={ui.panel}
                  data-hub-ticket-group
                  key={section.title}
                >
                  <h2 style={ui.groupTitle}>{section.title}</h2>
                  <div style={ui.ticketList} data-hub-ticket-list>
                    {sectionTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        className={`${styles.ticketButton} ${
                          ticket.id === selectedTicketId ? styles.ticketButtonActive : ""
                        }`}
                        style={{
                          ...ui.ticketButton,
                          ...(ticket.id === selectedTicketId ? ui.ticketButtonActive : {}),
                        }}
                        onClick={() => handleSelectTicket(ticket.id)}
                      >
                        <div
                          className={`${styles.ticketCode} ${styles[section.tone]}`}
                          style={{
                            ...ui.ticketCode,
                            ...(section.tone === "queue" ? ui.queueCode : {}),
                            ...(section.tone === "active" ? ui.activeCode : {}),
                            ...(section.tone === "done" ? ui.doneCode : {}),
                          }}
                        >
                          {getTicketCode(ticket)}
                        </div>
                        <div className={styles.ticketMain}>
                          <div className={styles.ticketTop}>
                            <strong>{getTicketName(ticket)}</strong>
                            <span style={ui.mutedText}>{formatTime(ticket.lastMessageAt)}</span>
                          </div>
                          <p style={ui.mutedText}>{ticket.lastMessage ?? "Sem mensagens"}</p>
                        </div>
                        <MessageCircle className={styles.whatsIcon} size={17} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {!isLoading && visibleTickets.length === 0 ? (
              <div className={styles.emptyState} style={ui.emptyState}>
                Nenhum atendimento encontrado.
              </div>
            ) : null}
          </aside>

          <section className={styles.chatPanel} style={ui.chatPanel} data-hub-chat-panel>
            <header className={styles.chatHeader} style={ui.chatHeader} data-hub-chat-header>
              {activeTicket ? (
                <>
                  <div
                    className={`${styles.ticketCode} ${styles.queue}`}
                    style={{ ...ui.ticketCode, ...ui.queueCode }}
                  >
                    {getTicketCode(activeTicket)}
                  </div>
                  <div className={styles.chatIdentity}>
                    <h2 style={{ fontSize: 18 }}>{activeTicketName}</h2>
                    <span style={ui.mutedText}>{getTicketIdentity(activeTicket)}</span>
                  </div>
                  <span className={styles.statusBadge} style={ui.statusBadge}>
                    {statusLabels[activeTicket.status]}
                  </span>
                  <div className={styles.chatActions} style={ui.chatActions}>
                    <button
                      className={styles.primaryButton}
                      style={{ ...ui.button, ...ui.primaryButton }}
                      onClick={handleAssign}
                      disabled={isMutating || !canAssignTicket}
                    >
                      <LoadingLabel
                        isLoading={isMutating}
                        label={assignButtonLabel}
                        loadingLabel="Assumindo..."
                      />
                    </button>
                    <button className={styles.secondaryButton} style={ui.button}>
                      Mais ações
                      <ChevronDown size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.chatIdentity}>
                  <h2 style={{ fontSize: 18 }}>Selecione um atendimento</h2>
                  <span style={ui.mutedText}>As mensagens aparecerão aqui</span>
                </div>
              )}
            </header>

            <div
              ref={messagesRef}
              className={styles.messages}
              style={ui.messages}
              data-hub-messages
            >
              {activeTicket ? (
                <span className={styles.dayPill} style={ui.dayPill}>Hoje</span>
              ) : null}
              {data.messages.map((item) => (
                <article
                  key={item.id}
                  data-hub-message={item.direction}
                  className={`${styles.message} ${
                    item.direction === "enviada"
                      ? styles.messageSent
                      : styles.messageReceived
                  }`}
                  style={{
                    ...ui.message,
                    ...(item.direction === "enviada" ? ui.messageSent : ui.messageReceived),
                  }}
                >
                  <p>{item.content}</p>
                  <span style={ui.mutedText}>
                    {item.sentBy} · {formatTime(item.createdAt)}
                  </span>
                </article>
              ))}
              {!activeTicket ? (
                <div className={styles.emptyState} style={ui.emptyState}>
                  Aguardando seleção de conversa.
                </div>
              ) : null}
            </div>

            <footer className={styles.composer} style={ui.composer} data-hub-composer>
              <div className={styles.composerTabs} style={ui.composerTabs}>
                <button
                  className={composerTab === "reply" ? styles.composerTabActive : ""}
                  style={{
                    ...ui.composerTab,
                    ...(composerTab === "reply" ? ui.composerTabActive : {}),
                  }}
                  onClick={() => setComposerTab("reply")}
                >
                  Responder
                </button>
                <button
                  className={composerTab === "note" ? styles.composerTabActive : ""}
                  style={{
                    ...ui.composerTab,
                    ...(composerTab === "note" ? ui.composerTabActive : {}),
                  }}
                  onClick={() => setComposerTab("note")}
                >
                  Comentário interno
                </button>
              </div>
              {composerTab === "reply" ? (
                <div className={styles.messageComposer} style={ui.messageComposer}>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={
                      canWriteToTicket
                        ? "Digite sua mensagem..."
                        : "Resposta indisponível neste estado"
                    }
                    disabled={!canWriteToTicket || isMutating}
                    style={ui.textarea}
                  />
                  {composerHint ? (
                    <p style={{ ...ui.mutedText, padding: "0 14px 10px" }}>
                      {composerHint}
                    </p>
                  ) : null}
                  <div className={styles.composerActions} style={ui.composerActions}>
                    <button className={styles.iconButton} style={ui.iconButton} title="Emoji">
                      <Smile size={18} />
                    </button>
                    <button className={styles.iconButton} style={ui.iconButton} title="Anexar">
                      <Paperclip size={18} />
                    </button>
                    <button className={styles.iconButton} style={ui.iconButton} title="Atalhos">
                      <Zap size={18} />
                    </button>
                    <button
                      className={styles.sendButton}
                      style={{ ...ui.button, ...ui.primaryButton, ...ui.sendButton }}
                      onClick={handleSendMessage}
                      disabled={!canWriteToTicket || !message.trim() || isMutating}
                    >
                      <LoadingLabel
                        isLoading={isMutating}
                        label="Enviar"
                        loadingLabel="Enviando..."
                        icon={<Send size={16} />}
                      />
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.messageComposer} style={ui.messageComposer}>
                  <textarea
                    value={internalNote}
                    onChange={(event) => setInternalNote(event.target.value)}
                    placeholder="Comentário interno"
                    disabled={!activeTicket}
                    style={ui.textarea}
                  />
                  <div className={styles.composerActions} style={ui.composerActions}>
                    <button
                      className={styles.secondaryButton}
                      style={ui.button}
                      onClick={() => setInternalNote("")}
                      disabled={!internalNote}
                    >
                      Limpar comentário
                    </button>
                  </div>
                </div>
              )}
            </footer>
          </section>

          <aside className={styles.detailsColumn} style={ui.detailsColumn} data-hub-details-column>
            {activeTicket ? (
              <>
                <section className={styles.detailCard} style={ui.detailCard} data-hub-detail-card>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Detalhes do atendimento</h2>
                    <ChevronDown size={18} />
                  </header>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>ID do atendimento</span>
                    <strong>#{getTicketCode(activeTicket)}</strong>
                  </div>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>Status</span>
                    <span className={styles.statusBadge} style={ui.statusBadge}>
                      {statusLabels[activeTicket.status]}
                    </span>
                  </div>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>Canal</span>
                    <strong>WhatsApp</strong>
                  </div>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>Cliente</span>
                    <strong>{activeTicketName}</strong>
                  </div>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>Telefone</span>
                    <strong>{activeTicket.customerPhone ?? "Não resolvido"}</strong>
                  </div>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>LID</span>
                    <strong>{activeTicket.customerLid ?? "-"}</strong>
                  </div>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>Aberto em</span>
                    <strong>{formatDateTime(activeTicket.createdAt)}</strong>
                  </div>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>Responsável</span>
                    <strong>{assignedToLabel}</strong>
                  </div>
                </section>

                <section className={styles.detailCard} style={ui.detailCard} data-hub-detail-card>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Informações do cliente</h2>
                  </header>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>Categoria</span>
                    <strong>{activeTicket.category ?? "-"}</strong>
                  </div>
                  <div className={styles.detailRow} style={ui.detailRow}>
                    <span style={ui.mutedText}>Prioridade</span>
                    <strong>{activeTicket.priority}</strong>
                  </div>
                  {currentUser.role !== "atendente" ? (
                    <div className={styles.detailRow} style={ui.detailRow}>
                      <span style={ui.mutedText}>Nota</span>
                      <strong>{activeTicket.feedbackScore ?? "-"}</strong>
                    </div>
                  ) : null}
                  {currentUser.role !== "atendente" ? (
                    <div className={styles.detailRow} style={ui.detailRow}>
                      <span style={ui.mutedText}>Feedback escrito</span>
                      <strong>{activeTicket.feedbackComment ?? "-"}</strong>
                    </div>
                  ) : null}
                  <button className={styles.fullWidthButton} style={{ ...ui.button, width: "calc(100% - 36px)", margin: "12px 18px 0" }}>
                    Ver perfil completo
                    <ExternalLink size={15} />
                  </button>
                </section>

                <section className={styles.detailCard} style={ui.detailCard} data-hub-detail-card>
                  <header style={ui.detailHeader}>
                    <h2 style={{ fontSize: 15 }}>Histórico do atendimento</h2>
                  </header>
                  <div className={styles.timelineItem}>
                    <span className={styles.timelineDot} />
                    <div>
                      <strong>Atendimento criado</strong>
                      <p style={ui.mutedText}>{formatDateTime(activeTicket.createdAt)}</p>
                    </div>
                  </div>
                  <div className={styles.timelineItem}>
                    <span className={styles.timelineDotMuted} />
                    <div>
                      <strong>Última atualização</strong>
                      <p style={ui.mutedText}>{formatDateTime(activeTicket.updatedAt)}</p>
                    </div>
                  </div>
                  <button
                    className={styles.finishButton}
                    style={{ ...ui.button, width: "calc(100% - 36px)", margin: "10px 18px 0" }}
                    onClick={handleFinish}
                    disabled={isMutating || !canFinishTicket || !canSendToActiveCustomer}
                  >
                    <LoadingLabel
                      isLoading={isMutating}
                      label="Finalizar atendimento"
                      loadingLabel="Finalizando..."
                      icon={<CheckCircle2 size={16} />}
                    />
                  </button>
                </section>
              </>
            ) : (
              <div className={styles.detailCard} style={ui.detailCard} data-hub-detail-card>
                <div className={styles.emptyState} style={ui.emptyState}>
                  Selecione um ticket.
                </div>
              </div>
            )}

            <button className={styles.logoutButton} style={ui.button} onClick={handleLogout}>
              <LoadingLabel
                isLoading={isMutating}
                label="Sair"
                loadingLabel="Saindo..."
                icon={<LogOut size={16} />}
              />
            </button>
          </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
