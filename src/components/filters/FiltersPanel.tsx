import { ReactNode } from "react";
import styles from "./FiltersPanel.module.css";

interface FiltersPanelProps {
  isLoading: boolean;
  children: ReactNode;
}

export function FiltersPanel({ isLoading, children }: FiltersPanelProps) {
  return (
    <aside className={styles.panel}>
      <h2 className={styles.title}>Filters</h2>
      {isLoading ? <p>Loading…</p> : children}
    </aside>
  );
}
