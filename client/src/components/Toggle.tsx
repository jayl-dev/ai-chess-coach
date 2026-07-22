import styles from "./Toggle.module.css";

type Props = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
};

export function Toggle({ checked = false, onChange, ariaLabel, disabled = false }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`${styles.toggle}${checked ? ` ${styles.on}` : ""}`}
      onClick={() => onChange?.(!checked)}
    />
  );
}
