import styles from "./ExplanationBox.module.css";

type Props = {
  children: React.ReactNode;
};

export function ExplanationBox({ children }: Props) {
  return <div className={styles.explanationBox}>{children}</div>;
}
