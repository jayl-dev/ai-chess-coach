import { Card } from "./Card";
import { EvalChip } from "./EvalChip";
import { ChessBoard } from "./ChessBoard";
import { ExplanationBox } from "./ExplanationBox";
import { ShowNextMoves } from "./ShowNextMoves";
import { CandyDeco } from "./CandyDeco";
import type { AnalysisResult } from "../types/app";
import styles from "./ResultCard.module.css";

type Props = {
  result: AnalysisResult;
  showArrow: boolean;
  showHighlights: boolean;
  onViewSource?: () => void;
  sourceMode?: "camera" | "monitor";
};

export function ResultCard({ result, showArrow, showHighlights, onViewSource, sourceMode }: Props) {
  return (
    <Card className={styles.card}>
      <CandyDeco className={`${styles.candyDec} ${styles.candyTr}`} />
      <CandyDeco className={`${styles.candyDec} ${styles.candyBl}`} />

      <div className={styles.hud}>
        <EvalChip evaluation={result.evaluation} />
        <div className={styles.bestMove}>
          Best move:
          <i className={`fa-solid fa-chess-king ${styles.kingIcon}`} aria-hidden="true" />
          {result.bestMove.san}
        </div>
      </div>

      <ChessBoard
        board={result.board}
        move={result.bestMove}
        orientation={result.orientation}
        showArrow={showArrow}
        showHighlights={showHighlights}
      />

      <ExplanationBox>{result.explanation}</ExplanationBox>

      <ShowNextMoves moves={result.principalVariation} />

      {onViewSource && (
        <button type="button" className={styles.viewSourceButton} onClick={onViewSource}>
          <i className="fa-solid fa-image" aria-hidden="true" />
          {sourceMode === "camera" ? "View Camera Shot" : "View Screenshot"}
        </button>
      )}
    </Card>
  );
}
