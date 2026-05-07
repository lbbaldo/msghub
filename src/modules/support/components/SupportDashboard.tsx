"use client";

import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  MessageCircle,
  Paperclip,
  Send,
  Smile,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type {
  SupportMessage,
  TicketWithMessages,
} from "@/modules/support/types";
import { defaultSupportSettings } from "@/modules/support/settings";
import {
  buildClientSummaries,
  buildDashboardMetrics,
  buildSupportNotifications,
  buildUserDraft,
  canSendToCustomerPhone,
  type ClientNoteResponse,
  type ClientNotesResponse,
  filters,
  formatDateTime,
  formatDuration,
  formatTime,
  getCountForFilter,
  getInitial,
  getRoleLabel,
  getTicketCode,
  getTicketIdentity,
  getTicketName,
  getUserPermissions,
  mergeUser,
  normalizeOptionalPhone,
  requestJson,
  statusLabels,
  statusSections,
  ui,
  type AppView,
  type CreateUserForm,
  type SettingsResponse,
  type SettingsView,
  type SupportDashboardProps,
  type SupportNotification,
  type TicketFilter,
  type TransferTicketsResponse,
  type UserDraft,
  type UserResponse,
  type UsersResponse,
} from "@/modules/support/components/SupportDashboard.model";
import { SupportSidebar } from "@/modules/support/components/SupportSidebar";
import { SupportTopbar } from "@/modules/support/components/SupportTopbar";
import styles from "@/modules/support/components/SupportDashboard.module.css";
import type { CurrentUser, SupportUserSummary } from "@/shared/auth/types";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { SelectField, TextField, ToggleField } from "@/shared/ui/FormField";
import { LoadingLabel } from "@/shared/ui/LoadingLabel";

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
  const [isClientNotesLoading, setIsClientNotesLoading] = useState(false);
  const [hasLoadedClientNotes, setHasLoadedClientNotes] = useState(false);
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
  const [internalNoteTicketId, setInternalNoteTicketId] = useState<string | null>(null);
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

  const loadClientNotes = useCallback(async () => {
    setIsClientNotesLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await requestJson<ClientNotesResponse>("/api/client-notes");
      setClientNotes(
        Object.fromEntries(
          response.notes.map((note) => [note.clientKey, note.note]),
        ),
      );
      setHasLoadedClientNotes(true);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : "Erro ao carregar observações";

      setError(nextError);
    } finally {
      setIsClientNotesLoading(false);
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
    if (users.length > 0 || isUsersLoading) {
      return;
    }

    queueMicrotask(() => {
      void loadUsers();
    });
  }, [isUsersLoading, loadUsers, users.length]);

  useEffect(() => {
    if (activeView !== "configuracoes" || runtimeSettings || isSettingsLoading) {
      return;
    }

    queueMicrotask(() => {
      void loadSettings();
    });
  }, [activeView, isSettingsLoading, loadSettings, runtimeSettings]);

  useEffect(() => {
    if (activeView !== "clientes" || hasLoadedClientNotes || isClientNotesLoading) {
      return;
    }

    queueMicrotask(() => {
      void loadClientNotes();
    });
  }, [
    activeView,
    hasLoadedClientNotes,
    isClientNotesLoading,
    loadClientNotes,
  ]);

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredByStatus =
      filter === "todos"
        ? data.tickets
        : filter === "urgentes"
          ? data.tickets.filter((ticket) => ticket.priority === "urgente")
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
  const userNameById = useMemo(
    () => new Map(users.map((user) => [user.id, user.name])),
    [users],
  );

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

  const handleResolveContact = () => {
    if (!data.activeTicket) {
      return;
    }

    void runMutation(async () => {
      await requestJson(`/api/tickets/${data.activeTicket?.id}/resolve-contact`, {
        method: "POST",
      });
      await loadTickets(data.activeTicket?.id);
      setNotice("Contato reavaliado com sucesso.");
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

  const handleSaveInternalNote = () => {
    if (!data.activeTicket) {
      return;
    }

    const ticketId = data.activeTicket.id;
    const content =
      internalNoteTicketId === ticketId ? internalNote : data.activeTicket.internalNote ?? "";

    void runMutation(async () => {
      await requestJson(`/api/tickets/${ticketId}/internal-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      await loadTickets(ticketId);
      setNotice("Comentário interno salvo.");
    });
  };

  const handleSaveClientNote = () => {
    if (!activeClient) {
      return;
    }

    const clientKey = activeClient.key;
    const content = clientNotes[clientKey] ?? "";

    void runMutation(async () => {
      const response = await requestJson<ClientNoteResponse>("/api/client-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey, content }),
      });

      setClientNotes((currentNotes) => {
        if (!response.note) {
          const remainingNotes = { ...currentNotes };
          delete remainingNotes[clientKey];

          return remainingNotes;
        }

        return {
          ...currentNotes,
          [response.note.clientKey]: response.note.note,
        };
      });
      setNotice("Observação do cliente salva.");
    });
  };

  const handleLogout = () => {
    void runMutation(async () => {
      await requestJson("/api/auth/logout", { method: "POST" });
      window.location.reload();
    });
  };

  const activeTicket = data.activeTicket;
  const activeTicketInternalNote =
    activeTicket && internalNoteTicketId === activeTicket.id
      ? internalNote
      : activeTicket?.internalNote ?? "";
  const activeTicketName = activeTicket ? getTicketName(activeTicket) : "";
  const canSendToActiveCustomer = activeTicket
    ? canSendToCustomerPhone(activeTicket.customerPhone)
    : false;
  const canAssignTicket = activeTicket?.status === "em_fila";
  const canFinishTicket = activeTicket?.status === "em_atendimento";
  const canResolveActiveContact = Boolean(
    activeTicket && !activeTicket.customerPhone && activeTicket.customerLid,
  );
  const canWriteToTicket =
    activeTicket?.status === "em_atendimento" && canSendToActiveCustomer;
  const handleReplyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (!canWriteToTicket || isMutating || !message.trim()) {
      return;
    }

    handleSendMessage();
  };
  const assignedToLabel =
    activeTicket?.assignedTo === currentUser.id
      ? currentUser.name
      : activeTicket?.assignedTo
        ? userNameById.get(activeTicket.assignedTo) ?? activeTicket.assignedTo
        : "-";
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
  const mainTicketAction =
    activeTicket?.status === "aguardando_feedback" ||
    activeTicket?.status === "aguardando_feedback_comentario" ||
    activeTicket?.status === "finalizado"
      ? {
          disabled: true,
          label: "Atendimento finalizado",
          loadingLabel: "Atendimento finalizado",
          onClick: () => undefined,
          style: { ...ui.button, ...ui.disabledActionButton },
        }
      : activeTicket?.status === "em_atendimento"
      ? {
          disabled: isMutating || !canFinishTicket || !canSendToActiveCustomer,
          label: "Finalizar atendimento",
          loadingLabel: "Finalizando...",
          onClick: handleFinish,
          style: { ...ui.button, ...ui.dangerButton },
        }
      : {
          disabled: isMutating || !canAssignTicket,
          label: assignButtonLabel,
          loadingLabel: "Assumindo...",
          onClick: handleAssign,
          style: { ...ui.button, ...ui.primaryButton },
        };
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
  const alertBanner = (
    <>
      {error ? (
        <div className={styles.alertBanner} data-tone="error">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className={styles.alertBanner} data-tone="notice">
          {notice}
        </div>
      ) : null}
    </>
  );

  return (
    <main className={styles.shell} style={ui.shell} data-hub-shell>
      <SupportSidebar
        activeView={activeView}
        currentUser={currentUser}
        isLoggingOut={isMutating}
        onLogout={handleLogout}
        onSelectView={setActiveView}
      />

      <section className={styles.workspace} style={ui.workspace} data-hub-workspace>
        <SupportTopbar
          isNotificationsOpen={isNotificationsOpen}
          notifications={notifications}
          pageSubtitle={pageSubtitle}
          pageTitle={pageTitle}
          query={query}
          searchPlaceholder={searchPlaceholder}
          onQueryChange={setQuery}
          onSelectNotification={handleSelectNotification}
          onToggleNotifications={() =>
            setIsNotificationsOpen((currentValue) => !currentValue)
          }
        />
        {alertBanner}

        {activeView === "dashboard" ? (
          <>
            <div className={styles.filterTabs} data-hub-filter-tabs>
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
                  <header>
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
                  <header>
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
            <div style={ui.dashboardGrid}>
              <section style={ui.dashboardMain}>
                <section style={ui.detailCard}>
                  <header>
                    <h2 style={{ fontSize: 15 }}>Controles de teste</h2>
                    <Badge
                      tone={
                        settings.customerWebhookEnabled &&
                        settings.automaticBotMessagesEnabled
                          ? "success"
                          : "danger"
                      }
                    >
                      {settings.customerWebhookEnabled &&
                      settings.automaticBotMessagesEnabled
                        ? "Ativo"
                        : "Pausado"}
                    </Badge>
                  </header>
                  <div className={styles.testControls}>
                    <label className={styles.switchField}>
                      <input
                        type="checkbox"
                        checked={settings.customerWebhookEnabled}
                        onChange={(event) =>
                          handleUpdateSettings({
                            customerWebhookEnabled: event.target.checked,
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                      />
                      <span className={styles.switchTrack} aria-hidden="true">
                        <span className={styles.switchThumb} />
                      </span>
                      <span className={styles.switchText}>Webhook e tickets</span>
                    </label>
                    <label className={styles.switchField}>
                      <input
                        type="checkbox"
                        checked={settings.automaticBotMessagesEnabled}
                        onChange={(event) =>
                          handleUpdateSettings({
                            automaticBotMessagesEnabled: event.target.checked,
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                      />
                      <span className={styles.switchTrack} aria-hidden="true">
                        <span className={styles.switchThumb} />
                      </span>
                      <span className={styles.switchText}>Respostas do bot</span>
                    </label>
                  </div>
                </section>

                <section style={{ ...ui.detailCard, ...ui.settingsMessagesCard }}>
                  <header>
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

                <section style={{ ...ui.detailCard, ...ui.settingsMessagesCard }}>
                  <header>
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
                      style={ui.footerButton}
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
                        <footer
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            padding: "0 18px 18px",
                          }}
                        >
                          <Button
                            variant="primary"
                            onClick={handleSaveClientNote}
                            disabled={isMutating || isClientNotesLoading}
                          >
                            <LoadingLabel
                              isLoading={isMutating}
                              label="Salvar observação"
                              loadingLabel="Salvando..."
                            />
                          </Button>
                        </footer>
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
            <div className={styles.filterTabs} data-hub-filter-tabs>
          {filters.map((item) => (
            <button
              key={item.value}
              className={`${styles.filterTab} ${
                filter === item.value ? styles.filterTabActive : ""
              }`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
              <span>{getCountForFilter(data.tickets, item.value)}</span>
            </button>
          ))}
            </div>

            <div className={styles.contentGrid} data-hub-content-grid>
          <aside className={styles.ticketColumn} data-hub-ticket-column>
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
                  data-hub-ticket-group
                  key={section.title}
                >
                  <h2>{section.title}</h2>
                  <div className={styles.ticketList} data-hub-ticket-list>
                    {sectionTickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        className={`${styles.ticketButton} ${
                          ticket.id === selectedTicketId ? styles.ticketButtonActive : ""
                        }`}
                        onClick={() => handleSelectTicket(ticket.id)}
                      >
                        <div
                          className={`${styles.ticketCode} ${styles[section.tone]}`}
                        >
                          {getTicketCode(ticket)}
                        </div>
                        <div className={styles.ticketMain}>
                          <div className={styles.ticketTop}>
                            <strong>{getTicketName(ticket)}</strong>
                            <span>{formatTime(ticket.lastMessageAt)}</span>
                          </div>
                          <p>{ticket.lastMessage ?? "Sem mensagens"}</p>
                        </div>
                        <MessageCircle className={styles.whatsIcon} size={17} />
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {!isLoading && visibleTickets.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhum atendimento encontrado.
              </div>
            ) : null}
          </aside>

          <section className={styles.chatPanel} data-hub-chat-panel>
            <header className={styles.chatHeader} data-hub-chat-header>
              {activeTicket ? (
                <>
                  <div
                    className={`${styles.ticketCode} ${styles.queue}`}
                  >
                    {getTicketCode(activeTicket)}
                  </div>
                  <div className={styles.chatIdentity}>
                    <h2>{activeTicketName}</h2>
                    <span>{getTicketIdentity(activeTicket)}</span>
                  </div>
                  <span className={styles.statusBadge}>
                    {statusLabels[activeTicket.status]}
                  </span>
                  <div className={styles.chatActions}>
	                    <button
	                      style={mainTicketAction.style}
	                      onClick={mainTicketAction.onClick}
	                      disabled={mainTicketAction.disabled}
	                    >
	                      <LoadingLabel
	                        isLoading={isMutating}
	                        label={mainTicketAction.label}
	                        loadingLabel={mainTicketAction.loadingLabel}
	                      />
	                    </button>
                    <button className={styles.secondaryButton}>
                      Mais ações
                      <ChevronDown size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.chatIdentity}>
                  <h2>Selecione um atendimento</h2>
                  <span>As mensagens aparecerão aqui</span>
                </div>
              )}
            </header>

            <div
              ref={messagesRef}
              className={styles.messages}
              data-hub-messages
            >
              {activeTicket ? (
                <span className={styles.dayPill}>Hoje</span>
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
                >
                  <p>{item.content}</p>
                  <span className={styles.mutedText}>
                    {item.sentBy} · {formatTime(item.createdAt)}
                  </span>
                </article>
              ))}
              {!activeTicket ? (
                <div className={styles.emptyState}>
                  Aguardando seleção de conversa.
                </div>
              ) : null}
            </div>

            <footer className={styles.composer} data-hub-composer>
              <div className={styles.composerTabs}>
                <button
                  className={composerTab === "reply" ? styles.composerTabActive : ""}
                  onClick={() => setComposerTab("reply")}
                >
                  Responder
                </button>
                <button
                  className={composerTab === "note" ? styles.composerTabActive : ""}
                  onClick={() => setComposerTab("note")}
                >
                  Comentário interno
                </button>
              </div>
              {composerTab === "reply" ? (
                <div className={styles.messageComposer}>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={handleReplyKeyDown}
                    placeholder={
                      canWriteToTicket
                        ? "Digite sua mensagem..."
                        : "Resposta indisponível neste estado"
                    }
                    disabled={!canWriteToTicket || isMutating}
                  />
                  {composerHint ? (
                    <p className={styles.composerHint}>
                      {composerHint}
                    </p>
                  ) : null}
                  <div className={styles.composerActions}>
                    <button className={styles.iconButton} title="Emoji">
                      <Smile size={18} />
                    </button>
                    <button className={styles.iconButton} title="Anexar">
                      <Paperclip size={18} />
                    </button>
                    <button className={styles.iconButton} title="Atalhos">
                      <Zap size={18} />
                    </button>
                    <button
                      className={styles.sendButton}
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
                <div className={styles.messageComposer}>
                  <textarea
                    value={activeTicketInternalNote}
                    onChange={(event) => {
                      setInternalNoteTicketId(activeTicket?.id ?? null);
                      setInternalNote(event.target.value);
                    }}
                    placeholder="Comentário interno"
                    disabled={!activeTicket}
                  />
                  <div className={styles.composerActions}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setInternalNoteTicketId(activeTicket?.id ?? null);
                        setInternalNote("");
                      }}
                      disabled={!activeTicketInternalNote || isMutating}
                    >
                      Limpar comentário
                    </button>
                    <button
                      className={styles.sendButton}
                      onClick={handleSaveInternalNote}
                      disabled={!activeTicket || isMutating}
                    >
                      <LoadingLabel
                        isLoading={isMutating}
                        label="Salvar comentário"
                        loadingLabel="Salvando..."
                      />
                    </button>
                  </div>
                </div>
              )}
            </footer>
          </section>

          <aside className={styles.detailsColumn} data-hub-details-column>
            {activeTicket ? (
              <>
                <section className={styles.detailCard} data-hub-detail-card>
                  <header>
                    <h2>Detalhes do atendimento</h2>
                    <ChevronDown size={18} />
                  </header>
                  <div className={styles.detailRow}>
                    <span>ID do atendimento</span>
                    <strong>#{getTicketCode(activeTicket)}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Status</span>
                    <span className={styles.statusBadge}>
                      {statusLabels[activeTicket.status]}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Canal</span>
                    <strong>WhatsApp</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Cliente</span>
                    <strong>{activeTicketName}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Telefone</span>
                    <strong>{activeTicket.customerPhone ?? "Não resolvido"}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>LID</span>
                    <strong>{activeTicket.customerLid ?? "-"}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Aberto em</span>
                    <strong>{formatDateTime(activeTicket.createdAt)}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Responsável</span>
                    <strong>{assignedToLabel}</strong>
                  </div>
                  {canResolveActiveContact ? (
                    <div className={styles.detailAction}>
                      <button
                        className={styles.fullWidthButton}
                        onClick={handleResolveContact}
                        disabled={isMutating}
                      >
                        <LoadingLabel
                          isLoading={isMutating}
                          label="Reavaliar contato"
                          loadingLabel="Reavaliando..."
                        />
                      </button>
                    </div>
                  ) : null}
                </section>

                <section className={styles.detailCard} data-hub-detail-card>
                  <header>
                    <h2>Histórico do atendimento</h2>
                  </header>
                  <div className={styles.timelineItem}>
                    <span className={styles.timelineDot} />
                    <div>
                      <strong>Atendimento criado</strong>
                      <p>{formatDateTime(activeTicket.createdAt)}</p>
                    </div>
                  </div>
                  <div className={styles.timelineItem}>
                    <span className={styles.timelineDotMuted} />
                    <div>
                      <strong>Última atualização</strong>
                      <p>{formatDateTime(activeTicket.updatedAt)}</p>
                    </div>
                  </div>
                  <button
                    className={styles.finishButton}
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
              <div className={styles.detailCard} data-hub-detail-card>
                <div className={styles.emptyState}>
                  Selecione um ticket.
                </div>
              </div>
            )}
          </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
