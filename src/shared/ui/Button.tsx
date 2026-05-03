import type { ButtonHTMLAttributes, ReactNode } from "react";

import styles from "@/shared/ui/Button.module.css";

type ButtonVariant = "default" | "primary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
};

const getButtonClassName = (
  variant: ButtonVariant,
  fullWidth: boolean,
  className: string | undefined,
): string =>
  [
    styles.button,
    variant === "primary" ? styles.primary : "",
    variant === "ghost" ? styles.ghost : "",
    fullWidth ? styles.fullWidth : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

export function Button({
  children,
  className,
  fullWidth = false,
  leftIcon,
  type = "button",
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={getButtonClassName(variant, fullWidth, className)}
      type={type}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  );
}
