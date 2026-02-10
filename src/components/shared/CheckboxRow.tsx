import { ReactNode } from "react";
import styles from "./CheckboxRow.module.css";

interface CheckboxRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  children: ReactNode;
}

export function CheckboxRow({
  checked,
  onChange,
  onClick,
  children,
}: CheckboxRowProps) {
  return (
    <div className={styles.checkbox}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        onClick={onClick}
      />
      <span>{children}</span>
    </div>
  );
}
