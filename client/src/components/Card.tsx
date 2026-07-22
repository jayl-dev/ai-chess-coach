import type { ReactNode, CSSProperties } from "react";
import styles from "./Card.module.css";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function Card({ children, className, style }: Props) {
  return (
    <div className={`${styles.card}${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </div>
  );
}
