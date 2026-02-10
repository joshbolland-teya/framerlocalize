import { ReactNode } from "react";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Framer Localization Sync</h1>
        <p className={styles.subtitle}>
          Export and import translations using Excel or XLIFF with full control.
        </p>
      </header>
      {children}
    </div>
  );
}
