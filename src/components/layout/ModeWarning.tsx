import styles from "./ModeWarning.module.css";

export function ModeWarning() {
  return (
    <div className={styles.warning}>
      Switch to the Localizations panel to access locale data.
    </div>
  );
}
