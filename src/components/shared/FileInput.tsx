import { ChangeEvent, forwardRef } from "react";
import styles from "./FileInput.module.css";

interface FileInputProps {
  accept: string;
  onChange: (evt: ChangeEvent<HTMLInputElement>) => void;
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  ({ accept, onChange }, ref) => {
    return (
      <input
        ref={ref}
        type="file"
        accept={accept}
        onChange={onChange}
        className={styles.input}
      />
    );
  },
);

FileInput.displayName = "FileInput";
