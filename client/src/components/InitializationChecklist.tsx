import { useEffect, useState } from "react";
import { analyzeWithStockfish, StockfishError } from "../analysis/stockfish";
import { autoCropChessboard } from "../analysis/boardCrop";
import { loadApiKey } from "../state/settings";
import { testVisionConnection } from "../api/settings";
import { Toggle } from "./Toggle";
import styles from "./InitializationChecklist.module.css";
import type { VisionProviderId } from "../types/app";

type CheckId = "camera" | "stockfish" | "opencv" | "apiKey";
type CheckPhase = "checking" | "ready" | "warning" | "error";

type CheckResult = {
  phase: Exclude<CheckPhase, "checking">;
  detail: string;
  diagnostics?: string[];
};

type CheckState = {
  id: CheckId;
  label: string;
  phase: CheckPhase;
  detail: string;
  diagnostics?: string[];
};

type Props = {
  autoCropBoard: boolean;
  liveBoardGuide: boolean;
  provider: VisionProviderId;
  onAutoCropBoardChange: (enabled: boolean) => void;
  onContinue: () => void;
};

const STARTING_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
function apiKeyLabel(provider: VisionProviderId): string {
  return provider === "gemini" ? "Google Gemini API key" : "OpenRouter API key";
}
const LABELS: Record<CheckId, string> = {
  camera: "Camera permission",
  stockfish: "Stockfish engine",
  opencv: "OpenCV board tools",
  apiKey: "OpenRouter API key",
};

let cachedChecks: Partial<Record<CheckId, Promise<CheckResult>>> = {};
let cachedApiKeyProvider: VisionProviderId | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(resolve, reject).finally(() => window.clearTimeout(timeout));
  });
}

function cameraCheck(): Promise<CheckResult> {
  if (!window.isSecureContext) {
    return Promise.resolve<CheckResult>({
      phase: "warning",
      detail:
        "Live camera needs HTTPS or localhost. Photo upload and screen mode remain available.",
    });
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.resolve<CheckResult>({
      phase: "error",
      detail: "This browser does not expose the Web Camera API.",
    });
  }
  return navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    })
    .then((stream): CheckResult => {
      stream.getTracks().forEach((track) => track.stop());
      return {
        phase: "ready",
        detail: "Camera permission granted. The camera is ready when you need it.",
      };
    })
    .catch((error: unknown): CheckResult => {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        return {
          phase: "error",
          detail:
            "Camera permission was blocked or dismissed. Allow it in browser settings, then run the checks again.",
        };
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        return { phase: "error", detail: "No usable camera was found on this device." };
      }
      if (name === "NotReadableError" || name === "AbortError") {
        return {
          phase: "error",
          detail:
            "The camera is present but unavailable. Close other apps using it, then try again.",
        };
      }
      return {
        phase: "error",
        detail: error instanceof Error ? error.message : "The camera could not be initialized.",
      };
    });
}

function cameraPermissionResult(state: PermissionState): CheckResult {
  if (state === "granted") {
    return {
      phase: "ready",
      detail: "Camera permission granted. The camera is ready when you need it.",
    };
  }
  if (state === "denied") {
    return { phase: "error", detail: "Camera permission is blocked in browser settings." };
  }
  return {
    phase: "warning",
    detail: "Camera permission is ready to request. Run the checks again if no prompt appears.",
  };
}

function stockfishCheck(): Promise<CheckResult> {
  return analyzeWithStockfish(STARTING_POSITION, 1, 20_000)
    .then(() => ({ phase: "ready" as const, detail: "Worker and WASM engine initialized." }))
    .catch((error: unknown) => ({
      phase: "error" as const,
      detail: error instanceof Error ? error.message : "Stockfish could not initialize.",
      diagnostics: error instanceof StockfishError ? error.diagnostics : undefined,
    }));
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas image encoding is unavailable."))),
      "image/png",
    );
  });
}

async function boardProcessorCheck(): Promise<CheckResult> {
  try {
    const size = 224;
    const margin = 16;
    const boardSize = size - margin * 2;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable.");
    context.fillStyle = "#f6f0df";
    context.fillRect(0, 0, size, size);
    const cell = boardSize / 8;
    for (let rank = 0; rank < 8; rank += 1) {
      for (let file = 0; file < 8; file += 1) {
        context.fillStyle = (rank + file) % 2 === 0 ? "#ececd1" : "#769656";
        context.fillRect(margin + file * cell, margin + rank * cell, cell, cell);
      }
    }
    const blob = await canvasToBlob(canvas);
    const result = await autoCropChessboard({ blob, width: size, height: size });
    if (!result.cropped)
      throw new Error("The local board detector did not pass its startup image check.");
    return {
      phase: "ready",
      detail: "OpenCV.js initialized and passed its crop and perspective check.",
    };
  } catch (error) {
    return {
      phase: "error",
      detail: error instanceof Error ? error.message : "Board image processing is unavailable.",
    };
  }
}

function apiKeyCheck(provider: VisionProviderId): Promise<CheckResult> {
  const providerName = provider === "gemini" ? "Gemini" : "OpenRouter";
  const key = loadApiKey(provider, window.localStorage);
  if (!key) {
    return Promise.resolve<CheckResult>({
      phase: "warning",
      detail: "No API key found. Add one in Settings before analysis.",
    });
  }
  return withTimeout(
    testVisionConnection(provider, key),
    10_000,
    `${providerName} key validation did not respond within 10 seconds.`,
  )
    .then((details) => ({
      phase: "ready" as const,
      detail: details.label
        ? `${providerName} accepted the key (${details.label}).`
        : `${providerName} accepted the saved API key.`,
    }))
    .catch((error: unknown) => ({
      phase: "error" as const,
      detail:
        error instanceof Error ? error.message : `${providerName} could not validate the API key.`,
    }));
}

const RUNNERS: Record<Exclude<CheckId, "apiKey">, () => Promise<CheckResult>> = {
  camera: cameraCheck,
  stockfish: stockfishCheck,
  opencv: boardProcessorCheck,
};

function getCheck(
  id: CheckId,
  autoCropBoard: boolean,
  liveBoardGuide: boolean,
  provider: VisionProviderId,
): Promise<CheckResult> {
  if (id === "opencv" && !autoCropBoard && !liveBoardGuide) {
    return Promise.resolve({
      phase: "ready",
      detail: "Turned off. Live guidance and capture-time board correction are disabled.",
    });
  }
  if (id === "apiKey") {
    if (cachedApiKeyProvider !== provider) {
      cachedChecks.apiKey = undefined;
      cachedApiKeyProvider = provider;
    }
    if (!cachedChecks.apiKey) cachedChecks.apiKey = apiKeyCheck(provider);
    return cachedChecks.apiKey as Promise<CheckResult>;
  }
  if (!cachedChecks[id]) cachedChecks[id] = RUNNERS[id]();
  return cachedChecks[id] as Promise<CheckResult>;
}

function initialChecks(provider: VisionProviderId): CheckState[] {
  return (Object.keys(LABELS) as CheckId[]).map((id) => ({
    id,
    label: id === "apiKey" ? apiKeyLabel(provider) : LABELS[id],
    phase: "checking",
    detail: "Checking...",
  }));
}

export function InitializationChecklist({
  autoCropBoard,
  liveBoardGuide,
  provider,
  onAutoCropBoardChange,
  onContinue,
}: Props) {
  const [checks, setChecks] = useState<CheckState[]>(() => initialChecks(provider));
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    setChecks((current) =>
      current.map((check) =>
        check.id === "apiKey"
          ? { ...check, label: apiKeyLabel(provider), phase: "checking", detail: "Checking..." }
          : check,
      ),
    );
    let cancelled = false;
    for (const id of Object.keys(LABELS) as CheckId[]) {
      void getCheck(id, autoCropBoard, liveBoardGuide, provider).then((result) => {
        if (cancelled) return;
        setChecks((current) =>
          current.map((check) => (check.id === id ? { ...check, ...result } : check)),
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [autoCropBoard, liveBoardGuide, provider, runId]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;

    let cancelled = false;
    let permission: PermissionStatus | null = null;
    let permissionObserved = false;

    const applyPermission = (state: PermissionState) => {
      if (cancelled) return;
      const result = cameraPermissionResult(state);
      setChecks((current) =>
        current.map((check) => (check.id === "camera" ? { ...check, ...result } : check)),
      );
    };

    const queryPermission = async () => {
      try {
        const nextPermission = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        if (cancelled) return;
        if (permission && permission !== nextPermission) {
          permission.removeEventListener("change", handlePermissionChange);
        }
        permission = nextPermission;
        permission.addEventListener("change", handlePermissionChange);
        if (permission.state !== "prompt" || permissionObserved) {
          applyPermission(permission.state);
        }
        permissionObserved = true;
      } catch {
        // getUserMedia remains the source of truth where the Permissions API omits camera support.
      }
    };

    function handlePermissionChange() {
      if (permission) applyPermission(permission.state);
    }

    const handleFocus = () => {
      void queryPermission();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void queryPermission();
    };

    void queryPermission();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      permission?.removeEventListener("change", handlePermissionChange);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [runId]);

  const complete = checks.every((check) => check.phase !== "checking");

  const retry = () => {
    cachedChecks = {};
    cachedApiKeyProvider = null;
    setChecks(initialChecks(provider));
    setRunId((value) => value + 1);
  };

  const setAutoCropBoard = (enabled: boolean) => {
    cachedChecks.opencv = undefined;
    setChecks((current) =>
      current.map((check) =>
        check.id === "opencv" ? { ...check, phase: "checking", detail: "Checking..." } : check,
      ),
    );
    onAutoCropBoardChange(enabled);
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-title"
    >
      <section className={styles.card}>
        <div className={styles.headingRow}>
          <span className={styles.logo} aria-hidden="true">
            <i className="fa-solid fa-chess-bishop" />
          </span>
          <div>
            <h1 id="startup-title">Getting Chess Coach Ready</h1>
            <p>Checking this device before the first move.</p>
          </div>
        </div>

        <img
          className={styles.hero}
          src="/initializing.png"
          alt="Charlie the bishop checks that Chess Coach is ready"
        />

        <ul className={styles.list}>
          {checks.map((check) => (
            <li key={check.id} className={styles.item}>
              <span className={`${styles.status} ${styles[check.phase]}`} aria-hidden="true">
                <i
                  className={`fa-solid ${
                    check.phase === "checking"
                      ? "fa-circle-notch"
                      : check.phase === "ready"
                        ? "fa-check"
                        : check.phase === "warning"
                          ? "fa-exclamation"
                          : "fa-times"
                  }`}
                />
              </span>
              <div className={styles.checkText}>
                <div className={styles.checkTitle}>
                  <strong>{check.label}</strong>
                  {check.id === "opencv" ? (
                    <Toggle
                      checked={autoCropBoard}
                      onChange={setAutoCropBoard}
                      ariaLabel="Use OpenCV to auto-crop and straighten boards"
                    />
                  ) : null}
                </div>
                <span>{check.detail}</span>
                {import.meta.env.DEV && check.diagnostics?.length ? (
                  <details className={styles.diagnostics}>
                    <summary>Show engine details</summary>
                    <pre>{check.diagnostics.join("\n")}</pre>
                  </details>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          {complete ? (
            <>
              {checks.some((check) => check.phase !== "ready") ? (
                <button type="button" className={styles.secondaryButton} onClick={retry}>
                  Run checks again
                </button>
              ) : null}
              <button type="button" className={styles.primaryButton} onClick={onContinue}>
                Continue
              </button>
            </>
          ) : (
            <span className={styles.waiting}>Initialization in progress...</span>
          )}
        </div>
      </section>
    </div>
  );
}
