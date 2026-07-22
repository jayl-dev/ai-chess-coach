import styles from "./ShowNextMoves.module.css";

type Props = {
  moves: string[];
};

export function ShowNextMoves({ moves }: Props) {
  return (
    <section className={styles.wrap} aria-labelledby="next-moves-title">
      <h3 id="next-moves-title" className={styles.heading}>
        Next moves
      </h3>
      <div className={styles.pv}>
        <ol className={styles.list}>
          {moves.map((move) => (
            <li key={move}>{move}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
