import styles from "./ReadyCard.module.css";
import { StatusRow } from "./StatusRow";

export function ReadyCard() {
  return (
    <div className={styles.readyCard}>
      <div className={styles.title}>
        SCREEN READER READY | <br />
        <span>Charlie is Ready!</span>
      </div>

      <div className={styles.sectionTitle}>Status Indicators:</div>
      <div className={styles.textGroup}>
        <StatusRow
          icon={<i className="fa-solid fa-desktop" />}
          label="Monitor"
          statusDot="green"
          value="Online"
        />
        <StatusRow
          icon={<i className="fa-solid fa-user" />}
          label="Coach"
          statusDot="green"
          value="Ready"
        />
      </div>

      <div className={styles.sectionTitle}>Data Status:</div>
      <div className={styles.textGroup}>
        <StatusRow
          icon={<i className="fa-solid fa-circle-plus" />}
          iconClassName={styles.iconGold}
          label="Analysis Credits: 1.2M"
        />
        <StatusRow
          icon={<i className="fa-solid fa-circle-question" />}
          iconClassName={styles.iconRed}
          label="Questions: 0 Pending"
        />
      </div>

      <div className={styles.footer}>
        Start your game on the computer and tap below when you are ready for analysis!
      </div>
    </div>
  );
}
