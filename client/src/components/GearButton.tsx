import styles from "./GearButton.module.css";

type Props = {
  onClick?: () => void;
  label?: string;
  icon?: string;
};

export function GearButton({ onClick, label = "Open settings", icon = "fa-gear" }: Props) {
  return (
    <button type="button" className={styles.gearBtn} aria-label={label} onClick={onClick}>
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
    </button>
  );
}
