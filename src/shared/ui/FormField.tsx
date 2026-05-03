import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

import styles from "@/shared/ui/FormField.module.css";

const joinClassNames = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(" ");

export function TextField({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={joinClassNames(styles.field, className)} {...props} />;
}

export function SelectField({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={joinClassNames(styles.field, className)} {...props} />;
}

export function ToggleField({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={joinClassNames(styles.field, styles.toggleField, className)}
      {...props}
    />
  );
}
