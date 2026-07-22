import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { captureVideoFrame, type CapturedImage } from "../api/capture";
import {
  detectChessboardInCanvas,
  type BoardDetection,
  type BoardPoint,
  type BoardQuad,
} from "../analysis/boardCrop";
import styles from "./CameraModePanel.module.css";

const PREVIEW_SQUARES = Array.from({ length: 64 }, (_, index) => index);
const LIVE_DETECTION_EDGE = 480;
const LIVE_DETECTION_INTERVAL_MS = 260;
const LIVE_MIN_CONFIDENCE = 0.22;
const LIVE_LOCKED_CONFIDENCE = 0.46;

export type CameraModePanelHandle = {
  capture: () => Promise<CapturedImage>;
};

type Props = {
  liveBoardGuide?: boolean;
  onReadyChange?: (ready: boolean) => void;
  onError?: (error: unknown) => void;
};

function pointInQuad(corners: BoardQuad, u: number, v: number): BoardPoint {
  const top = {
    x: corners[0].x + (corners[1].x - corners[0].x) * u,
    y: corners[0].y + (corners[1].y - corners[0].y) * u,
  };
  const bottom = {
    x: corners[3].x + (corners[2].x - corners[3].x) * u,
    y: corners[3].y + (corners[2].y - corners[3].y) * u,
  };
  return {
    x: top.x + (bottom.x - top.x) * v,
    y: top.y + (bottom.y - top.y) * v,
  };
}

function smoothDetection(previous: BoardDetection | null, next: BoardDetection): BoardDetection {
  if (!previous || previous.width !== next.width || previous.height !== next.height) return next;
  const nextWeight = 0.42;
  return {
    ...next,
    confidence: previous.confidence * (1 - nextWeight) + next.confidence * nextWeight,
    corners: next.corners.map((point, index) => ({
      x: previous.corners[index].x * (1 - nextWeight) + point.x * nextWeight,
      y: previous.corners[index].y * (1 - nextWeight) + point.y * nextWeight,
    })) as BoardQuad,
  };
}

function BoardGuide({ detection }: { detection: BoardDetection }) {
  const outline = detection.corners.map((point) => `${point.x},${point.y}`).join(" ");
  const gridLines = Array.from({ length: 14 }, (_, index) => {
    const offset = (index % 7) + 1;
    const vertical = index < 7;
    const start = pointInQuad(
      detection.corners,
      vertical ? offset / 8 : 0,
      vertical ? 0 : offset / 8,
    );
    const end = pointInQuad(
      detection.corners,
      vertical ? offset / 8 : 1,
      vertical ? 1 : offset / 8,
    );
    return { start, end };
  });
  const locked = detection.confidence >= LIVE_LOCKED_CONFIDENCE;

  return (
    <svg
      className={`${styles.boardGuide} ${locked ? styles.guideLocked : styles.guideSearching}`}
      viewBox={`0 0 ${detection.width} ${detection.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <polygon className={styles.guideFill} points={outline} />
      <polygon className={styles.guideOutline} points={outline} />
      {gridLines.map(({ start, end }, index) => (
        <line
          key={index}
          className={styles.guideGridLine}
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
        />
      ))}
      {detection.corners.map((point, index) => (
        <circle key={index} className={styles.guideCorner} cx={point.x} cy={point.y} r="4" />
      ))}
    </svg>
  );
}

export const CameraModePanel = forwardRef<CameraModePanelHandle, Props>(function CameraModePanel(
  { liveBoardGuide = true, onReadyChange, onError },
  forwardedRef,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const missedDetections = useRef(0);
  const [ready, setReady] = useState(false);
  const [guideDetection, setGuideDetection] = useState<BoardDetection | null>(null);

  useImperativeHandle(
    forwardedRef,
    () => ({
      capture: async () => {
        if (!videoRef.current) throw new Error("The camera preview is not available.");
        return captureVideoFrame(videoRef.current);
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const startCamera = async () => {
      setReady(false);
      onReadyChange?.(false);
      if (!window.isSecureContext) {
        throw new DOMException(
          "Camera access requires HTTPS or localhost. This page was opened from an insecure address.",
          "SecurityError",
        );
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException(
          "Camera access is not supported by this browser.",
          "NotSupportedError",
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      });
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (!cancelled) {
        setReady(true);
        onReadyChange?.(true);
      }
    };

    void startCamera().catch((error: unknown) => {
      if (!cancelled) onError?.(error);
    });

    return () => {
      cancelled = true;
      onReadyChange?.(false);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [onError, onReadyChange]);

  useEffect(() => {
    if (!ready || !liveBoardGuide) {
      missedDetections.current = 0;
      setGuideDetection(null);
      return;
    }

    let cancelled = false;
    let timer: number | null = null;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const schedule = (delay = LIVE_DETECTION_INTERVAL_MS) => {
      if (!cancelled) timer = window.setTimeout(() => void detectFrame(), delay);
    };

    const detectFrame = async () => {
      const video = videoRef.current;
      if (
        !context ||
        !video ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        document.visibilityState === "hidden"
      ) {
        schedule();
        return;
      }

      const scale = Math.min(
        1,
        LIVE_DETECTION_EDGE / Math.max(video.videoWidth, video.videoHeight),
      );
      const detectionWidth = Math.max(1, Math.round(video.videoWidth * scale));
      const detectionHeight = Math.max(1, Math.round(video.videoHeight * scale));
      if (canvas.width !== detectionWidth) canvas.width = detectionWidth;
      if (canvas.height !== detectionHeight) canvas.height = detectionHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const detection = await detectChessboardInCanvas(canvas);
        if (cancelled) return;
        if (detection && detection.confidence >= LIVE_MIN_CONFIDENCE) {
          missedDetections.current = 0;
          setGuideDetection((previous) => smoothDetection(previous, detection));
        } else {
          missedDetections.current += 1;
          if (missedDetections.current >= 3) setGuideDetection(null);
        }
      } catch {
        if (!cancelled) setGuideDetection(null);
      } finally {
        schedule();
      }
    };

    schedule(0);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [liveBoardGuide, ready]);

  return (
    <section className={styles.panel} aria-label="Camera capture">
      <span className={styles.srOnly} aria-live="polite">
        {ready ? "Camera ready" : "Starting camera"}
      </span>

      <div className={styles.viewfinderStage}>
        <img className={styles.sparkles} src="/camera-sparkles.svg" alt="" aria-hidden="true" />
        <div className={styles.viewfinder}>
          <video
            ref={videoRef}
            className={`${styles.video}${ready ? ` ${styles.videoReady}` : ""}`}
            autoPlay
            muted
            playsInline
            aria-label="Live camera preview"
          />
          {liveBoardGuide && guideDetection ? <BoardGuide detection={guideDetection} /> : null}
          {liveBoardGuide && ready ? (
            <span
              className={`${styles.guideStatus} ${
                guideDetection?.confidence && guideDetection.confidence >= LIVE_LOCKED_CONFIDENCE
                  ? styles.guideStatusLocked
                  : ""
              }`}
              aria-live="polite"
            >
              <i
                className={`fa-solid ${guideDetection ? "fa-border-all" : "fa-magnifying-glass"}`}
                aria-hidden="true"
              />
              {guideDetection
                ? guideDetection.confidence >= LIVE_LOCKED_CONFIDENCE
                  ? "Board found"
                  : "Adjust board"
                : "Finding board"}
            </span>
          ) : null}
          {!liveBoardGuide ? (
            <>
              <span className={`${styles.corner} ${styles.cornerTl}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.cornerTr}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.cornerBl}`} aria-hidden="true" />
              <span className={`${styles.corner} ${styles.cornerBr}`} aria-hidden="true" />
            </>
          ) : null}
          {!ready && (
            <div className={styles.previewBoard} aria-hidden="true">
              {PREVIEW_SQUARES.map((square) => (
                <span
                  key={square}
                  className={square % 2 === Math.floor(square / 8) % 2 ? styles.light : styles.dark}
                />
              ))}
            </div>
          )}
          <i className={`fa-solid fa-camera ${styles.cameraIcon}`} aria-hidden="true" />
        </div>
        <img className={styles.character} src="/character.png" alt="" aria-hidden="true" />
      </div>
    </section>
  );
});
