import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScreenShell } from "../components/ScreenShell";
import { Header } from "../components/Header";
import { SettingsCards } from "../components/SettingsCards";
import { RestoreButton } from "../components/RestoreButton";
import type { BgPieceConfig } from "../components/BackgroundPieces";
import { fetchVisionModels } from "../api/settings";
import { loadApiKey } from "../state/settings";
import type { AppSettings, AsyncStatus, ConnectionTestResponse, VisionModel } from "../types/app";
import styles from "./SettingsRoute.module.css";

const BG_PIECES: BgPieceConfig[] = [
  { kind: "rook", top: "15%", right: "-5%", rotate: -15 },
  { kind: "knight", top: "50%", left: "10%", rotate: 15 },
  { kind: "pawn", bottom: "10%", left: "35%", rotate: -5 },
];

type Props = {
  settings: AppSettings;
  hasApiKey: boolean;
  syncStatus: AsyncStatus;
  onSettingsChange: (patch: Partial<AppSettings>) => void;
  onRestore: () => void;
  onSaveAndTestApiKey: (apiKey: string) => Promise<ConnectionTestResponse>;
  onRemoveApiKey: () => Promise<void>;
};

const FALLBACK_OPENROUTER_MODELS: VisionModel[] = [
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Fast image-capable model. Live model details are temporarily unavailable.",
    contextLength: null,
    isCurated: true,
    isFree: false,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini Flash Lite",
    description:
      "Lightweight curated vision option. Live model details are temporarily unavailable.",
    contextLength: null,
    isCurated: true,
    isFree: false,
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    description: "Curated preview model. Live model details are temporarily unavailable.",
    contextLength: null,
    isCurated: true,
    isFree: false,
  },
  {
    id: "~openai/gpt-mini-latest",
    name: "OpenAI GPT Mini Latest",
    description:
      "Latest OpenAI GPT Mini vision model. Live model details are temporarily unavailable.",
    contextLength: null,
    isCurated: true,
    isFree: false,
  },
  {
    id: "anthropic/claude-sonnet-5",
    name: "Claude Sonnet 5",
    description: "Curated vision option. Live model details are temporarily unavailable.",
    contextLength: null,
    isCurated: true,
    isFree: false,
  },
];

const FALLBACK_GEMINI_MODELS: VisionModel[] = [
  {
    id: "gemini-flash-latest",
    name: "Gemini Flash Latest",
    description:
      "Latest Gemini Flash multimodal model. Live model details are temporarily unavailable.",
    contextLength: null,
    isCurated: true,
    isFree: true,
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    description:
      "Lightweight free-tier vision option. Live model details are temporarily unavailable.",
    contextLength: null,
    isCurated: true,
    isFree: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    description:
      "Higher-quality free-tier vision option. Live model details are temporarily unavailable.",
    contextLength: null,
    isCurated: true,
    isFree: true,
  },
];

const FALLBACK_OPENAI_MODELS: VisionModel[] = [
  {
    id: "livechess2fen",
    name: "livechess2fen",
    description: "LiveChess2FEN Image-to-FEN Model.",
    contextLength: null,
    isCurated: true,
    isFree: true,
  },
  {
    id: "gpt-4-vision-preview",
    name: "gpt-4-vision-preview",
    description: "OpenAI GPT-4 Vision Model.",
    contextLength: null,
    isCurated: true,
    isFree: false,
  },
];

function fallbackModelsFor(provider: AppSettings["provider"]): VisionModel[] {
  if (provider === "gemini") return FALLBACK_GEMINI_MODELS;
  if (provider === "openai") return FALLBACK_OPENAI_MODELS;
  return FALLBACK_OPENROUTER_MODELS;
}

export default function SettingsRoute({
  settings,
  hasApiKey,
  syncStatus,
  onSettingsChange,
  onRestore,
  onSaveAndTestApiKey,
  onRemoveApiKey,
}: Props) {
  const navigate = useNavigate();
  const [models, setModels] = useState<VisionModel[]>(() => fallbackModelsFor(settings.provider));
  const [modelStatus, setModelStatus] = useState<AsyncStatus>({
    phase: "loading",
    message: "Loading image-capable models…",
  });
  const [apiKey, setApiKey] = useState("");
  const providerName =
    settings.provider === "gemini"
      ? "Google Gemini"
      : settings.provider === "openai"
        ? "OpenAI Compatible"
        : "OpenRouter";
  const [connectionStatus, setConnectionStatus] = useState<AsyncStatus>({
    phase: "idle",
    message: hasApiKey
      ? "An API key is saved in this app’s local storage."
      : `Your key stays in this app and is sent directly to ${providerName}.`,
  });

  useEffect(() => {
    const nextProviderName =
      settings.provider === "gemini"
        ? "Google Gemini"
        : settings.provider === "openai"
          ? "OpenAI Compatible"
          : "OpenRouter";
    const providerHasKey = Boolean(loadApiKey(settings.provider, window.localStorage));
    setApiKey("");
    setConnectionStatus({
      phase: "idle",
      message: providerHasKey
        ? `A ${nextProviderName} API key is saved in this app's local storage.`
        : `Your key stays in this app and is sent directly to ${nextProviderName}.`,
    });
  }, [settings.provider]);

  const loadModels = useCallback(() => {
    setModelStatus({ phase: "loading", message: "Loading image-capable models…" });
    setModels(fallbackModelsFor(settings.provider));
    void fetchVisionModels(settings.provider, undefined, settings.openaiBaseUrl)
      .then(({ models: discoveredModels }) => {
        setModels(
          discoveredModels.length ? discoveredModels : fallbackModelsFor(settings.provider),
        );
        setModelStatus({ phase: "success", message: "" });
      })
      .catch((error: unknown) => {
        setModelStatus({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not load model choices.",
        });
      });
  }, [settings.provider, settings.openaiBaseUrl]);

  useEffect(() => loadModels(), [loadModels]);

  const handleSaveAndTest = () => {
    setConnectionStatus({ phase: "loading", message: `Testing the ${providerName} connection…` });
    void onSaveAndTestApiKey(apiKey)
      .then((details) => {
        setApiKey("");
        setConnectionStatus({
          phase: "success",
          message: details.label
            ? `Connected with ${details.label}. The key is saved in this app.`
            : "Connection successful. The key is saved in this app.",
        });
        loadModels();
      })
      .catch((error: unknown) => {
        setConnectionStatus({
          phase: "error",
          message: error instanceof Error ? error.message : "Connection test failed.",
        });
      });
  };

  const handleRemoveKey = () => {
    setConnectionStatus({ phase: "loading", message: "Removing the saved key…" });
    void onRemoveApiKey()
      .then(() => {
        setApiKey("");
        setConnectionStatus({ phase: "success", message: "The saved API key was removed." });
        loadModels();
      })
      .catch((error: unknown) => {
        setConnectionStatus({
          phase: "error",
          message: error instanceof Error ? error.message : "Could not remove the key.",
        });
      });
  };

  return (
    <ScreenShell bgPieces={BG_PIECES}>
      <Header variant="settings" onBackClick={() => navigate("/")} />

      <div className={styles.scroll}>
        <SettingsCards
          model={settings.model}
          provider={settings.provider}
          onProviderChange={(provider) => onSettingsChange({ provider })}
          openaiBaseUrl={settings.openaiBaseUrl}
          onOpenaiBaseUrlChange={(openaiBaseUrl) => onSettingsChange({ openaiBaseUrl })}
          openaiPromptStyle={settings.openaiPromptStyle}
          onOpenaiPromptStyleChange={(openaiPromptStyle) => onSettingsChange({ openaiPromptStyle })}
          openaiA1Pos={settings.openaiA1Pos}
          onOpenaiA1PosChange={(openaiA1Pos) => onSettingsChange({ openaiA1Pos })}
          models={models}
          modelStatus={modelStatus}
          onReloadModels={loadModels}
          onModelChange={(model) => onSettingsChange({ model })}
          recognitionEffort={settings.recognitionEffort}
          onRecognitionEffortChange={(recognitionEffort) => onSettingsChange({ recognitionEffort })}
          apiKey={apiKey}
          hasApiKey={hasApiKey}
          connectionStatus={connectionStatus}
          onApiKeyChange={setApiKey}
          onSaveAndTestApiKey={handleSaveAndTest}
          onRemoveApiKey={handleRemoveKey}
          depth={settings.depth}
          onDepthChange={(depth) => onSettingsChange({ depth })}
          autoCropBoard={settings.autoCropBoard}
          onAutoCropBoardChange={(autoCropBoard) => onSettingsChange({ autoCropBoard })}
          liveBoardGuide={settings.liveBoardGuide}
          onLiveBoardGuideChange={(liveBoardGuide) => onSettingsChange({ liveBoardGuide })}
          assumeSideToMoveAtBottom={settings.assumeSideToMoveAtBottom}
          onAssumeSideToMoveAtBottomChange={(assumeSideToMoveAtBottom) =>
            onSettingsChange({ assumeSideToMoveAtBottom })
          }
          openingBook={settings.openingBook}
          onOpeningBookChange={(openingBook) => onSettingsChange({ openingBook })}
          endgameTablebases={settings.endgameTablebases}
          onEndgameTablebasesChange={(endgameTablebases) => onSettingsChange({ endgameTablebases })}
          theme={settings.accentTheme}
          onThemeChange={(accentTheme) => onSettingsChange({ accentTheme })}
          showArrow={settings.showArrow}
          onShowArrowChange={(showArrow) => onSettingsChange({ showArrow })}
          showHighlights={settings.showHighlights}
          onShowHighlightsChange={(showHighlights) => onSettingsChange({ showHighlights })}
        />
        <p
          className={`${styles.syncStatus} ${syncStatus.phase === "error" ? styles.syncError : ""}`}
          role="status"
        >
          {syncStatus.message}
        </p>
        <RestoreButton onClick={onRestore}>Restore Defaults</RestoreButton>
      </div>
    </ScreenShell>
  );
}
