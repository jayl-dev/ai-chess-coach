import { Brand } from "./Brand";
import { GearButton } from "./GearButton";
import styles from "./Header.module.css";

type Props = {
  onBrandClick?: () => void;
  onGearClick?: () => void;
  variant?: "default" | "settings";
  onBackClick?: () => void;
};

export function Header({ onBrandClick, onGearClick, variant = "default", onBackClick }: Props) {
  if (variant === "settings") {
    return (
      <header className={`${styles.header} ${styles.settingsHeader}`}>
        <GearButton onClick={onBackClick} label="Back to coach" icon="fa-arrow-left" />
        <h1 className={styles.settingsTitle}>Settings</h1>
        <span className={styles.actionSpacer} aria-hidden="true" />
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <Brand onClick={onBrandClick} />
      <div className={styles.headerControls}>
        <GearButton onClick={onGearClick} />
      </div>
    </header>
  );
}
