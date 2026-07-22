import styles from "./Slider.module.css";

type Props = {
  value?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
};

export function Slider({ value = 12, min = 8, max = 16, onChange }: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={styles.sliderContainer}>
      <input
        type="range"
        className={styles.input}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        aria-label="Search depth"
      />
      <div className={styles.sliderTrack}>
        <div className={styles.sliderFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.sliderThumb} style={{ left: `${pct}%` }} aria-hidden="true" />
    </div>
  );
}
