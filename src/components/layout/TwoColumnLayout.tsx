import { ReactNode } from "react";
import styles from "./TwoColumnLayout.module.css";

interface TwoColumnLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

export function TwoColumnLayout({ left, right }: TwoColumnLayoutProps) {
  return (
    <div className={styles.grid}>
      {left}
      {right}
    </div>
  );
}
