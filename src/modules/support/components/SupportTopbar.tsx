import { Bell, Search, SlidersHorizontal } from "lucide-react";

import {
  formatDateTime,
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
    <header className={styles.topbar} data-hub-topbar>
      <div>
        <h1>{pageTitle}</h1>
        <p>{pageSubtitle}</p>
      </div>
      <div className={styles.topbarActions}>
        <label className={styles.searchBox}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
        <button className={styles.iconButton} title="Filtros">
          <SlidersHorizontal size={18} />
        </button>
        <div className={styles.notificationWrapper}>
          <button
            className={styles.iconButton}
            title="Notificações"
            onClick={onToggleNotifications}
          >
            <Bell size={18} />
            {notifications.length > 0 ? (
              <span className={styles.notificationBadge}>
                {notifications.length}
              </span>
            ) : null}
          </button>
          {isNotificationsOpen ? (
            <section className={styles.notificationPanel}>
              <header className={styles.notificationPanelHeader}>
                <strong>Avisos</strong>
                <span className={styles.mutedText}>
                  {notifications.length} pendência(s)
                </span>
              </header>
              <div className={styles.notificationList}>
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    className={styles.notificationItem}
                    onClick={() => onSelectNotification(notification)}
                  >
                    <span
                      className={`${styles.notificationTone} ${
                        notification.tone === "danger"
                          ? styles.notificationToneDanger
                          : ""
                      } ${
                        notification.tone === "warning"
                          ? styles.notificationToneWarning
                          : ""
                      }`}
                    />
                    <span>
                      <strong>{notification.title}</strong>
                      <p className={`${styles.mutedText} ${styles.notificationText}`}>
                        {notification.description}
                      </p>
                      <span className={`${styles.mutedText} ${styles.notificationTime}`}>
                        {formatDateTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                ))}
                {notifications.length === 0 ? (
                  <div className={styles.emptyState}>
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
