import styles from "./SettingsCards.module.css";
import { Dropdown } from "./Dropdown";
import { Slider } from "./Slider";
import { Toggle } from "./Toggle";
import { ThemePills } from "./ThemePills";
import type {
  AccentTheme,
  AsyncStatus,
  RecognitionEffort,
  VisionModel,
  VisionProviderId,
} from "../types/app";

type Props = {
  model: string;
  provider: VisionProviderId;
  onProviderChange: (provider: VisionProviderId) => void;
  models: VisionModel[];
  modelStatus: AsyncStatus;
  onReloadModels: () => void;
  onModelChange: (id: string) => void;
  recognitionEffort: RecognitionEffort;
  onRecognitionEffortChange: (effort: RecognitionEffort) => void;
  apiKey: string;
  hasApiKey: boolean;
  connectionStatus: AsyncStatus;
  onApiKeyChange: (value: string) => void;
  onSaveAndTestApiKey: () => void;
  onRemoveApiKey: () => void;
  depth: number;
  onDepthChange: (d: number) => void;
  autoCropBoard: boolean;
  onAutoCropBoardChange: (v: boolean) => void;
  liveBoardGuide: boolean;
  onLiveBoardGuideChange: (v: boolean) => void;
  assumeSideToMoveAtBottom: boolean;
  onAssumeSideToMoveAtBottomChange: (v: boolean) => void;
  openingBook: boolean;
  onOpeningBookChange: (v: boolean) => void;
  endgameTablebases: boolean;
  onEndgameTablebasesChange: (v: boolean) => void;
  theme: AccentTheme;
  onThemeChange: (t: AccentTheme) => void;
  showArrow: boolean;
  onShowArrowChange: (v: boolean) => void;
  showHighlights: boolean;
  onShowHighlightsChange: (v: boolean) => void;
};

export function SettingsCards({
  model,
  provider,
  onProviderChange,
  models,
  modelStatus,
  onReloadModels,
  onModelChange,
  recognitionEffort,
  onRecognitionEffortChange,
  apiKey,
  hasApiKey,
  connectionStatus,
  onApiKeyChange,
  onSaveAndTestApiKey,
  onRemoveApiKey,
  depth,
  onDepthChange,
  autoCropBoard,
  onAutoCropBoardChange,
  liveBoardGuide,
  onLiveBoardGuideChange,
  assumeSideToMoveAtBottom,
  onAssumeSideToMoveAtBottomChange,
  openingBook,
  onOpeningBookChange,
  endgameTablebases,
  onEndgameTablebasesChange,
  theme,
  onThemeChange,
  showArrow,
  onShowArrowChange,
  showHighlights,
  onShowHighlightsChange,
}: Props) {
  const modelOptions = models.map((option) => ({
    id: option.id,
    label: `${option.name}${option.isFree ? " · FREE" : ""}`,
  }));
  if (!modelOptions.some((option) => option.id === model)) {
    modelOptions.unshift({ id: model, label: model });
  }
  const selectedModel = models.find((option) => option.id === model);

  return (
    <>
      <section className={styles.card}>
        <h3 className={styles.heading}>Model Options</h3>
        <div className={styles.row}>
          <span>Provider</span>
          <Dropdown
            value={provider}
            onChange={(value) => onProviderChange(value as VisionProviderId)}
            options={[
              { id: "openrouter", label: "OpenRouter" },
              { id: "gemini", label: "Google Gemini (Direct)" },
            ]}
            ariaLabel="Vision model provider"
          />
        </div>
        <div className={styles.row}>
          <span>Current Model:</span>
          <Dropdown
            value={model}
            onChange={onModelChange}
            options={modelOptions}
            ariaLabel="Current model"
          />
        </div>
        <div className={styles.infoText}>
          <i className={`fa-solid fa-circle-info ${styles.infoIcon}`} aria-hidden="true" />
          <span>
            {modelStatus.phase === "loading"
              ? modelStatus.message
              : modelStatus.phase === "error"
                ? modelStatus.message
                : selectedModel
                  ? `${selectedModel.isFree ? "Free tier · " : ""}${selectedModel.description}`
                  : "Image-capable model selected for board recognition."}
          </span>
          {modelStatus.phase === "error" && (
            <button type="button" className={styles.textButton} onClick={onReloadModels}>
              Retry
            </button>
          )}
        </div>
        <div className={`${styles.row} ${styles.rowTop}`}>
          <span>Recognition Effort</span>
          <Dropdown
            value={recognitionEffort}
            onChange={(value) => onRecognitionEffortChange(value as RecognitionEffort)}
            options={[
              { id: "low", label: "Low" },
              { id: "high", label: "High" },
            ]}
            ariaLabel="Board recognition effort"
          />
        </div>
        <p className={styles.preferenceHint}>
          High asks the vision model to independently review and correct its result before analysis.
        </p>
        <label className={styles.keyLabel} htmlFor="vision-provider-api-key">
          {provider === "gemini" ? "Google Gemini API Key" : "OpenRouter API Key"}
        </label>
        <input
          id="vision-provider-api-key"
          className={styles.keyInput}
          type="password"
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder={hasApiKey ? "Key saved in this app" : "Enter an API key"}
          autoComplete="off"
          spellCheck={false}
        />
        <div className={styles.keyActions}>
          <button
            type="button"
            className={`${styles.actionButton} bubbly-accent-button`}
            onClick={onSaveAndTestApiKey}
            disabled={connectionStatus.phase === "loading"}
          >
            {connectionStatus.phase === "loading"
              ? "Testing…"
              : hasApiKey && !apiKey
                ? "Test Connection"
                : "Save & Test"}
          </button>
          {hasApiKey && (
            <button
              type="button"
              className={styles.textButton}
              onClick={onRemoveApiKey}
              disabled={connectionStatus.phase === "loading"}
            >
              Remove key
            </button>
          )}
        </div>
        {connectionStatus.message && (
          <p
            className={`${styles.statusText} ${connectionStatus.phase === "error" ? styles.statusError : ""}`}
            role="status"
          >
            {connectionStatus.message}
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.heading}>Analysis Preferences</h3>
        <div className={`${styles.row} ${styles.rowTight}`}>
          <span>Search Depth</span>
          <span className={styles.depthChip}>8-16</span>
          <span className={styles.depthValue}>{depth}</span>
        </div>
        <Slider value={depth} min={8} max={16} onChange={onDepthChange} />
        <div className={`${styles.row} ${styles.rowTop}`}>
          <span>Auto-crop &amp; Straighten Board</span>
          <Toggle
            checked={autoCropBoard}
            onChange={onAutoCropBoardChange}
            ariaLabel="Automatically crop and straighten the chessboard"
          />
        </div>
        <p className={styles.preferenceHint}>
          Uses OpenCV locally to crop and correct mild camera angles. The original image is used
          when detection is uncertain.
        </p>
        <div className={styles.row}>
          <span>Live Camera Board Guide</span>
          <Toggle
            checked={liveBoardGuide}
            onChange={onLiveBoardGuideChange}
            ariaLabel="Show live OpenCV board detection over the camera preview"
          />
        </div>
        <p className={styles.preferenceHint}>
          Shows a real-time board outline and grid while framing a camera photo.
        </p>
        <div className={styles.row}>
          <span>Side to Move Is at Bottom</span>
          <Toggle
            checked={assumeSideToMoveAtBottom}
            onChange={onAssumeSideToMoveAtBottomChange}
            ariaLabel="Assume the side moving next is at the bottom of the board"
          />
        </div>
        <p className={styles.preferenceHint}>
          When enabled, the selected White or Black side also tells the model how the board is
          oriented.
        </p>
        <div className={styles.row}>
          <span>Use Opening Book</span>
          <Toggle
            checked={openingBook}
            onChange={onOpeningBookChange}
            ariaLabel="Use opening book"
          />
        </div>
        <div className={styles.row}>
          <span>Endgame Tablebases</span>
          <Toggle
            checked={endgameTablebases}
            onChange={onEndgameTablebasesChange}
            ariaLabel="Endgame tablebases"
          />
        </div>
      </section>

      <section className={styles.card}>
        <h3 className={styles.heading}>Visuals</h3>
        <div className={styles.row}>
          <span>Accent Color</span>
          <ThemePills value={theme} onChange={onThemeChange} />
        </div>
        <div className={styles.row}>
          <span>Show Best Move Arrow</span>
          <Toggle
            checked={showArrow}
            onChange={onShowArrowChange}
            ariaLabel="Show best move arrow"
          />
        </div>
        <div className={styles.row}>
          <span>Show Square Highlights</span>
          <Toggle
            checked={showHighlights}
            onChange={onShowHighlightsChange}
            ariaLabel="Show square highlights"
          />
        </div>
      </section>
    </>
  );
}
