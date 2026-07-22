import type { CSSProperties } from "react";
import styles from "./BackgroundPieces.module.css";

export type BgPieceKind = "pawn" | "knight" | "rook" | "bishop";

const FA_CLASS: Record<BgPieceKind, string> = {
  pawn: "fa-solid fa-chess-pawn",
  knight: "fa-solid fa-chess-knight",
  rook: "fa-solid fa-chess-rook",
  bishop: "fa-solid fa-chess-bishop",
};

const SIZE_CLASS: Record<BgPieceKind, string> = {
  pawn: styles.sizePawn,
  knight: styles.sizeKnight,
  rook: styles.sizeRook,
  bishop: styles.sizeBishop,
};

export type BgPieceConfig = {
  kind: BgPieceKind;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  rotate: number;
};

export function BackgroundPieces({ pieces }: { pieces: BgPieceConfig[] }) {
  return (
    <div className={styles.bgPieces} aria-hidden="true">
      {pieces.map((p, i) => {
        const style: CSSProperties = {
          transform: `rotate(${p.rotate}deg)`,
        };
        if (p.top !== undefined) style.top = p.top;
        if (p.bottom !== undefined) style.bottom = p.bottom;
        if (p.left !== undefined) style.left = p.left;
        if (p.right !== undefined) style.right = p.right;
        return (
          <div key={i} className={`${styles.bgPiece} ${SIZE_CLASS[p.kind]}`} style={style}>
            <i className={FA_CLASS[p.kind]} />
          </div>
        );
      })}
    </div>
  );
}
