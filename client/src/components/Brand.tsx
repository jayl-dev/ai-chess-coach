import styles from "./Brand.module.css";
import { assetUrl } from "../config/runtime";

type Props = {
  onClick?: () => void;
};

export function Brand({ onClick }: Props) {
  return (
    <button type="button" className={styles.brand} aria-label="Chess Coach" onClick={onClick}>
      <img src={assetUrl("logo.png")} alt="" className={styles.logo} draggable={false} />
      <span className={styles.brandText}>
        <span className={styles.brandChess}>CHESS</span>
        <span className={styles.brandCoach}>COACH</span>
      </span>
    </button>
  );
}
