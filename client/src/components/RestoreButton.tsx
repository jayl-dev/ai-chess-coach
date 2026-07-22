import styles from "./RestoreButton.module.css";

type Props = {
  onClick?: () => void;
  children: React.ReactNode;
};

export function RestoreButton({ onClick, children }: Props) {
  return (
    <button type="button" className={styles.restoreBtn} onClick={onClick}>
      {children}
    </button>
  );
}
