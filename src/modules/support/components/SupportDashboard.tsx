"use client";

import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type {
  SupportMessage,
  TicketCategory,
  TicketFinishCategory,
  TicketWithMessages,
} from "@/modules/support/types";
import { ticketCategories, ticketFinishCategories } from "@/modules/support/types";
import { defaultSupportSettings } from "@/modules/support/settings";
import {
  buildClientSummaries,
  buildDashboardMetrics,
  buildSupportNotifications,
  buildUserDraft,
  canSendToCustomerPhone,
  type ClientSummary,
  type ClientNoteResponse,
  type ClientNotesResponse,
  filters,
  formatBrazilianPhone,
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
  isTicketVisibleInTodayQueue,
  maskBrazilianPhoneInput,
  mergeUser,
  normalizeBrazilianPhone,
  normalizeOptionalPhone,
  requestJson,
  statusLabels,
  statusSections,
  type AppView,
  type CreateUserForm,
  type SettingsResponse,
  type SettingsView,
  type SupportDashboardProps,
  type SupportNotification,
  type ReportCategory,
  type ReportPeriod,
  type ReportStatus,
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
import { DropdownField } from "@/shared/ui/DropdownField";
import { TextField, ToggleField } from "@/shared/ui/FormField";
import { LoadingLabel } from "@/shared/ui/LoadingLabel";

const appViewPaths: Record<AppView, string> = {
  atendimentos: "/atendimentos",
  dashboard: "/dashboard",
  clientes: "/clientes",
  mensagens: "/mensagens",
  relatorios: "/relatorios",
  integracoes: "/integracoes",
  usuarios: "/usuarios",
  configuracoes: "/configuracoes",
};

const reportPeriodOptions: Array<{ label: string; value: ReportPeriod }> = [
  { label: "Últimos 7 dias", value: "7d" },
  { label: "Últimos 30 dias", value: "30d" },
  { label: "Últimos 90 dias", value: "90d" },
  { label: "Todo o histórico", value: "todos" },
];

const reportStatusOptions: Array<{ label: string; value: ReportStatus }> = [
  { label: "Todos os status", value: "todos" },
  { label: "Em fila", value: "em_fila" },
  { label: "Em atendimento", value: "em_atendimento" },
  { label: "Aguardando nota", value: "aguardando_feedback" },
  { label: "Aguardando comentário", value: "aguardando_feedback_comentario" },
  { label: "Finalizado", value: "finalizado" },
];

const categoryLabels: Record<TicketCategory, string> = {
  financeiro: "Financeiro",
  suporte: "Suporte",
  pedido: "Pedido",
  cadastro: "Cadastro",
  cardapio: "Cardápio",
  outro: "Outro",
};

const reportCategoryOptions: Array<{ label: string; value: ReportCategory }> = [
  { label: "Todas as categorias", value: "todas" },
  ...ticketCategories.map((category) => ({
    label: categoryLabels[category],
    value: category,
  })),
];

const finishCategoryOptions = ticketFinishCategories.map((category) => ({
  label: categoryLabels[category],
  value: category,
}));

const userRoleOptions: Array<{ label: string; value: CurrentUser["role"] }> = [
  { label: "Atendente", value: "atendente" },
  { label: "Supervisor", value: "supervisor" },
  { label: "Admin", value: "admin" },
];

const getDefaultFinishCategory = (
  category: TicketCategory | null | undefined,
): TicketFinishCategory =>
  ticketFinishCategories.includes(category as TicketFinishCategory)
    ? (category as TicketFinishCategory)
    : "suporte";

const getReportStartDate = (period: ReportPeriod, referenceDate: Date): Date | null => {
  if (period === "todos") {
    return null;
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const startDate = new Date(referenceDate);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  return startDate;
};

export function SupportDashboard({ currentUser, initialView }: SupportDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState<TicketWithMessages>({
    tickets: [],
    contacts: [],
    activeTicket: null,
    messages: [],
  });
  const [filter, setFilter] = useState<TicketFilter>("todos");
  const activeView = initialView;
  const [query, setQuery] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: "",
    businessName: "",
    phone: "",
  });
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("30d");
  const [reportStatus, setReportStatus] = useState<ReportStatus>("todos");
  const [reportCategory, setReportCategory] = useState<ReportCategory>("todas");
  const [reportAttendantId, setReportAttendantId] = useState("todos");
  const [isFinishCategoryOpen, setIsFinishCategoryOpen] = useState(false);
  const [finishCategory, setFinishCategory] =
    useState<TicketFinishCategory>("suporte");
  const [isStartConversationOpen, setIsStartConversationOpen] = useState(false);
  const [startConversationForm, setStartConversationForm] = useState({
    customerPhone: "",
    contactName: "",
    content: "",
  });
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
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  useEffect(
    () => () => {
      if (audioRecorderRef.current?.state === "recording") {
        audioRecorderRef.current.stop();
      }
    },
    [],
  );

  useEffect(() => {
    const shouldLoadUsers =
      activeView === "usuarios" || activeView === "relatorios";

    if (!shouldLoadUsers || users.length > 0 || isUsersLoading) {
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

  const ticketsInTodayQueue = useMemo(
    () => data.tickets.filter((ticket) => isTicketVisibleInTodayQueue(ticket)),
    [data.tickets],
  );
  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredByStatus =
      filter === "todos"
        ? ticketsInTodayQueue
        : filter === "urgentes"
          ? ticketsInTodayQueue.filter((ticket) => ticket.priority === "urgente")
        : ticketsInTodayQueue.filter((ticket) => ticket.status === filter);

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
  }, [filter, query, ticketsInTodayQueue]);

  const clients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const summaries = buildClientSummaries(data.tickets, data.contacts);

    if (!normalizedQuery) {
      return summaries;
    }

    return summaries.filter((client) =>
      [
        client.name,
        client.identity,
        formatBrazilianPhone(client.phone),
        client.lid ?? "",
        client.latestTicket?.category ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [data.contacts, data.tickets, query]);

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
  const reportAttendantOptions = useMemo(
    () =>
      Array.from(
        data.tickets.reduce<Set<string>>((attendantIds, ticket) => {
          if (!ticket.assignedTo) {
            return attendantIds;
          }

          return new Set(attendantIds).add(ticket.assignedTo);
        }, new Set<string>()),
      )
        .map((attendantId) => ({
          id: attendantId,
          label: userNameById.get(attendantId) ?? attendantId,
        }))
        .sort((firstAttendant, secondAttendant) =>
          firstAttendant.label.localeCompare(secondAttendant.label),
        ),
    [data.tickets, userNameById],
  );
  const reportTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const startDate = getReportStartDate(reportPeriod, new Date());

    return data.tickets
      .filter((ticket) => {
        const activityDate = new Date(ticket.updatedAt);
        const matchesPeriod = startDate ? activityDate >= startDate : true;
        const matchesStatus =
          reportStatus === "todos" ? true : ticket.status === reportStatus;
        const matchesCategory =
          reportCategory === "todas" ? true : ticket.category === reportCategory;
        const matchesAttendant =
          reportAttendantId === "todos"
            ? true
            : ticket.assignedTo === reportAttendantId;
        const searchable = [
          getTicketName(ticket),
          getTicketIdentity(ticket),
          ticket.lastMessage ?? "",
          ticket.category ?? "",
          ticket.feedbackComment ?? "",
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = normalizedQuery
          ? searchable.includes(normalizedQuery)
          : true;

        return (
          matchesPeriod &&
          matchesStatus &&
          matchesCategory &&
          matchesAttendant &&
          matchesQuery
        );
      })
      .sort(
        (firstTicket, secondTicket) =>
          new Date(secondTicket.updatedAt).getTime() -
          new Date(firstTicket.updatedAt).getTime(),
      );
  }, [
    data.tickets,
    query,
    reportAttendantId,
    reportCategory,
    reportPeriod,
    reportStatus,
  ]);
  const reportMetrics = useMemo(
    () => buildDashboardMetrics(reportTickets),
    [reportTickets],
  );
  const reportOpenTickets = useMemo(
    () => reportTickets.filter((ticket) => ticket.status !== "finalizado").length,
    [reportTickets],
  );
  const reportFinishedTickets = useMemo(
    () => reportTickets.filter((ticket) => ticket.status === "finalizado").length,
    [reportTickets],
  );
  const reportStatusRows = useMemo(
    () =>
      reportStatusOptions.slice(1).map((statusOption) => ({
        label: statusOption.label,
        count: reportTickets.filter((ticket) => ticket.status === statusOption.value)
          .length,
      })),
    [reportTickets],
  );
  const reportCategoryRows = useMemo(
    () =>
      ticketCategories.map((category) => ({
        label: categoryLabels[category],
        count: reportTickets.filter((ticket) => ticket.category === category).length,
      })),
    [reportTickets],
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
    setIsFinishCategoryOpen(false);
    router.push(appViewPaths.atendimentos);
    setSelectedTicketId(ticketId);
    void loadTickets(ticketId);
  };

  const handleSelectClientTicket = (ticketId: string) => {
    setIsFinishCategoryOpen(false);
    router.push(appViewPaths.atendimentos);
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

    setFinishCategory(getDefaultFinishCategory(data.activeTicket.category));
    setIsFinishCategoryOpen(true);
  };

  const handleConfirmFinish = () => {
    if (!data.activeTicket) {
      return;
    }

    const ticketId = data.activeTicket.id;

    void runMutation(async () => {
      await requestJson(`/api/tickets/${ticketId}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: finishCategory }),
      });
      setIsFinishCategoryOpen(false);
      await loadTickets(ticketId);
    });
  };

  const handleStartConversation = () => {
    const customerPhone = normalizeBrazilianPhone(startConversationForm.customerPhone);
    const content = startConversationForm.content.trim();

    if (!customerPhone || !content) {
      setError("Informe telefone e mensagem inicial.");
      return;
    }

    void runMutation(async () => {
      const result = await requestJson<{ ticket: { id: string } }>(
        "/api/tickets",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerPhone,
            contactName: startConversationForm.contactName.trim() || undefined,
            content,
          }),
        },
      );

      setStartConversationForm({
        customerPhone: "",
        contactName: "",
        content: "",
      });
      setIsStartConversationOpen(false);
      await loadTickets(result.ticket.id);
    });
  };

  const openStartConversationForClient = (client: ClientSummary) => {
    setStartConversationForm({
      customerPhone: formatBrazilianPhone(client.phone),
      contactName: client.name,
      content: "",
    });
    setIsStartConversationOpen(true);
  };

  const openClientDialog = (client?: ClientSummary) => {
    setClientForm({
      name: client?.contactName ?? "",
      businessName: client?.businessName ?? "",
      phone: formatBrazilianPhone(client?.phone ?? null),
    });
    setIsClientDialogOpen(true);
  };

  const handleSaveClient = () => {
    const phone = normalizeBrazilianPhone(clientForm.phone);
    const name = clientForm.name.trim();

    if (!phone || !name) {
      setError("Informe nome e telefone do cliente.");
      return;
    }

    void runMutation(async () => {
      await requestJson("/api/clients", {
        method: selectedClientKey === phone ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name,
          businessName: clientForm.businessName.trim() || undefined,
        }),
      });
      setSelectedClientKey(phone);
      setIsClientDialogOpen(false);
      await loadTickets(selectedTicketId);
      setNotice("Cliente salvo.");
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

  const sendAudioBlob = (audioBlob: Blob) => {
    if (!data.activeTicket || audioBlob.size === 0) {
      return;
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, "atendimento-audio.webm");

    void runMutation(async () => {
      await requestJson<{ message: SupportMessage }>(
        `/api/tickets/${data.activeTicket?.id}/messages`,
        {
          method: "POST",
          body: formData,
        },
      );
      await loadTickets(data.activeTicket?.id);
    });
  };

  const handleAudioFileChange = (audioFile: File | null) => {
    if (!audioFile) {
      return;
    }

    sendAudioBlob(audioFile);
  };

  const getAudioRecorderMimeType = (): string | undefined => {
    const supportedType = [
      "audio/ogg;codecs=opus",
      "audio/webm;codecs=opus",
      "audio/webm",
    ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

    return supportedType;
  };

  const handleToggleAudioRecording = async () => {
    if (isRecordingAudio) {
      audioRecorderRef.current?.stop();
      setIsRecordingAudio(false);
      return;
    }

    if (!data.activeTicket || !canWriteToTicket) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador não permite gravar áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getAudioRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current = [...audioChunksRef.current, event.data];
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        audioChunksRef.current = [];
        sendAudioBlob(audioBlob);
      };
      audioRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingAudio(true);
    } catch (caughtError) {
      const errorMessage =
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível iniciar a gravação.";

      setError(errorMessage);
    }
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
          className: styles.disabledActionButton,
        }
      : activeTicket?.status === "em_atendimento"
      ? {
          disabled: isMutating || !canFinishTicket || !canSendToActiveCustomer,
          label: "Finalizar atendimento",
          loadingLabel: "Finalizando...",
          onClick: handleFinish,
          className: styles.dangerButton,
        }
      : {
          disabled: isMutating || !canAssignTicket,
          label: assignButtonLabel,
          loadingLabel: "Assumindo...",
          onClick: handleAssign,
          className: styles.primaryButton,
        };
  const pageTitle =
    activeView === "clientes"
      ? "Clientes"
      : activeView === "dashboard"
        ? "Dashboard"
      : activeView === "mensagens"
        ? "Mensagens"
        : activeView === "relatorios"
          ? "Relatórios"
        : activeView === "integracoes"
          ? "Integrações"
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
      : activeView === "mensagens"
        ? "Modelos e conversas programadas"
        : activeView === "relatorios"
          ? `${reportTickets.length} atendimentos no histórico filtrado`
        : activeView === "integracoes"
          ? "Conectores e canais conectados"
        : activeView === "usuarios"
          ? `${users.length} usuários cadastrados`
          : activeView === "configuracoes"
            ? "Regras do hub e integrações"
        : `${ticketsInTodayQueue.length} conversas no hub`;
  const searchPlaceholder =
    activeView === "clientes"
      ? "Buscar cliente..."
      : activeView === "dashboard"
        ? "Buscar atendimento..."
      : activeView === "mensagens"
        ? "Buscar mensagem..."
        : activeView === "relatorios"
          ? "Buscar no histórico..."
        : activeView === "integracoes"
          ? "Buscar integração..."
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
    <main className={styles.shell} data-hub-shell>
      <SupportSidebar
        activeView={activeView}
        currentUser={currentUser}
        isLoggingOut={isMutating}
        onLogout={handleLogout}
      />

      <section className={styles.workspace} data-hub-workspace>
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
        {isFinishCategoryOpen && activeTicket ? (
          <div className={styles.modalBackdrop}>
            <section
              className={`${styles.modalDialog} ${styles.modalDialogCompact}`}
              role="dialog"
              aria-modal="true"
            >
              <header>
                <h2>Finalizar atendimento</h2>
                <p className={styles.mutedText}>
                  Classifique o motivo principal antes de encerrar.
                </p>
              </header>
              <label className={styles.formLabel}>
                <span className={styles.mutedText}>Categoria</span>
                <DropdownField
                  value={finishCategory}
                  onChange={setFinishCategory}
                  options={finishCategoryOptions}
                  disabled={isMutating}
                />
              </label>
              <div className={styles.finishCategoryActions}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsFinishCategoryOpen(false)}
                  disabled={isMutating}
                >
                  Cancelar
                </button>
                <button
                  className={styles.dangerButton}
                  onClick={handleConfirmFinish}
                  disabled={isMutating || !canFinishTicket || !canSendToActiveCustomer}
                >
                  <LoadingLabel
                    isLoading={isMutating}
                    label="Finalizar"
                    loadingLabel="Finalizando..."
                    icon={<CheckCircle2 size={16} />}
                  />
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {isStartConversationOpen ? (
          <div className={styles.modalBackdrop}>
            <section
              className={`${styles.modalDialog} ${styles.modalDialogForm}`}
              role="dialog"
              aria-modal="true"
            >
              <header>
                <h2>Nova conversa</h2>
                <p className={styles.mutedText}>
                  Envie a primeira mensagem e crie o atendimento no Hub.
                </p>
              </header>
              <label className={styles.formLabel}>
                <span className={styles.mutedText}>Telefone</span>
                <TextField
                  value={startConversationForm.customerPhone}
                  onChange={(event) =>
                    setStartConversationForm((currentForm) => ({
                      ...currentForm,
                      customerPhone: maskBrazilianPhoneInput(event.target.value),
                    }))
                  }
                  placeholder="(00) 00000-0000"
                  disabled={isMutating}
                />
              </label>
              <label className={styles.formLabel}>
                <span className={styles.mutedText}>Nome opcional</span>
                <TextField
                  value={startConversationForm.contactName}
                  onChange={(event) =>
                    setStartConversationForm((currentForm) => ({
                      ...currentForm,
                      contactName: event.target.value,
                    }))
                  }
                  placeholder="Nome do cliente"
                  disabled={isMutating}
                />
              </label>
              <label className={styles.formLabel}>
                <span className={styles.mutedText}>Mensagem inicial</span>
                <textarea
                  className={styles.dialogTextarea}
                  value={startConversationForm.content}
                  onChange={(event) =>
                    setStartConversationForm((currentForm) => ({
                      ...currentForm,
                      content: event.target.value,
                    }))
                  }
                  placeholder="Digite a primeira mensagem..."
                  disabled={isMutating}
                />
              </label>
              <div className={styles.finishCategoryActions}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsStartConversationOpen(false)}
                  disabled={isMutating}
                >
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={handleStartConversation}
                  disabled={
                    isMutating ||
                    !normalizeBrazilianPhone(startConversationForm.customerPhone) ||
                    !startConversationForm.content.trim()
                  }
                >
                  <LoadingLabel
                    isLoading={isMutating}
                    label="Iniciar"
                    loadingLabel="Enviando..."
                    icon={<Send size={16} />}
                  />
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {isClientDialogOpen ? (
          <div className={styles.modalBackdrop}>
            <section
              className={`${styles.modalDialog} ${styles.modalDialogForm}`}
              role="dialog"
              aria-modal="true"
            >
              <header>
                <h2>{selectedClientKey === clientForm.phone ? "Editar cliente" : "Novo cliente"}</h2>
                <p className={styles.mutedText}>
                  Salve o contato para usar Clientes como agenda.
                </p>
              </header>
              <label className={styles.formLabel}>
                <span className={styles.mutedText}>Nome</span>
                <TextField
                  value={clientForm.name}
                  onChange={(event) =>
                    setClientForm((currentForm) => ({
                      ...currentForm,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Nome do cliente"
                  disabled={isMutating}
                />
              </label>
              <label className={styles.formLabel}>
                <span className={styles.mutedText}>Estabelecimento</span>
                <TextField
                  value={clientForm.businessName}
                  onChange={(event) =>
                    setClientForm((currentForm) => ({
                      ...currentForm,
                      businessName: event.target.value,
                    }))
                  }
                  placeholder="Nome do estabelecimento"
                  disabled={isMutating}
                />
              </label>
              <label className={styles.formLabel}>
                <span className={styles.mutedText}>Telefone</span>
                <TextField
                  value={clientForm.phone}
                  onChange={(event) =>
                    setClientForm((currentForm) => ({
                      ...currentForm,
                      phone: maskBrazilianPhoneInput(event.target.value),
                    }))
                  }
                  placeholder="(00) 00000-0000"
                  disabled={isMutating}
                />
              </label>
              <div className={styles.finishCategoryActions}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsClientDialogOpen(false)}
                  disabled={isMutating}
                >
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={handleSaveClient}
                  disabled={
                    isMutating ||
                    !clientForm.name.trim() ||
                    !normalizeBrazilianPhone(clientForm.phone)
                  }
                >
                  <LoadingLabel
                    isLoading={isMutating}
                    label="Salvar"
                    loadingLabel="Salvando..."
                  />
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {activeView === "dashboard" ? (
          <>
            <div className={styles.filterTabs} data-hub-filter-tabs>
              <button
                className={`${styles.filterTab} ${styles.filterTabActive}`}
              >
                Hoje
              </button>
              <button className={styles.filterTab}>
                Tempo real
                <span>{ticketsInTodayQueue.length}</span>
              </button>
            </div>
            <div className={styles.dashboardGrid}>
              <section className={styles.dashboardMain}>
                <div className={styles.dashboardMetrics}>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Em fila</span>
                    <div className={styles.dashboardMetricValue}>
                      {dashboardMetrics.queueTickets.length}
                    </div>
                    <p className={styles.mutedText}>Aguardando atendimento</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Em atendimento</span>
                    <div className={styles.dashboardMetricValue}>
                      {dashboardMetrics.activeTickets.length}
                    </div>
                    <p className={styles.mutedText}>Com atendente ativo</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Primeira resposta média</span>
                    <div className={styles.dashboardMetricValue}>
                      {formatDuration(dashboardMetrics.averageFirstResponseMs)}
                    </div>
                    <p className={styles.mutedText}>Do ticket até a primeira resposta humana</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Finalizados hoje</span>
                    <div className={styles.dashboardMetricValue}>
                      {dashboardMetrics.finishedToday}
                    </div>
                    <p className={styles.mutedText}>Atendimentos encerrados</p>
                  </article>
                </div>

                <div className={styles.dashboardMetrics}>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Resolução média</span>
                    <div className={styles.dashboardMetricValue}>
                      {formatDuration(dashboardMetrics.averageResolutionMs)}
                    </div>
                    <p className={styles.mutedText}>Da abertura até finalizar</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Aguardando feedback</span>
                    <div className={styles.dashboardMetricValue}>
                      {dashboardMetrics.waitingFeedback}
                    </div>
                    <p className={styles.mutedText}>Esperando nota do cliente</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Nota média</span>
                    <div className={styles.dashboardMetricValue}>
                      {dashboardMetrics.averageFeedback
                        ? dashboardMetrics.averageFeedback.toFixed(1)
                        : "-"}
                    </div>
                    <p className={styles.mutedText}>Baseada nos feedbacks recebidos</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Pendentes</span>
                    <div className={styles.dashboardMetricValue}>
                      {dashboardMetrics.queueTickets.length +
                        dashboardMetrics.activeTickets.length +
                        dashboardMetrics.waitingFeedback}
                    </div>
                    <p className={styles.mutedText}>Não finalizados</p>
                  </article>
                </div>

                <div className={styles.dashboardTwoColumns}>
                  <section className={styles.detailCard}>
                    <header>
                      <h2>Fila crítica</h2>
                    </header>
                    {dashboardMetrics.criticalQueue.map(({ ticket, waitingMs }) => (
                      <button
                        key={ticket.id}
                        className={styles.dashboardListButton}
                        onClick={() => handleSelectTicket(ticket.id)}
                      >
                        <div className={`${styles.ticketCode} ${styles.queue}`}>
                          {getTicketCode(ticket)}
                        </div>
                        <div>
                          <strong>{getTicketName(ticket)}</strong>
                          <p className={styles.mutedText}>
                            {ticket.lastMessage ?? "Sem mensagens"}
                          </p>
                        </div>
                        <span className={styles.mutedText}>
                          {formatDuration(waitingMs)}
                        </span>
                      </button>
                    ))}
                    {dashboardMetrics.criticalQueue.length === 0 ? (
                      <div className={styles.emptyState}>
                        Nenhum atendimento aguardando na fila.
                      </div>
                    ) : null}
                  </section>

                  <section className={styles.detailCard}>
                    <header>
                      <h2>Atendentes</h2>
                    </header>
                    {dashboardMetrics.attendantRows.map((attendant) => (
                      <div key={attendant.label} className={styles.dashboardListItem}>
                        <div className={styles.dashboardListItemHeader}>
                          <strong>
                            {attendant.label === currentUser.id
                              ? currentUser.name
                              : attendant.label}
                          </strong>
                          <span className={styles.mutedText}>
                            {attendant.openTickets} aberto(s) · {attendant.finishedTickets} fim
                          </span>
                        </div>
                        <div className={`${styles.progressTrack} ${styles.progressTrackSpaced}`}>
                          <div
                            className={styles.progressFill}
                            style={{
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
                      <div className={styles.emptyState}>
                        Nenhum atendimento assumido ainda.
                      </div>
                    ) : null}
                  </section>
                </div>
              </section>

              <aside className={styles.detailsColumn}>
                <section className={styles.detailCard}>
                  <header>
                    <h2>Status da operação</h2>
                  </header>
                  {filters.map((item) => (
                    <div key={item.value} className={styles.detailRow}>
                      <span>{item.label}</span>
                      <strong>{getCountForFilter(ticketsInTodayQueue, item.value)}</strong>
                    </div>
                  ))}
                </section>

                <section className={styles.detailCard}>
                  <header>
                    <h2>Meta de primeira resposta</h2>
                  </header>
                  <div className={styles.dashboardCardBody}>
                    <div className={`${styles.progressTrack} ${styles.progressTrackWithBottom}`}>
                      <div
                        className={styles.progressFill}
                        style={{
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
                    <p className={styles.mutedText}>
                      Referência visual usando meta de 30 minutos.
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : activeView === "relatorios" ? (
          <>
            <div className={styles.filterTabs} data-hub-filter-tabs>
              <button className={`${styles.filterTab} ${styles.filterTabActive}`}>
                Histórico
              </button>
              <button className={styles.filterTab}>
                Registros
                <span>{reportTickets.length}</span>
              </button>
            </div>
            <div className={styles.reportsGrid}>
              <section className={styles.dashboardMain}>
                <section className={styles.detailCard}>
                  <header>
                    <h2>Filtros do relatório</h2>
                  </header>
                  <div className={styles.reportFilters}>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Período</span>
                      <DropdownField
                        value={reportPeriod}
                        onChange={setReportPeriod}
                        options={reportPeriodOptions}
                      />
                    </label>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Status</span>
                      <DropdownField
                        value={reportStatus}
                        onChange={setReportStatus}
                        options={reportStatusOptions}
                      />
                    </label>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Categoria</span>
                      <DropdownField
                        value={reportCategory}
                        onChange={setReportCategory}
                        options={reportCategoryOptions}
                      />
                    </label>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Atendente</span>
                      <DropdownField
                        value={reportAttendantId}
                        onChange={setReportAttendantId}
                        options={[
                          { label: "Todos os atendentes", value: "todos" },
                          ...reportAttendantOptions.map((attendant) => ({
                            label: attendant.label,
                            value: attendant.id,
                          })),
                        ]}
                      />
                    </label>
                  </div>
                </section>

                <div className={styles.dashboardMetrics}>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Atendimentos</span>
                    <div className={styles.dashboardMetricValue}>
                      {reportTickets.length}
                    </div>
                    <p className={styles.mutedText}>Dentro dos filtros atuais</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Finalizados</span>
                    <div className={styles.dashboardMetricValue}>
                      {reportFinishedTickets}
                    </div>
                    <p className={styles.mutedText}>Encerrados no período filtrado</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Abertos</span>
                    <div className={styles.dashboardMetricValue}>
                      {reportOpenTickets}
                    </div>
                    <p className={styles.mutedText}>Ainda não finalizados</p>
                  </article>
                  <article className={styles.dashboardMetricCard}>
                    <span className={styles.mutedText}>Nota média</span>
                    <div className={styles.dashboardMetricValue}>
                      {reportMetrics.averageFeedback
                        ? reportMetrics.averageFeedback.toFixed(1)
                        : "-"}
                    </div>
                    <p className={styles.mutedText}>Feedbacks recebidos</p>
                  </article>
                </div>

                <section className={styles.detailCard}>
                  <header>
                    <h2>Histórico de atendimentos</h2>
                  </header>
                  <div className={styles.reportList}>
                    {reportTickets.slice(0, 80).map((ticket) => {
                      const ticketTone =
                        ticket.status === "finalizado"
                          ? "done"
                          : ticket.status === "em_fila"
                            ? "queue"
                            : "active";

                      return (
                        <button
                          key={ticket.id}
                          className={styles.dashboardListButton}
                          onClick={() => handleSelectTicket(ticket.id)}
                        >
                          <div className={`${styles.ticketCode} ${styles[ticketTone]}`}>
                            {getTicketCode(ticket)}
                          </div>
                          <div>
                            <strong>{getTicketName(ticket)}</strong>
                            <p className={styles.mutedText}>
                              {statusLabels[ticket.status]} ·{" "}
                              {ticket.category
                                ? categoryLabels[ticket.category]
                                : "Sem categoria"}{" "}
                              · {ticket.lastMessage ?? "Sem mensagens"}
                            </p>
                          </div>
                          <span className={styles.mutedText}>
                            {formatDateTime(ticket.updatedAt)}
                          </span>
                        </button>
                      );
                    })}
                    {reportTickets.length > 80 ? (
                      <div className={styles.dashboardListItem}>
                        <span className={styles.mutedText}>
                          Exibindo 80 de {reportTickets.length} registros. Use os
                          filtros ou busca para refinar.
                        </span>
                      </div>
                    ) : null}
                    {reportTickets.length === 0 ? (
                      <div className={styles.emptyState}>
                        Nenhum atendimento encontrado para os filtros atuais.
                      </div>
                    ) : null}
                  </div>
                </section>
              </section>

              <aside className={styles.detailsColumn}>
                <section className={styles.detailCard}>
                  <header>
                    <h2>Performance</h2>
                  </header>
                  <div className={styles.detailRow}>
                    <span>Primeira resposta média</span>
                    <strong>{formatDuration(reportMetrics.averageFirstResponseMs)}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Resolução média</span>
                    <strong>{formatDuration(reportMetrics.averageResolutionMs)}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Aguardando feedback</span>
                    <strong>{reportMetrics.waitingFeedback}</strong>
                  </div>
                </section>

                <section className={styles.detailCard}>
                  <header>
                    <h2>Por status</h2>
                  </header>
                  {reportStatusRows.map((row) => (
                    <div key={row.label} className={styles.detailRow}>
                      <span>{row.label}</span>
                      <strong>{row.count}</strong>
                    </div>
                  ))}
                </section>

                <section className={styles.detailCard}>
                  <header>
                    <h2>Por categoria</h2>
                  </header>
                  {reportCategoryRows.map((row) => (
                    <div key={row.label} className={styles.detailRow}>
                      <span>{row.label}</span>
                      <strong>{row.count}</strong>
                    </div>
                  ))}
                </section>
              </aside>
            </div>
          </>
        ) : activeView === "configuracoes" ? (
          <>
            <div className={styles.filterTabs} data-hub-filter-tabs>
              <button
                className={`${styles.filterTab} ${styles.filterTabActive}`}
              >
                Atendimento
              </button>
              <button className={styles.filterTab}>
                Evolution
              </button>
            </div>
            <div className={styles.dashboardGrid}>
              <section className={styles.dashboardMain}>
                <section className={styles.detailCard}>
                  <header>
                    <h2>Controles de teste</h2>
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

                <section className={`${styles.detailCard} ${styles.settingsCard}`}>
                  <header>
                    <h2>Tempos operacionais</h2>
                    <Badge tone="neutral">minutos</Badge>
                  </header>
                  <div className={styles.compactFormGrid}>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Fila crítica</span>
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
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Atendimento parado</span>
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
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Urgência sem primeira resposta</span>
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
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Expirar feedback sem nota</span>
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
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Nota baixa até</span>
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

                <section className={`${styles.detailCard} ${styles.settingsCard}`}>
                  <header>
                    <h2>Mensagens automáticas</h2>
                  </header>
                  <div className={styles.scrollableCardBody}>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Abertura do atendimento</span>
                      <textarea
                        value={settings.openingMessage}
                        onChange={(event) =>
                          handleUpdateSettings({ openingMessage: event.target.value })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                        className={styles.noteBox}
                      />
                    </label>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Finalização e pedido de nota</span>
                      <textarea
                        value={settings.finishMessage}
                        onChange={(event) =>
                          handleUpdateSettings({ finishMessage: event.target.value })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                        className={styles.noteBox}
                      />
                    </label>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Pedido de comentário após a nota</span>
                      <textarea
                        value={settings.feedbackCommentPromptMessage}
                        onChange={(event) =>
                          handleUpdateSettings({
                            feedbackCommentPromptMessage: event.target.value,
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                        className={styles.noteBox}
                      />
                    </label>
                    <label className={styles.formLabel}>
                      <span className={styles.mutedText}>Agradecimento do feedback</span>
                      <textarea
                        value={settings.feedbackThanksMessage}
                        onChange={(event) =>
                          handleUpdateSettings({
                            feedbackThanksMessage: event.target.value,
                          })
                        }
                        disabled={currentUser.role !== "admin" || isMutating}
                        className={styles.noteBox}
                      />
                    </label>
                  </div>
                  <footer className={styles.stickyCardFooter}>
                    <Button
                      variant="primary"
                      className={styles.footerButton}
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

              <aside className={styles.detailsColumn}>
                <section className={styles.detailCard}>
                  <header>
                    <h2>Evolution API</h2>
                  </header>
                  <div className={styles.detailRow}>
                    <span>URL</span>
                    <strong>{runtimeSettings?.evolutionApiUrl ?? "-"}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Instância</span>
                    <strong>{runtimeSettings?.evolutionInstanceName ?? "-"}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Webhook</span>
                    <Badge tone={runtimeSettings?.webhookConfigured ? "success" : "danger"}>
                      {runtimeSettings?.webhookConfigured ? "Configurado" : "Pendente"}
                    </Badge>
                  </div>
                  <div className={styles.detailAction}>
                    <Button
                      className={styles.fullWidthButton}
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
                  </div>
                </section>

                <section className={styles.detailCard}>
                  <header>
                    <h2>Avisos aos atendentes</h2>
                  </header>
                  <div className={styles.detailRow}>
                    <span>Grupo</span>
                    <strong>{runtimeSettings?.attendantGroupJid ?? "Não configurado"}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Número fallback</span>
                    <strong>
                      {runtimeSettings?.attendantWhatsappNumber ?? "Não configurado"}
                    </strong>
                  </div>
                  {isSettingsLoading ? (
                    <div className={styles.emptyState}>
                      Carregando configurações...
                    </div>
                  ) : null}
                </section>
              </aside>
            </div>
          </>
        ) : activeView === "usuarios" ? (
          <>
            <div className={styles.filterTabs} data-hub-filter-tabs>
              <button
                className={`${styles.filterTab} ${styles.filterTabActive}`}
              >
                Todos
                <span>{users.length}</span>
              </button>
              <button className={styles.filterTab}>
                Ativos
                <span>
                  {users.filter((user) => user.active).length}
                </span>
              </button>
              <button className={styles.filterTab}>
                Sem WhatsApp
                <span>
                  {users.filter((user) => !user.whatsappPhone).length}
                </span>
              </button>
            </div>

            <div className={styles.usersGrid}>
              <section className={styles.usersList}>
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
                    <article key={user.id} className={styles.userManagementCard}>
                      <div className={styles.userCardHeader}>
                        <div className={styles.userAvatar}>
                          {getInitial(user.name)}
                        </div>
                        <div>
                          <h2 style={{ fontSize: 17 }}>{user.name}</h2>
                          <p className={styles.mutedText}>{user.email}</p>
                        </div>
                        <Badge tone={user.active ? "success" : "neutral"}>
                          {user.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>

                      <div className={styles.cardDetailRow}>
                        <span className={styles.mutedText}>Perfil</span>
                        <strong>{getRoleLabel(user.role)}</strong>
                      </div>
                      <div className={`${styles.cardDetailRow} ${styles.cardDetailRowCompact}`}>
                        <span className={styles.mutedText}>WhatsApp</span>
                        <strong>{user.whatsappPhone ?? "Não vinculado"}</strong>
                      </div>

                      <div className={styles.formGrid}>
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

                      <div className={styles.inlineActions}>
                        <Button
                          className={styles.inlineGrow}
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
                          className={styles.inlineGrow}
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

                      <div className={styles.inlineActions}>
                        <DropdownField
                          value={draft.transferToUserId}
                          onChange={(value) =>
                            handleUpdateUserDraft(user.id, {
                              transferToUserId: value,
                            })
                          }
                          disabled={!canTransferTickets || isMutating}
                          className={styles.inlineGrow}
                          options={[
                            { label: "Transferir tickets para...", value: "" },
                            ...transferableUsers.map((candidateUser) => ({
                              label: candidateUser.name,
                              value: candidateUser.id,
                            })),
                          ]}
                        />
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

                      <div className={styles.permissionGrid}>
                        {permissions.map((permission) => (
                          <span key={permission} className={styles.permissionPill}>
                            {permission}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
                {!isUsersLoading && visibleUsers.length === 0 ? (
                  <div className={styles.emptyState}>
                    Nenhum usuário encontrado.
                  </div>
                ) : null}
                {isUsersLoading ? (
                  <div className={styles.emptyState}>
                    Carregando usuários...
                  </div>
                ) : null}
              </section>

              <aside className={styles.detailsColumn}>
                <section className={styles.detailCard}>
                  <header>
                    <h2>Gestão de acessos</h2>
                  </header>
                  <div className={styles.detailRow}>
                    <span>Admins</span>
                    <strong>{users.filter((user) => user.role === "admin").length}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Supervisores</span>
                    <strong>
                      {users.filter((user) => user.role === "supervisor").length}
                    </strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Atendentes</span>
                    <strong>
                      {users.filter((user) => user.role === "atendente").length}
                    </strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>WhatsApp vinculado</span>
                    <strong>
                      {users.filter((user) => Boolean(user.whatsappPhone)).length}
                    </strong>
                  </div>
                </section>

                <section className={styles.detailCard}>
                  <header>
                    <h2>Cadastrar atendente</h2>
                  </header>
                  <div className={styles.scrollableCardBody}>
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
                    <DropdownField
                      value={createUserForm.role}
                      onChange={(value) =>
                        setCreateUserForm((currentForm) => ({
                          ...currentForm,
                          role: value,
                        }))
                      }
                      disabled={currentUser.role !== "admin" || isMutating}
                      options={userRoleOptions}
                    />
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
                      <p className={styles.mutedText}>
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
            <div className={styles.filterTabs} data-hub-filter-tabs>
              <button
                className={`${styles.filterTab} ${styles.filterTabActive}`}
              >
                Todos os clientes
                <span>{clients.length}</span>
              </button>
              <button
                className={styles.newConversationButton}
                onClick={() => openClientDialog()}
              >
                Novo cliente
              </button>
            </div>

            <div className={styles.clientsGrid}>
              <aside className={styles.clientList}>
                {clients.map((client) => {
                  const isSelected = activeClient?.key === client.key;

                  return (
                    <button
                      key={client.key}
                      className={`${styles.clientButton} ${
                        isSelected ? styles.ticketButtonActive : ""
                      }`}
                      onClick={() => setSelectedClientKey(client.key)}
                    >
                      <div className={`${styles.ticketCode} ${styles.active}`}>
                        {getInitial(client.name)}
                      </div>
                      <div>
                        <strong>{client.name}</strong>
                        <p className={styles.mutedText}>
                          {formatBrazilianPhone(client.phone) || client.identity}
                        </p>
                        <p className={styles.mutedText}>
                          {client.openTickets} aberto(s) · {client.finishedTickets} finalizado(s)
                        </p>
                      </div>
                    </button>
                  );
                })}
                {!isLoading && clients.length === 0 ? (
                  <div className={styles.emptyState}>
                    Nenhum cliente encontrado.
                  </div>
                ) : null}
              </aside>

              <section className={styles.profilePanel}>
                {activeClient ? (
                  <>
                    <header className={styles.profileHeader}>
                      <div className={`${styles.ticketCode} ${styles.active} ${styles.profileAvatar}`}>
                        {getInitial(activeClient.name)}
                      </div>
                      <div className={styles.profileHeaderContent}>
                        <h2>{activeClient.name}</h2>
                        <p className={styles.mutedText}>
                          {formatBrazilianPhone(activeClient.phone) || activeClient.identity}
                        </p>
                      </div>
                      <div className={styles.profileActions}>
                        <button
                          className={styles.primaryButton}
                          onClick={() => openStartConversationForClient(activeClient)}
                          disabled={!activeClient.phone}
                        >
                          <Send size={16} />
                          Enviar msg
                        </button>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => openClientDialog(activeClient)}
                        >
                          Editar
                        </button>
                      </div>
                    </header>

                    <div className={styles.profileBody}>
                      <div className={styles.metricGrid}>
                        <div className={styles.metricCard}>
                          <span className={styles.mutedText}>Atendimentos</span>
                          <h2>{activeClient.tickets.length}</h2>
                        </div>
                        <div className={styles.metricCard}>
                          <span className={styles.mutedText}>Em aberto</span>
                          <h2>{activeClient.openTickets}</h2>
                        </div>
                        <div className={styles.metricCard}>
                          <span className={styles.mutedText}>Finalizados</span>
                          <h2>{activeClient.finishedTickets}</h2>
                        </div>
                        <div className={styles.metricCard}>
                          <span className={styles.mutedText}>Nota média</span>
                          <h2>
                            {activeClient.averageFeedback
                              ? activeClient.averageFeedback.toFixed(1)
                              : "-"}
                          </h2>
                        </div>
                      </div>

                      <section className={styles.detailCard}>
                        <header>
                          <h2>Dados do cliente</h2>
                        </header>
                        <div className={styles.detailRow}>
                          <span>Telefone</span>
                          <strong>
                            {formatBrazilianPhone(activeClient.phone) || "Não resolvido"}
                          </strong>
                        </div>
                        <div className={styles.detailRow}>
                          <span>LID</span>
                          <strong>{activeClient.lid ?? "-"}</strong>
                        </div>
                        <div className={styles.detailRow}>
                          <span>Último atendimento</span>
                          <strong>{formatDateTime(activeClient.latestTicket?.updatedAt ?? null)}</strong>
                        </div>
                      </section>

                      <section className={styles.detailCard}>
                        <header>
                          <h2>Observações internas</h2>
                        </header>
                        <div className={styles.noteBody}>
                          <textarea
                            value={clientNotes[activeClient.key] ?? ""}
                            onChange={(event) =>
                              setClientNotes((currentNotes) => ({
                                ...currentNotes,
                                [activeClient.key]: event.target.value,
                              }))
                            }
                            placeholder="Adicione uma observação sobre este cliente..."
                            className={styles.noteBox}
                          />
                        </div>
                        <footer className={styles.noteFooter}>
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

                      <section className={styles.detailCard}>
                        <header>
                          <h2>Histórico de atendimentos</h2>
                        </header>
                        {activeClient.tickets.map((ticket) => (
                          <button
                            key={ticket.id}
                            className={styles.dashboardListButton}
                            onClick={() => handleSelectClientTicket(ticket.id)}
                          >
                            <div className={`${styles.ticketCode} ${styles.done}`}>
                              {getTicketCode(ticket)}
                            </div>
                            <div>
                              <strong>{statusLabels[ticket.status]}</strong>
                              <p className={styles.mutedText}>
                                {ticket.lastMessage ?? "Sem mensagens"}
                              </p>
                            </div>
                            <span className={styles.mutedText}>
                              {formatDateTime(ticket.updatedAt)}
                            </span>
                          </button>
                        ))}
                        {activeClient.tickets.length === 0 ? (
                          <div className={styles.emptyState}>
                            Nenhum atendimento para este cliente.
                          </div>
                        ) : null}
                      </section>
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    Selecione um cliente.
                  </div>
                )}
              </section>

              <aside className={styles.detailsColumn}>
                <section className={styles.detailCard}>
                  <header>
                    <h2>Resumo</h2>
                  </header>
                  <div className={styles.detailRow}>
                    <span>Clientes</span>
                    <strong>{clients.length}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Com ticket aberto</span>
                    <strong>{clients.filter((client) => client.openTickets > 0).length}</strong>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Sem telefone resolvido</span>
                    <strong>{clients.filter((client) => !client.phone).length}</strong>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : activeView === "mensagens" ? (
          <div className={styles.dashboardGrid}>
            <section className={styles.dashboardMain}>
              <section className={styles.detailCard}>
                <header>
                  <h2>Mensagens</h2>
                </header>
                <div className={styles.emptyState}>
                  Os modelos de mensagem e automações de conversa vão ficar nesta página.
                </div>
              </section>
            </section>
          </div>
        ) : activeView === "integracoes" ? (
          <div className={styles.dashboardGrid}>
            <section className={styles.dashboardMain}>
              <section className={styles.detailCard}>
                <header>
                  <h2>Integrações</h2>
                </header>
                <div className={styles.emptyState}>
                  Os conectores externos vão ficar nesta página.
                </div>
              </section>
            </section>
          </div>
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
                  <span>{getCountForFilter(ticketsInTodayQueue, item.value)}</span>
                </button>
              ))}
              <button
                className={styles.newConversationButton}
                onClick={() => setIsStartConversationOpen(true)}
              >
                <Send size={16} />
                Nova conversa
              </button>
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
	                      className={mainTicketAction.className}
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
                  {item.kind === "audio" ? (
                    <div className={styles.audioMessage}>
                      <p>{item.content}</p>
                      <audio
                        controls
                        preload="none"
                        src={`/api/tickets/${item.ticketId}/messages/${item.id}/media`}
                      />
                    </div>
                  ) : (
                    <p>{item.content}</p>
                  )}
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
                    <input
                      ref={audioInputRef}
                      type="file"
                      accept="audio/*"
                      className={styles.hiddenInput}
                      onChange={(event) => {
                        handleAudioFileChange(event.target.files?.[0] ?? null);
                        event.target.value = "";
                      }}
                    />
                    <button
                      className={styles.iconButton}
                      title="Anexar áudio"
                      onClick={() => audioInputRef.current?.click()}
                      disabled={!canWriteToTicket || isMutating || isRecordingAudio}
                    >
                      <Paperclip size={18} />
                    </button>
                    <button
                      className={`${styles.iconButton} ${
                        isRecordingAudio ? styles.recordingButton : ""
                      }`}
                      title={isRecordingAudio ? "Parar gravação" : "Gravar áudio"}
                      onClick={() => {
                        void handleToggleAudioRecording();
                      }}
                      disabled={!canWriteToTicket || isMutating}
                    >
                      {isRecordingAudio ? <Square size={16} /> : <Mic size={18} />}
                    </button>
                    <button
                      className={`${styles.sendButton} ${styles.sendIconButton}`}
                      onClick={handleSendMessage}
                      title="Enviar mensagem"
                      aria-label="Enviar mensagem"
                      disabled={
                        !canWriteToTicket ||
                        !message.trim() ||
                        isMutating ||
                        isRecordingAudio
                      }
                    >
                      {isMutating ? (
                        <LoaderCircle className={styles.loadingIcon} size={18} />
                      ) : (
                        <Send size={18} />
                      )}
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
                    <strong>
                      {formatBrazilianPhone(activeTicket.customerPhone) || "Não resolvido"}
                    </strong>
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
                    disabled={
                      isMutating ||
                      !canFinishTicket ||
                      !canSendToActiveCustomer ||
                      isFinishCategoryOpen
                    }
                  >
                    <LoadingLabel
                      isLoading={isMutating}
                      label="Escolher categoria e finalizar"
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
