import { ChevronDown, LogOut } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { CurrentUser } from "@/shared/auth/types";
import {
  getInitial,
  sidebarItems,
  statusLabels,
  type AppView,
} from "@/modules/support/components/SupportDashboard.model";
import styles from "@/modules/support/components/SupportDashboard.module.css";
import { LoadingLabel } from "@/shared/ui/LoadingLabel";

type SupportSidebarProps = {
  activeView: AppView;
  currentUser: CurrentUser;
  isLoggingOut: boolean;
  onLogout: () => void;
};

export function SupportSidebar({
  activeView,
  currentUser,
  isLoggingOut,
  onLogout,
}: SupportSidebarProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <aside className={styles.sidebar} data-hub-sidebar>
      <div className={styles.logo}>
        aiqfome
      </div>
      <nav
        className={styles.navigation}
        aria-label="Menu principal"
      >
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.view === activeView;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
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
          onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
          aria-expanded={isUserMenuOpen}
          aria-haspopup="menu"
        >
          <div className={styles.userAvatar}>
            {getInitial(currentUser.name)}
          </div>
          <div>
            <strong>{currentUser.name}</strong>
            <span>{statusLabels.em_atendimento}</span>
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
