import type { HTMLAttributes } from "react";

import styles from "@/shared/ui/Badge.module.css";

type BadgeTone = "success" | "neutral" | "danger";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const getBadgeClassName = (
  tone: BadgeTone,
  className: string | undefined,
): string =>
  [
    styles.badge,
    tone === "neutral" ? styles.neutral : "",
    tone === "danger" ? styles.danger : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

export function Badge({ className, tone = "success", ...props }: BadgeProps) {
  return <span className={getBadgeClassName(tone, className)} {...props} />;
}
