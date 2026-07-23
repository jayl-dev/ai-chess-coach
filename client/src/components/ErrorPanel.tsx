import type { AppError } from "../types/app";
import styles from "./ErrorPanel.module.css";

type Props = {
  error: AppError;
  onRetry: () => void;
  onOpenSettings: () => void;
};

export function ErrorPanel({ error, onRetry, onOpenSettings }: Props) {
  return (
    <section className={styles.panel} role="alert" aria-labelledby="error-title">
      <span className={styles.iconWrap} aria-hidden="true">
        <i className="fa-solid fa-triangle-exclamation" />
      </span>
      <h2 id="error-title" className={styles.title}>
        {error.title}
      </h2>
      <p className={styles.message}>{error.message}</p>
      {import.meta.env.DEV && error.debugDetails?.length ? (
        <details className={styles.debugDetails} open>
          <summary>Development error details</summary>
          <pre>{error.debugDetails.join("\n")}</pre>
        </details>
      ) : null}
      <div className={styles.actions}>
        {error.retryable && (
          <button type="button" className={`${styles.primaryAction} bubbly-accent-button`} onClick={onRetry}>
            Try again
          </button>
        )}
        {error.settingsAction && (
          <button type="button" className={`${styles.secondaryAction} bubbly-secondary-button`} onClick={onOpenSettings}>
            Open settings
          </button>
        )}
        {error.sourceUrl && (
          <a
            className={styles.secondaryAction}
            href={error.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Get source code
          </a>
        )}
      </div>
    </section>
  );
}
