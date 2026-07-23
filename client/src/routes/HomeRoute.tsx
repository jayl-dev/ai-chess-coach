import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ScreenShell } from "../components/ScreenShell";
import { Header } from "../components/Header";
import { ScreenModePanel } from "../components/ScreenModePanel";
import { CameraModePanel, type CameraModePanelHandle } from "../components/CameraModePanel";
import { CapturedImagePanel } from "../components/CapturedImagePanel";
import { ModeFab } from "../components/ModeFab";
import { ResultCard } from "../components/ResultCard";
import { StarsLoader } from "../components/StarsLoader";
import { ErrorPanel } from "../components/ErrorPanel";
import { SourceImageModal } from "../components/SourceImageModal";
import { SideToggle } from "../components/SideToggle";
import { CastlingToggle } from "../components/CastlingToggle";
import type { BgPieceConfig } from "../components/BackgroundPieces";
import {
  MOCK_ANALYSIS_ERROR,
  MOCK_ANALYSIS_RESULT,
  type MockCaptureOutcome,
} from "../data/mockAnalysis";
import { DEFAULT_SETTINGS } from "../state/settings";
import { captureHostScreenshot, CaptureRequestError, type CapturedImage } from "../api/capture";
import { loadPairedHost, savePairedHost, type PairedHost } from "../state/host";
import { loadLatestImage, saveLatestImage } from "../state/latestImage";
import { analyzeCapturedImage } from "../analysis/analyzeImage";
import { autoCropChessboard } from "../analysis/boardCrop";
import type {
  AnalysisResult,
  AppError,
  AppPhase,
  AppSettings,
  CastlingRights,
  CaptureMode,
  ProgressStage,
  SideToMove,
} from "../types/app";
import styles from "./HomeRoute.module.css";

const BG_PIECES: BgPieceConfig[] = [
  { kind: "pawn", top: "15%", left: "5%", rotate: -15 },
  { kind: "knight", top: "45%", right: "-5%", rotate: 20 },
  { kind: "rook", bottom: "25%", left: "-5%", rotate: -10 },
  { kind: "bishop", top: "70%", right: "20%", rotate: 12 },
];

type Props = {
  settings?: AppSettings;
  captureDelayMs?: number;
  mockOutcome?: MockCaptureOutcome;
};

type CapturedPreview = CapturedImage & {
  imageUrl: string;
  mode: CaptureMode;
  analysisImage: CapturedImage;
  cropApplied: boolean;
};

function cameraError(error: unknown): AppError {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      code: "camera-permission",
      title: "Camera access is blocked",
      message: window.isSecureContext
        ? "Allow camera access for this site in your browser settings, then try again."
        : "Camera access requires HTTPS or localhost. Open Chess Coach from a secure address and try again.",
      retryable: true,
      settingsAction: false,
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return {
      code: "capture-failed",
      title: "No camera is available",
      message: "Connect or enable a camera, then try again.",
      retryable: true,
      settingsAction: false,
    };
  }
  if (name === "NotSupportedError") {
    return {
      code: "capture-failed",
      title: "Camera is not supported",
      message: error instanceof Error ? error.message : "This browser cannot access a camera.",
      retryable: false,
      settingsAction: false,
    };
  }
  return {
    code: "capture-failed",
    title: "Couldn’t start the camera",
    message: error instanceof Error ? error.message : "The camera could not be started.",
    retryable: true,
    settingsAction: false,
  };
}

function monitorError(error: unknown): AppError {
  return {
    code: error instanceof TypeError ? "network" : "capture-failed",
    title: "Couldn’t capture the screen",
    message:
      error instanceof Error
        ? error.message
        : "The host could not capture its screen. Check its screen-recording permissions and try again.",
    retryable: true,
    settingsAction: false,
  };
}

function analysisError(error: unknown, provider: AppSettings["provider"]): AppError {
  const message =
    error instanceof Error ? error.message : "The captured board could not be analyzed.";
  const diagnosticError = error as { diagnostics?: unknown };
  const diagnostics = Array.isArray(diagnosticError?.diagnostics)
    ? diagnosticError.diagnostics.filter((line): line is string => typeof line === "string")
    : [];
  const errorName = error instanceof Error ? error.name : "";
  const searchableError = `${errorName}\n${message}\n${diagnostics.join("\n")}`;
  const needsApiKey =
    /api key|status 401|authentication|unauthenticated|permission_denied|invalid credential/i.test(
      searchableError,
    );
  const providerIssue =
    /OpenRouterCompletionError|GeminiCompletionError|provider|selected model|model .*not found|rate.?limit|resource_exhausted|quota|credit|payment_required|status 40[02349]|status 429|openrouter|gemini/i.test(
      searchableError,
    );
  const invalidPosition = /fen|position|illegal move|chess board/i.test(message);
  const networkIssue =
    error instanceof TypeError || /failed to fetch|network request|could not reach/i.test(message);
  const providerName = provider === "gemini" ? "Google Gemini" : "OpenRouter";
  const debugDetails = import.meta.env.DEV
    ? [
        ...diagnostics,
        `Page: ${window.location.href}`,
        `Secure context: ${window.isSecureContext}`,
        `Cross-origin isolated: ${window.crossOriginIsolated}`,
        `Browser: ${navigator.userAgent}`,
        ...(error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 10) : []),
      ]
    : undefined;
  return {
    code: invalidPosition ? "invalid-position" : networkIssue ? "network" : "analysis-failed",
    title: needsApiKey
      ? "Add an API key to continue"
      : providerIssue
        ? `${providerName} could not analyze this image`
        : invalidPosition
          ? "Couldn't read a legal position"
          : "Couldn't analyze this board",
    message,
    retryable: true,
    settingsAction: needsApiKey || providerIssue,
    debugDetails,
  };
}

export default function HomeRoute({
  settings = DEFAULT_SETTINGS,
  captureDelayMs = 2800,
  mockOutcome,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<CaptureMode>("camera");
  const [phase, setPhase] = useState<AppPhase>("ready");
  const [side, setSide] = useState<SideToMove>("white");
  const [castlingRights, setCastlingRights] = useState<CastlingRights>("none");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [captured, setCaptured] = useState<CapturedPreview | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [host, setHost] = useState<PairedHost | null>(() => loadPairedHost());
  const [hostPrompt, setHostPrompt] = useState("");
  const [progressStage, setProgressStage] = useState<ProgressStage>("capturing");
  const [sourceViewerOpen, setSourceViewerOpen] = useState(false);
  const captureTimer = useRef<number | null>(null);
  const cameraRef = useRef<CameraModePanelHandle>(null);
  const captureInFlight = useRef(false);
  const captureAbort = useRef<AbortController | null>(null);
  const capturedUrl = useRef<string | null>(null);
  const analysisRun = useRef(0);
  const analysisWatchdog = useRef<number | null>(null);
  const queryMockOutcome = new URLSearchParams(location.search).get("mock");
  const envMockMode =
    import.meta.env.VITE_MOCK === "true" ||
    import.meta.env.VITE_MOCK === "1" ||
    import.meta.env.VITE_MOCK_MODE === "true" ||
    import.meta.env.VITE_MOCK_MODE === "1";
  const usesMockCapture =
    envMockMode ||
    mockOutcome !== undefined ||
    queryMockOutcome === "success" ||
    queryMockOutcome === "error";

  useEffect(
    () => () => {
      if (captureTimer.current !== null) {
        window.clearTimeout(captureTimer.current);
      }
      captureAbort.current?.abort();
      analysisRun.current += 1;
      if (analysisWatchdog.current !== null) window.clearTimeout(analysisWatchdog.current);
      if (capturedUrl.current) URL.revokeObjectURL(capturedUrl.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void loadLatestImage()
      .then((image) => {
        if (!image || cancelled || capturedUrl.current) return;
        const imageUrl = URL.createObjectURL(image.blob);
        capturedUrl.current = imageUrl;
        setCaptured({
          ...image,
          imageUrl,
          analysisImage: image,
          cropApplied: false,
        });
      })
      .catch(() => {
        // IndexedDB may be unavailable in a private browsing context. Captures still work in memory.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const retainCapturedImage = (
    image: CapturedImage,
    captureMode: CaptureMode,
    analysisImage: CapturedImage,
    cropApplied: boolean,
  ) => {
    if (capturedUrl.current) URL.revokeObjectURL(capturedUrl.current);
    const imageUrl = URL.createObjectURL(image.blob);
    capturedUrl.current = imageUrl;
    setCaptured({ ...image, imageUrl, mode: captureMode, analysisImage, cropApplied });
    void saveLatestImage({ ...image, mode: captureMode, capturedAt: Date.now() }).catch(() => {
      // Keep the in-memory capture when persistent browser storage is unavailable.
    });
  };

  const runAnalysis = async (
    image: CapturedImage,
    captureMode: CaptureMode,
    modelOverride?: string,
    captureMs = 0,
  ) => {
    const runId = ++analysisRun.current;
    if (analysisWatchdog.current !== null) window.clearTimeout(analysisWatchdog.current);
    const watchdogMs = settings.recognitionEffort === "high" ? 210_000 : 120_000;
    analysisWatchdog.current = window.setTimeout(() => {
      if (analysisRun.current !== runId) return;
      analysisRun.current += 1;
      analysisWatchdog.current = null;
      setError(
        analysisError(
          new Error(
            `Analysis did not finish within ${Math.round(watchdogMs / 60_000)} minutes. Try again or choose another vision model.`,
          ),
          settings.provider,
        ),
      );
      setPhase("error");
    }, watchdogMs);
    setSourceViewerOpen(false);
    setError(null);
    setResult(null);
    setProgressStage("reading-position");
    setPhase("loading");
    try {
      const analysis = await analyzeCapturedImage(
        image.blob,
        settings,
        side,
        castlingRights,
        modelOverride,
        setProgressStage,
      );
      if (analysisRun.current !== runId) return;
      analysis.timings.captureMs = captureMs;
      analysis.timings.totalMs += captureMs;
      setResult(analysis);
      setMode(captureMode);
      setPhase("result");
    } catch (analysisFailure) {
      if (analysisRun.current !== runId) return;
      setError(analysisError(analysisFailure, settings.provider));
      setPhase("error");
    } finally {
      if (analysisRun.current === runId && analysisWatchdog.current !== null) {
        window.clearTimeout(analysisWatchdog.current);
        analysisWatchdog.current = null;
      }
    }
  };

  const startMockCapture = (outcome: MockCaptureOutcome) => {
    if (captureTimer.current !== null) {
      window.clearTimeout(captureTimer.current);
    }
    setError(null);
    setResult(null);
    setPhase("loading");
    captureTimer.current = window.setTimeout(() => {
      captureTimer.current = null;
      if (outcome === "error") {
        setError(MOCK_ANALYSIS_ERROR);
        setPhase("error");
      } else {
        setResult({
          ...MOCK_ANALYSIS_RESULT,
          sideToMove: side,
          orientation: settings.assumeSideToMoveAtBottom ? side : MOCK_ANALYSIS_RESULT.orientation,
        });
        setPhase("result");
      }
    }, captureDelayMs);
  };

  const startCapture = () => {
    if (captureInFlight.current) return;
    if (usesMockCapture) {
      startMockCapture(mockOutcome ?? (queryMockOutcome === "error" ? "error" : "success"));
      return;
    }
    if (mode === "monitor" && !host) {
      setHostPrompt("Connect and pair with a screenshot host before capturing the screen.");
      return;
    }

    captureInFlight.current = true;
    setError(null);
    setResult(null);
    setCaptured(null);
    setProgressStage("capturing");
    setPhase("loading");
    const captureMode = mode;

    const run = async () => {
      const captureStarted = performance.now();
      try {
        let image: CapturedImage;
        if (captureMode === "camera") {
          if (!cameraRef.current || !cameraReady) throw new Error("The camera is not ready yet.");
          image = await cameraRef.current.capture();
        } else {
          captureAbort.current?.abort();
          const controller = new AbortController();
          captureAbort.current = controller;
          image = await captureHostScreenshot(host as PairedHost, controller.signal);
        }
        const prepared = settings.autoCropBoard
          ? await autoCropChessboard(image)
          : { image, cropped: false, confidence: 0 };
        const captureMs = Math.round(performance.now() - captureStarted);
        retainCapturedImage(image, captureMode, prepared.image, prepared.cropped);
        await runAnalysis(prepared.image, captureMode, undefined, captureMs);
      } catch (captureError) {
        if (captureError instanceof DOMException && captureError.name === "AbortError") return;
        if (captureError instanceof CaptureRequestError && captureError.status === 401) {
          savePairedHost(null);
          setHost(null);
          setHostPrompt("The host restarted or pairing expired. Pair with it again.");
        }
        setError(captureMode === "camera" ? cameraError(captureError) : monitorError(captureError));
        setPhase("error");
      } finally {
        captureInFlight.current = false;
        captureAbort.current = null;
      }
    };
    void run();
  };

  const handleCameraReadyChange = useCallback((ready: boolean) => setCameraReady(ready), []);
  const handleCameraError = useCallback((captureError: unknown) => {
    setCameraReady(false);
    setError(cameraError(captureError));
    setPhase("error");
  }, []);

  const retryCapture = () => {
    if (mode === "camera") {
      setError(null);
      setPhase("ready");
      return;
    }
    startCapture();
  };

  const handleFabTrigger = () => {
    if (phase === "loading") return;
    if (phase === "ready" && mode === "camera" && !cameraReady) return;

    if ((phase === "result" || phase === "captured" || phase === "error") && mode === "camera") {
      setError(null);
      setCaptured(null);
      setPhase("ready");
      return;
    }

    startCapture();
  };

  const handleModeChange = (nextMode: CaptureMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setCameraReady(false);

    if (
      phase === "captured" ||
      phase === "error" ||
      (phase === "result" && nextMode === "camera")
    ) {
      setResult(null);
      setCaptured(null);
      setError(null);
      setPhase("ready");
    }
  };

  const actionLabel =
    mode === "monitor"
      ? !host && !usesMockCapture
        ? "Connect screenshot host"
        : phase === "result" || phase === "captured"
          ? "Capture another screenshot"
          : "Capture screenshot"
      : phase === "result" || phase === "captured"
        ? "Open camera preview"
        : phase === "error"
          ? "Reopen camera preview"
          : "Take picture";

  const positionStateDescription =
    castlingRights === "both"
      ? `${side === "white" ? "White" : "Black"} to move · King- and queen-side castling available`
      : castlingRights === "king"
        ? `${side === "white" ? "White" : "Black"} to move · King-side castling available`
        : castlingRights === "queen"
          ? `${side === "white" ? "White" : "Black"} to move · Queen-side castling available`
          : `${side === "white" ? "White" : "Black"} to move · No castling rights`;

  return (
    <ScreenShell bgPieces={BG_PIECES}>
      <Header onBrandClick={() => navigate("/")} onGearClick={() => navigate("/settings")} />

      <div className={styles.positionStateBar}>
        <SideToggle value={side} onChange={setSide} disabled={phase === "loading"} />
        <CastlingToggle
          value={castlingRights}
          onChange={setCastlingRights}
          disabled={phase === "loading"}
        />
        <p className={styles.positionStateDescription} aria-live="polite">
          {positionStateDescription}
        </p>
      </div>

      <main className={styles.main}>
        {phase === "ready" &&
          (mode === "monitor" ? (
            <ScreenModePanel
              host={host}
              hostPrompt={hostPrompt}
              onHostChange={(nextHost) => {
                setHost(nextHost);
                setHostPrompt("");
              }}
            />
          ) : (
            <CameraModePanel
              ref={cameraRef}
              liveBoardGuide={settings.liveBoardGuide}
              onReadyChange={handleCameraReadyChange}
              onError={handleCameraError}
            />
          ))}
        {phase === "loading" && <StarsLoader stage={progressStage} />}
        {phase === "captured" && captured && (
          <CapturedImagePanel
            imageUrl={captured.imageUrl}
            mode={captured.mode}
            width={captured.width}
            height={captured.height}
          />
        )}
        {phase === "result" && result && (
          <ResultCard
            result={result}
            showArrow={settings.showArrow}
            showHighlights={settings.showHighlights}
            onViewSource={captured ? () => setSourceViewerOpen(true) : undefined}
            sourceMode={captured?.mode}
          />
        )}
        {phase === "error" && error && (
          <ErrorPanel
            error={error}
            onRetry={retryCapture}
            onOpenSettings={() => navigate("/settings")}
          />
        )}
      </main>

      <ModeFab
        active={mode}
        onTrigger={handleFabTrigger}
        onModeChange={handleModeChange}
        busy={phase === "loading"}
        starting={phase === "ready" && mode === "camera" && !cameraReady}
        actionLabel={actionLabel}
      />

      {sourceViewerOpen && captured && (
        <SourceImageModal
          imageUrl={captured.imageUrl}
          mode={captured.mode}
          initialModel={settings.model}
          provider={settings.provider}
          cropApplied={captured.cropApplied}
          onClose={() => setSourceViewerOpen(false)}
          onAnalyze={(model) => {
            void runAnalysis(captured.analysisImage, captured.mode, model);
          }}
        />
      )}
    </ScreenShell>
  );
}
