import type { ReactNode } from "react";
import { BackgroundPieces, type BgPieceConfig } from "./BackgroundPieces";
import styles from "./ScreenShell.module.css";

type Props = {
  children: ReactNode;
  bgPieces?: BgPieceConfig[];
};

export function ScreenShell({ children, bgPieces = [] }: Props) {
  return (
    <div className={styles.screen}>
      <BackgroundPieces pieces={bgPieces} />
      {children}
    </div>
  );
}
