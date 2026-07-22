import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { SideToMove } from "../types/app";
import styles from "./SideToggle.module.css";

type Props = {
  value?: SideToMove;
  onChange?: (side: SideToMove) => void;
  disabled?: boolean;
};

export function SideToggle({ value = "white", onChange, disabled = false }: Props) {
  const reduceMotion = useReducedMotion();
  const isBlack = value === "black";
  const variantClass = isBlack ? styles.isBlack : styles.isWhite;

  const vibrate = () => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        /* ignore */
      }
    }
  };

  const handleToggle = () => {
    vibrate();
    onChange?.(isBlack ? "white" : "black");
  };

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={isBlack}
      aria-label={`${value} moves next. Tap to change the side to move.`}
      className={`${styles.togglePill} ${variantClass}`}
      onClick={handleToggle}
      disabled={disabled}
      whileTap={disabled || reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ scale: { duration: reduceMotion ? 0 : 0.1 } }}
    >
      <span className={styles.iconWrap}>
        <AnimatePresence initial={false}>
          <motion.i
            key={isBlack ? "k-black" : "k-white"}
            className={`fa-solid fa-chess-king ${styles.icon}`}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            aria-hidden="true"
          />
        </AnimatePresence>
      </span>
      <span className={styles.labelWrap}>
        <AnimatePresence initial={false}>
          <motion.span
            key={isBlack ? "t-black" : "t-white"}
            className={styles.label}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            exit={{ scaleX: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
          >
            <span>{value.toUpperCase()}</span>
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
