import { useFilters } from "../../hooks/useFilters";
import { GROUP_TYPES } from "../../constants";
import { Button } from "../shared/Button";
import { CheckboxRow } from "../shared/CheckboxRow";
import styles from "./GroupTypeFilter.module.css";

export function GroupTypeFilter() {
  const { selectedGroupTypes, setSelectedGroupTypes } = useFilters();

  const toggleType = (type: string) => {
    const next = new Set(selectedGroupTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setSelectedGroupTypes(next);
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Group Types</h3>
      <div className={styles.buttonRow}>
        <Button
          variant="secondary"
          onClick={() => setSelectedGroupTypes(new Set(GROUP_TYPES))}
        >
          Select All
        </Button>
        <Button
          variant="secondary"
          onClick={() => setSelectedGroupTypes(new Set())}
        >
          Clear All
        </Button>
      </div>
      <div className={styles.scrollContainer}>
        {GROUP_TYPES.map((type) => (
          <CheckboxRow
            key={type}
            checked={selectedGroupTypes.has(type)}
            onChange={() => toggleType(type)}
          >
            <span className={styles.label}>{type}</span>
          </CheckboxRow>
        ))}
      </div>
    </div>
  );
}
