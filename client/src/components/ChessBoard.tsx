import type { AnalysisMove, Board, Piece, SideToMove, SquareName } from "../types/app";
import styles from "./ChessBoard.module.css";

const PIECE_ICONS: Record<Piece["type"], string> = {
  K: "fa-chess-king",
  Q: "fa-chess-queen",
  R: "fa-chess-rook",
  B: "fa-chess-bishop",
  N: "fa-chess-knight",
  P: "fa-chess-pawn",
};

type Props = {
  board: Board;
  move: AnalysisMove;
  orientation: SideToMove;
  showArrow: boolean;
  showHighlights: boolean;
};

type Point = { x: number; y: number };

function squareCenter(square: SquareName, orientation: SideToMove): Point {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  const column = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 8 - rank : rank - 1;
  return { x: column * 12.5 + 6.25, y: row * 12.5 + 6.25 };
}

function orientedBoard(board: Board, orientation: SideToMove): Board {
  if (orientation === "white") return board;
  return [...board].reverse().map((row) => [...row].reverse());
}

export function ChessBoard({ board, move, orientation, showArrow, showHighlights }: Props) {
  const visibleBoard = orientedBoard(board, orientation);
  const from = squareCenter(move.from, orientation);
  const to = squareCenter(move.to, orientation);

  return (
    <div className={styles.boardWrapper} aria-label={`Chess position, ${orientation} at bottom`}>
      <div className={styles.board}>
        {visibleBoard.map((row, rowIndex) =>
          row.map((piece, columnIndex) => {
            const isLight = (rowIndex + columnIndex) % 2 === 0;
            return (
              <div
                key={`${rowIndex}-${columnIndex}`}
                className={`${styles.sq}${isLight ? ` ${styles.light}` : ` ${styles.dark}`}`}
              >
                {piece && (
                  <i
                    className={`fa-solid ${PIECE_ICONS[piece.type]} ${
                      piece.color === "w" ? styles.pcW : styles.pcB
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          }),
        )}
      </div>

      <svg className={styles.boardOverlay} viewBox="0 0 100 100" aria-hidden="true">
        {showHighlights && (
          <g data-testid="move-highlights">
            {[from, to].map((point, index) => (
              <rect
                key={index}
                x={point.x - 5.75}
                y={point.y - 5.75}
                width="11.5"
                height="11.5"
                fill="rgba(255,147,147,0.4)"
                stroke="var(--coral)"
                strokeWidth="1.2"
                rx="1.5"
              />
            ))}
          </g>
        )}
        {showArrow &&
          (() => {
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return null;
            const ux = dx / len;
            const uy = dy / len;
            const headLen = 7;
            const headHalf = 3.5;
            const bx = to.x - ux * headLen;
            const by = to.y - uy * headLen;
            const headPoints = `${to.x},${to.y} ${bx - uy * headHalf},${by + ux * headHalf} ${bx + uy * headHalf},${by - ux * headHalf}`;
            return (
              <g data-testid="move-arrow">
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={bx}
                  y2={by}
                  stroke="var(--text-dark)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={bx}
                  y2={by}
                  stroke="var(--teal)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <polygon
                  points={headPoints}
                  fill="var(--teal)"
                  stroke="var(--text-dark)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </g>
            );
          })()}
      </svg>
    </div>
  );
}
