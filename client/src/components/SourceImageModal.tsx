import { useEffect, useState } from "react";
import { fetchVisionModels } from "../api/settings";
import type { CaptureMode, VisionModel, VisionProviderId } from "../types/app";
import styles from "./SourceImageModal.module.css";

type Props = {
  imageUrl: string;
  mode: CaptureMode;
  initialModel: string;
  provider: VisionProviderId;
  cropApplied?: boolean;
  onClose: () => void;
  onAnalyze: (model: string) => void;
};

export function SourceImageModal({
  imageUrl,
  mode,
  initialModel,
  provider,
  cropApplied,
  onClose,
  onAnalyze,
}: Props) {
  const [model, setModel] = useState(initialModel);
  const [models, setModels] = useState<VisionModel[]>([]);
  const [modelMessage, setModelMessage] = useState("Loading image-capable models...");

  useEffect(() => {
    let cancelled = false;
    void fetchVisionModels(provider)
      .then(({ models: availableModels }) => {
        if (cancelled) return;
        setModels(availableModels);
        setModelMessage(availableModels.length ? "" : "No image-capable models were returned.");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setModelMessage(
          error instanceof Error ? error.message : "Could not refresh the model list.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  const options = models.some((candidate) => candidate.id === model)
    ? models
    : [
        {
          id: model,
          name: model,
          description: "Current model",
          contextLength: null,
          isCurated: false,
          isFree: false,
        },
        ...models,
      ];

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-image-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 id="source-image-title" className={styles.title}>
              {mode === "camera" ? "Latest Camera Shot" : "Latest Screenshot"}
            </h2>
            <p className={styles.subtitle}>
              {cropApplied
                ? "Original retained; a detected and straightened board crop was used for analysis."
                : "Full image used for analysis and temporarily stored on this device."}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close image viewer"
          >
            <i className="fa-solid fa-times" aria-hidden="true" />
          </button>
        </div>

        <div className={styles.imageFrame}>
          <img className={styles.image} src={imageUrl} alt="Latest captured chess board" />
        </div>

        <label className={styles.label} htmlFor="reanalyze-model">
          Analyze with a different model
        </label>
        <select
          id="reanalyze-model"
          className={styles.select}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.isFree ? " - FREE" : ""}
            </option>
          ))}
        </select>
        {modelMessage && <p className={styles.modelMessage}>{modelMessage}</p>}

        <div className={styles.actions}>
          <button type="button" className={`${styles.secondaryButton} bubbly-secondary-button`} onClick={onClose}>
            Close
          </button>
          <button type="button" className={`${styles.primaryButton} bubbly-accent-button`} onClick={() => onAnalyze(model)}>
            <i className="fa-solid fa-wand-magic" aria-hidden="true" />
            Analyze Again
          </button>
        </div>
      </section>
    </div>
  );
}
