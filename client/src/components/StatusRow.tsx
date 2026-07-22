import type { ReactNode } from "react";
import styles from "./StatusRow.module.css";

type Props = {
  icon: ReactNode;
  iconClassName?: string;
  label: string;
  statusDot?: "green";
  value?: string;
};

export function StatusRow({ icon, iconClassName, label, statusDot, value }: Props) {
  return (
    <div className={styles.statusRow}>
      <span className={`${styles.statusIcon}${iconClassName ? ` ${iconClassName}` : ""}`}>
        {icon}
      </span>
      <span className={styles.statusLabel}>{label}</span>
      {statusDot && <span className={styles.statusDot} aria-hidden="true" />}
      {value && <span className={styles.statusValue}>{value}</span>}
    </div>
  );
}
