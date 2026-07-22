import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CastlingRights } from "../types/app";
import styles from "./SideToggle.module.css";

type Props = {
  value?: CastlingRights;
  onChange?: (value: CastlingRights) => void;
  disabled?: boolean;
};

export function CastlingToggle({ value = "none", onChange, disabled = false }: Props) {
  const reduceMotion = useReducedMotion();
  const queenActive = value === "queen" || value === "both";
  const kingActive = value === "king" || value === "both";

  const handleToggle = (side: "queen" | "king") => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        /* ignore */
      }
    }
    const nextQueen = side === "queen" ? !queenActive : queenActive;
    const nextKing = side === "king" ? !kingActive : kingActive;
    onChange?.(nextQueen && nextKing ? "both" : nextQueen ? "queen" : nextKing ? "king" : "none");
  };

  return (
    <div
      className={`${styles.castlingControl}${disabled ? ` ${styles.castlingDisabled}` : ""}`}
      role="group"
      aria-label="Castling rights for the side to move"
    >
      {(
        [
          { side: "queen", label: "QUEEN", active: queenActive },
          { side: "king", label: "KING", active: kingActive },
        ] as const
      ).map(({ side, label, active }) => (
        <motion.button
          key={side}
          type="button"
          aria-pressed={active}
          aria-label={`${label === "QUEEN" ? "Queen" : "King"}-side castling ${active ? "available" : "unavailable"}`}
          className={`${styles.castlingSide}${active ? ` ${styles.castlingSideAvailable}` : ` ${styles.castlingSideUnavailable}`}`}
          onClick={() => handleToggle(side)}
          disabled={disabled}
          whileTap={disabled || reduceMotion ? undefined : { scale: 0.94 }}
          transition={{ scale: { duration: reduceMotion ? 0 : 0.1 } }}
        >
          <span className={styles.castlingIconWrap}>
            <AnimatePresence initial={false}>
              <motion.i
                key={`${side}-${active ? "active" : "inactive"}`}
                className={`fa-solid fa-chess-rook ${styles.castlingIcon}`}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                exit={{ scaleX: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
                aria-hidden="true"
              />
            </AnimatePresence>
          </span>
          <span className={styles.castlingLabelWrap}>
            <AnimatePresence initial={false}>
              <motion.span
                key={`${side}-label-${active ? "active" : "inactive"}`}
                className={styles.castlingLabel}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                exit={{ scaleX: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
              >
                <span>{label}</span>
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.button>
      ))}
    </div>
  );
}
