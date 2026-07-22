import { createElement } from "react";
import { assetUrl } from "../config/runtime";
import type { ProgressStage } from "../types/app";
import styles from "./StarsLoader.module.css";

const STAGES: ReadonlyArray<{ id: ProgressStage; label: string }> = [
  { id: "capturing", label: "Capturing board…" },
  { id: "reading-position", label: "Reading position…" },
  { id: "validating-position", label: "Double-checking every square…" },
  { id: "calculating-move", label: "Calculating best move…" },
  { id: "preparing-explanation", label: "Preparing explanation…" },
];

type Props = {
  stage?: ProgressStage;
};

export function StarsLoader({ stage = "capturing" }: Props) {
  const stageIndex = Math.max(
    0,
    STAGES.findIndex((candidate) => candidate.id === stage),
  );

  return (
    <div className={styles.loader} role="status" aria-live="polite">
      <div className={styles.animation} aria-hidden="true">
        {createElement("lottie-player", {
          src: assetUrl("Stars.json"),
          background: "transparent",
          speed: "1",
          loop: true,
          autoplay: true,
        })}
      </div>
      <span className={styles.label}>{STAGES[stageIndex].label}</span>
      <span className={styles.progress} aria-hidden="true">
        {STAGES.map((progressStage, index) => (
          <span
            key={progressStage.id}
            className={`${styles.progressDot}${index <= stageIndex ? ` ${styles.progressDotActive}` : ""}`}
          />
        ))}
      </span>
    </div>
  );
}
