import { Bell, Search, SlidersHorizontal } from "lucide-react";

import {
  formatDateTime,
  ui,
  type SupportNotification,
} from "@/modules/support/components/SupportDashboard.model";
import styles from "@/modules/support/components/SupportDashboard.module.css";

type SupportTopbarProps = {
  isNotificationsOpen: boolean;
  notifications: SupportNotification[];
  pageSubtitle: string;
  pageTitle: string;
  query: string;
  searchPlaceholder: string;
  onQueryChange: (query: string) => void;
  onSelectNotification: (notification: SupportNotification) => void;
  onToggleNotifications: () => void;
};

export function SupportTopbar({
  isNotificationsOpen,
  notifications,
  pageSubtitle,
  pageTitle,
  query,
  searchPlaceholder,
  onQueryChange,
  onSelectNotification,
  onToggleNotifications,
}: SupportTopbarProps) {
  return (
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
            onChange={(event) => onQueryChange(event.target.value)}
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
            onClick={onToggleNotifications}
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
                    onClick={() => onSelectNotification(notification)}
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
  );
}
