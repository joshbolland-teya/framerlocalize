import { ReactNode } from "react";
import styles from "./Button.module.css";

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  children: ReactNode;
}

export function Button({
  onClick,
  disabled,
  variant = "primary",
  children,
}: ButtonProps) {
  const className = variant === "primary" ? styles.primary : styles.secondary;

  return (
    <button
      className={`${styles.button} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
