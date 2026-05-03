import type { HTMLAttributes, ReactNode } from "react";

import styles from "@/shared/ui/Panel.module.css";

type PanelProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
};

const joinClassNames = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(" ");

export function Panel({
  children,
  className,
  headerAction,
  title,
  ...props
}: PanelProps) {
  return (
    <section className={joinClassNames(styles.panel, className)} {...props}>
      {title || headerAction ? (
        <header className={styles.header}>
          {title}
          {headerAction}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
