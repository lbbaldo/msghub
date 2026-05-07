import type { HTMLAttributes, ReactNode } from "react";

import styles from "@/shared/ui/Panel.module.css";

type PanelProps = HTMLAttributes<HTMLElement> & {
  bodyClassName?: string;
  footer?: ReactNode;
  footerClassName?: string;
  headerClassName?: string;
  title?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
};

const joinClassNames = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(" ");

export function Panel({
  bodyClassName,
  children,
  className,
  footer,
  footerClassName,
  headerAction,
  headerClassName,
  title,
  ...props
}: PanelProps) {
  return (
    <section className={joinClassNames(styles.panel, className)} {...props}>
      {title || headerAction ? (
        <header className={joinClassNames(styles.header, headerClassName)}>
          {title}
          {headerAction}
        </header>
      ) : null}
      <div className={joinClassNames(styles.body, bodyClassName)}>{children}</div>
      {footer ? (
        <footer className={joinClassNames(styles.footer, footerClassName)}>
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
