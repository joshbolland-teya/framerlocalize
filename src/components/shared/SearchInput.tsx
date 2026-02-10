import styles from "./SearchInput.module.css";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sticky?: boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  sticky,
}: SearchInputProps) {
  const wrapperClass = sticky
    ? `${styles.wrapper} ${styles.sticky}`
    : styles.wrapper;

  return (
    <div className={wrapperClass}>
      <input
        type="text"
        placeholder={placeholder}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value.trim() !== "" && (
        <button
          className={styles.clearButton}
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
