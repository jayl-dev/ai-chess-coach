import styles from "./ThemePills.module.css";
import type { AccentTheme } from "../types/app";

type Props = {
  value: AccentTheme;
  onChange: (theme: AccentTheme) => void;
};

const OPTIONS: { id: AccentTheme; label: string }[] = [
  { id: "mint", label: "Mint" },
  { id: "coral", label: "Coral" },
  { id: "lavender", label: "Lavender" },
];

export function ThemePills({ value, onChange }: Props) {
  return (
    <div className={styles.themePills} role="radiogroup" aria-label="Accent color">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`${styles.themePill}${value === o.id ? ` ${styles.active}` : ""}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
