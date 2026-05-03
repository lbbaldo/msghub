import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import styles from "@/shared/ui/LoadingLabel.module.css";

type LoadingLabelProps = {
  isLoading: boolean;
  label: string;
  loadingLabel: string;
  icon?: ReactNode;
};

export function LoadingLabel({
  icon,
  isLoading,
  label,
  loadingLabel,
}: LoadingLabelProps) {
  return (
    <>
      {isLoading ? <LoaderCircle className={styles.icon} size={16} /> : icon}
      {isLoading ? loadingLabel : label}
    </>
  );
}
