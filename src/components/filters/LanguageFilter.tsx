import { Locale } from "framer-plugin";
import { useFilters } from "../../hooks/useFilters";
import { Button } from "../shared/Button";
import { CheckboxRow } from "../shared/CheckboxRow";
import styles from "./LanguageFilter.module.css";

interface LanguageFilterProps {
  locales: readonly Locale[];
}

export function LanguageFilter({ locales }: LanguageFilterProps) {
  const { selectedLocaleCodes, setSelectedLocaleCodes } = useFilters();

  const toggleLocale = (code: string) => {
    const next = new Set(selectedLocaleCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelectedLocaleCodes(next);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Languages</h3>
      <div className={styles.buttonRow}>
        <Button
          variant="secondary"
          onClick={() =>
            setSelectedLocaleCodes(new Set(locales.map((l) => l.code)))
          }
        >
          Select All Languages
        </Button>
        <Button
          variant="secondary"
          onClick={() => setSelectedLocaleCodes(new Set())}
        >
          Clear All
        </Button>
      </div>
      <div className={styles.scrollContainer}>
        {locales.map((locale) => (
          <CheckboxRow
            key={locale.code}
            checked={selectedLocaleCodes.has(locale.code)}
            onChange={() => toggleLocale(locale.code)}
          >
            {locale.code}
          </CheckboxRow>
        ))}
      </div>
    </div>
  );
}
