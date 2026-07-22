import type { CaptureMode } from "../types/app";
import styles from "./CapturedImagePanel.module.css";

type Props = {
  imageUrl: string;
  mode: CaptureMode;
  width: number;
  height: number;
};

export function CapturedImagePanel({ imageUrl, mode, width, height }: Props) {
  const sourceLabel = mode === "monitor" ? "Screenshot" : "Photo";
  return (
    <section className={styles.panel} aria-labelledby="capture-title">
      <div className={styles.headingRow}>
        <i className="fa-solid fa-circle-check" aria-hidden="true" />
        <h2 id="capture-title" className={styles.heading}>
          {sourceLabel} Captured
        </h2>
      </div>
      <div className={styles.imageFrame}>
        <img className={styles.image} src={imageUrl} alt={`${sourceLabel} of the chess board`} />
      </div>
      <p className={styles.meta}>
        {width} × {height} normalized JPEG
      </p>
      <p className={styles.instructions}>
        The board image is ready for analysis. Tap the active control to capture another image.
      </p>
    </section>
  );
}
