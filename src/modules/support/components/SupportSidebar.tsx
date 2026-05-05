import { ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";

import type { CurrentUser } from "@/shared/auth/types";
import {
  getInitial,
  sidebarItems,
  statusLabels,
  ui,
  type AppView,
} from "@/modules/support/components/SupportDashboard.model";
import styles from "@/modules/support/components/SupportDashboard.module.css";
import { LoadingLabel } from "@/shared/ui/LoadingLabel";

type SupportSidebarProps = {
  activeView: AppView;
  currentUser: CurrentUser;
  isLoggingOut: boolean;
  onLogout: () => void;
  onSelectView: (view: AppView) => void;
};

export function SupportSidebar({
  activeView,
  currentUser,
  isLoggingOut,
  onLogout,
  onSelectView,
}: SupportSidebarProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <aside className={styles.sidebar} style={ui.sidebar} data-hub-sidebar>
      <div className={styles.logo} style={ui.logo}>
        aiqfome
      </div>
      <nav
        className={styles.navigation}
        style={ui.navigation}
        aria-label="Menu principal"
      >
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
                  onSelectView(item.view);
                }
              }}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className={styles.sidebarUserMenu}>
        {isUserMenuOpen ? (
          <div className={styles.sidebarUserDropdown}>
            <button
              className={styles.sidebarUserDropdownItem}
              onClick={onLogout}
              disabled={isLoggingOut}
            >
              <LoadingLabel
                isLoading={isLoggingOut}
                label="Sair da conta"
                loadingLabel="Saindo..."
                icon={<LogOut size={16} />}
              />
            </button>
          </div>
        ) : null}
        <button
          className={styles.userCard}
          style={ui.userCard}
          onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
          aria-expanded={isUserMenuOpen}
          aria-haspopup="menu"
        >
          <div className={styles.userAvatar} style={ui.userAvatar}>
            {getInitial(currentUser.name)}
          </div>
          <div>
            <strong>{currentUser.name}</strong>
            <span style={ui.mutedText}>{statusLabels.em_atendimento}</span>
          </div>
          <ChevronDown
            className={isUserMenuOpen ? styles.sidebarUserChevronOpen : ""}
            size={16}
          />
        </button>
      </div>
    </aside>
  );
}
