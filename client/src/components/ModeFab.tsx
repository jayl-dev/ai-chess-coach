import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { CaptureMode } from "../types/app";
import styles from "./ModeFab.module.css";

type Props = {
  active?: CaptureMode;
  onTrigger?: () => void;
  onModeChange?: (mode: CaptureMode) => void;
  busy?: boolean;
  starting?: boolean;
  actionLabel?: string;
};

const SLOT_X: Record<CaptureMode, number> = { camera: 0, monitor: 150 };
const SLOT_DISTANCE = 150;
const HALF = SLOT_DISTANCE / 2;
const LIFT_SCALE = 1.18;
const VEL_THRESHOLD = 300;

const PARTICLE_COUNT = 6;
const PARTICLE_DISTANCE = 44;
const PARTICLE_ANGLES = Array.from(
  { length: PARTICLE_COUNT },
  (_, i) => (i * Math.PI * 2) / PARTICLE_COUNT,
);

const HINT_KEY = "chesscoach.fabHintSeen";

export function ModeFab({
  active = "camera",
  onTrigger,
  onModeChange,
  busy = false,
  starting = false,
  actionLabel,
}: Props) {
  const reduceMotion = useReducedMotion();
  const podX = useMotionValue(SLOT_X[active]);
  const podScale = useMotionValue(1);
  const podVelocityX = useVelocity(podX);

  const shadowScale = useTransform(podScale, [1, LIFT_SCALE], [1, 1.4]);
  const shadowOpacity = useTransform(podScale, [1, LIFT_SCALE], [0.45, 0.22]);
  const shadowY = useTransform(podScale, [1, LIFT_SCALE], [0, 6]);

  const cameraSlotOpacity = useTransform(podX, [0, 75, 150], [0.75, 0.5, 0.35]);
  const monitorSlotOpacity = useTransform(podX, [0, 75, 150], [0.35, 0.5, 0.75]);

  const tilt = useTransform(podVelocityX, [-400, 0, 400], [10, 0, -10]);

  const [carried, setCarried] = useState(false);
  const [burstId, setBurstId] = useState(0);
  const [dustId, setDustId] = useState(0);
  const [glowFlash, setGlowFlash] = useState(false);

  const didDragRef = useRef(false);
  const prevActiveRef = useRef(active);

  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    if (prevActiveRef.current === active) return;
    prevActiveRef.current = active;
    if (reduceMotion) {
      podX.set(SLOT_X[active]);
      return;
    }
    animate(podX, SLOT_X[active], {
      type: "spring",
      stiffness: 400,
      damping: 28,
    });
    const t = window.setTimeout(() => setDustId((n) => n + 1), 280);
    return () => window.clearTimeout(t);
  }, [active, podX, reduceMotion]);

  const handleDragStart = () => {
    didDragRef.current = true;
    setCarried(true);
    if (reduceMotion) {
      podScale.set(LIFT_SCALE);
      return;
    }
    animate(podScale, LIFT_SCALE, {
      type: "spring",
      stiffness: 500,
      damping: 25,
    });
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 10);

    const traveled = info.offset.x;
    const velocity = info.velocity.x;
    const direction = active === "camera" ? 1 : -1;
    const movedTowardOther = direction * traveled > 0;
    const pastMid = Math.abs(traveled) > HALF;
    const fastEnough = Math.abs(velocity) > VEL_THRESHOLD;

    const switched = movedTowardOther && (pastMid || fastEnough);

    if (switched) {
      onModeChange?.(active === "camera" ? "monitor" : "camera");
    } else {
      if (reduceMotion) {
        podX.set(SLOT_X[active]);
      } else {
        animate(podX, SLOT_X[active], {
          type: "spring",
          stiffness: 500,
          damping: 28,
        });
      }
    }

    if (reduceMotion) {
      podScale.set(1);
    } else {
      animate(podScale, [podScale.get(), 0.97, 1], {
        duration: 0.32,
        times: [0, 0.3, 1],
        ease: "easeOut",
      });
    }
    setCarried(false);
    if (!reduceMotion) {
      window.setTimeout(() => setDustId((n) => n + 1), 90);
    }
    vibrate(8);
  };

  const handleTap = () => {
    if (busy || starting || didDragRef.current) return;
    onTrigger?.();
    if (!reduceMotion) {
      setBurstId((n) => n + 1);
      setGlowFlash(true);
      animate(podScale, [1, 1.06, 1], {
        duration: 0.25,
        ease: "easeOut",
      });
      window.setTimeout(() => setGlowFlash(false), 400);
    }
    vibrate(20);
  };

  const handlePodKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (busy || starting) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      handleTap();
    }
  };

  const handleSlotClick = (mode: CaptureMode) => {
    if (busy || mode === active) return;
    onModeChange?.(mode);
  };

  let iconName: string;
  if (busy || starting) {
    iconName = "fa-circle-notch";
  } else if (carried) {
    iconName = "fa-chess-knight";
  } else {
    iconName = active === "camera" ? "fa-camera" : "fa-desktop";
  }

  return (
    <div className={styles.container}>
      <motion.button
        type="button"
        className={`${styles.slot}${busy ? ` ${styles.slotBusy}` : ""}`}
        aria-label="Switch to camera mode"
        onClick={() => handleSlotClick("camera")}
        tabIndex={busy ? -1 : 0}
        style={{ opacity: busy ? 0.2 : cameraSlotOpacity }}
      >
        <i className={`fa-solid fa-camera ${styles.slotIcon}`} aria-hidden="true" />
      </motion.button>
      <motion.button
        type="button"
        className={`${styles.slot}${busy ? ` ${styles.slotBusy}` : ""}`}
        aria-label="Switch to monitor mode"
        onClick={() => handleSlotClick("monitor")}
        tabIndex={busy ? -1 : 0}
        style={{ opacity: busy ? 0.2 : monitorSlotOpacity }}
      >
        <i className={`fa-solid fa-desktop ${styles.slotIcon}`} aria-hidden="true" />
      </motion.button>

      <motion.div
        className={styles.knightShadow}
        style={{ x: podX, scale: shadowScale, opacity: shadowOpacity, y: shadowY }}
        aria-hidden="true"
      />

      <motion.div
        className={styles.podWrap}
        drag={busy ? false : "x"}
        dragConstraints={{ left: 0, right: SLOT_DISTANCE }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{ x: podX, scale: podScale }}
        onClick={handleTap}
        onKeyDown={handlePodKeyDown}
        role="button"
        aria-label={
          busy
            ? "Working"
            : starting
              ? "Camera is starting"
              : (actionLabel ?? `Capture in ${active} mode`)
        }
        aria-disabled={busy || starting}
        tabIndex={busy || starting ? -1 : 0}
      >
        {!reduceMotion && burstId > 0 && <Burst key={`burst-${burstId}`} />}
        {!reduceMotion && dustId > 0 && <Dust key={`dust-${dustId}`} />}

        <motion.div
          className={`${styles.pod}${glowFlash ? ` ${styles.podFlare}` : ""}`}
          style={{ rotate: tilt }}
        >
          <div className={styles.iconWrap}>
            <AnimatePresence initial={false}>
              <motion.i
                key={iconName}
                className={`fa-solid ${iconName} ${styles.podIcon}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotate: busy || starting ? 360 : 0,
                }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={
                  busy || starting
                    ? {
                        opacity: { duration: 0.15 },
                        scale: { duration: 0.15 },
                        rotate: {
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        },
                      }
                    : { duration: 0.18 }
                }
                aria-hidden="true"
              />
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      <Hint />
    </div>
  );
}

function Burst() {
  return (
    <div className={styles.burstWrap} aria-hidden="true">
      <motion.div
        className={styles.ring}
        initial={{ scale: 1, opacity: 0.8 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {PARTICLE_ANGLES.map((angle, i) => (
        <motion.span
          key={i}
          className={styles.particle}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(angle) * PARTICLE_DISTANCE,
            y: Math.sin(angle) * PARTICLE_DISTANCE,
            opacity: 0,
            scale: 0.3,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function Dust() {
  return (
    <div className={styles.dustWrap} aria-hidden="true">
      <motion.div
        className={`${styles.shockwave} ${styles.ring}`}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1.7, opacity: [0, 0.4, 0] }}
        transition={{ duration: 0.42, ease: "easeOut", times: [0, 0.25, 1] }}
      />
    </div>
  );
}

function Hint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(HINT_KEY) === "1";
    } catch {
      return;
    }
    if (seen) return;
    setShow(true);
    const t = window.setTimeout(() => {
      setShow(false);
      try {
        localStorage.setItem(HINT_KEY, "1");
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={styles.hintWrap}
          initial={{ opacity: 0, y: 8, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 8, x: "-50%" }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.hint}>
            <i className={`fa-solid fa-chevron-up ${styles.hintIcon}`} aria-hidden="true" />
            <span>Drag to switch • Tap to capture</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
