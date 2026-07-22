import styles from "./EvalChip.module.css";
import type { AnalysisEvaluation } from "../types/app";

type Props = {
  evaluation: AnalysisEvaluation;
};

export function EvalChip({ evaluation }: Props) {
  return (
    <div className={styles.evalContainer}>
      <div className={styles.winningText}>{evaluation.label.toUpperCase()}!</div>
      <div className={styles.evalChip}>{evaluation.display}</div>
    </div>
  );
}
