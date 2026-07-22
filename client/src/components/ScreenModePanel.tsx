import styles from "./ScreenModePanel.module.css";
import { assetUrl } from "../config/runtime";
import { HostConnectionPanel } from "./HostConnectionPanel";
import type { PairedHost } from "../state/host";

type Props = {
  host: PairedHost | null;
  onHostChange: (host: PairedHost | null) => void;
  hostPrompt?: string;
};

export function ScreenModePanel({ host, onHostChange, hostPrompt }: Props) {
  return (
    <div className={styles.panel}>
      <img
        className={styles.character}
        src={assetUrl("main.png")}
        alt="Charlie is ready to capture"
        draggable={false}
      />
      <p className={styles.instructions}>
        Make sure a chess board is fully visible on your computer screen, then tap the button below
        to grab a screenshot and get your next move.
      </p>
      <HostConnectionPanel host={host} onHostChange={onHostChange} prompt={hostPrompt} />
    </div>
  );
}
