import styles from "./Dropdown.module.css";

type Props = {
  value: string;
  onChange?: (value: string) => void;
  options: { id: string; label: string }[];
  ariaLabel?: string;
};

export function Dropdown({ value, onChange, options, ariaLabel }: Props) {
  return (
    <div className={styles.dropdown}>
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={ariaLabel}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <span className={styles.valueLabel}>
        {options.find((o) => o.id === value)?.label ?? value}
      </span>
      <i className={`fa-solid fa-chevron-down ${styles.chev}`} aria-hidden="true" />
    </div>
  );
}
