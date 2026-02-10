import { useRef } from "react";
import { LocalizationGroup } from "framer-plugin";
import { useFilters } from "../../hooks/useFilters";
import { usePageGrouping } from "../../hooks/usePageGrouping";
import { useShiftSelect } from "../../hooks/useShiftSelect";
import { Button } from "../shared/Button";
import { CheckboxRow } from "../shared/CheckboxRow";
import { SearchInput } from "../shared/SearchInput";
import styles from "./PageFilter.module.css";

interface PageFilterProps {
  groups: readonly LocalizationGroup[];
}

export function PageFilter({ groups }: PageFilterProps) {
  const { selectedGroupIds, setSelectedGroupIds, pageSearch, setPageSearch } =
    useFilters();
  const { grouped, ungrouped, visibleFlat } = usePageGrouping(
    groups,
    pageSearch,
  );
  const { handleCheckboxClick } = useShiftSelect(
    selectedGroupIds,
    setSelectedGroupIds,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSearchChange = (value: string) => {
    setPageSearch(value);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Pages</h3>
      <div ref={scrollRef} className={styles.scrollContainer}>
        <div className={styles.buttonRow}>
          <Button
            variant="secondary"
            onClick={() =>
              setSelectedGroupIds(new Set(groups.map((g) => g.id)))
            }
          >
            Select All Pages
          </Button>
          <Button
            variant="secondary"
            onClick={() => setSelectedGroupIds(new Set())}
          >
            Clear All
          </Button>
        </div>

        <SearchInput
          value={pageSearch}
          onChange={handleSearchChange}
          placeholder="Search pages…"
          sticky
        />

        {Object.entries(grouped).map(([prefix, items]) => (
          <div key={prefix} className={styles.groupSection}>
            <div className={styles.groupHeader}>{prefix}</div>
            {items.map((group) => (
              <CheckboxRow
                key={group.id}
                checked={selectedGroupIds.has(group.id)}
                onChange={() => {}}
                onClick={(e) =>
                  handleCheckboxClick(group.id, visibleFlat, e.shiftKey)
                }
              >
                {group.name}
              </CheckboxRow>
            ))}
          </div>
        ))}

        {ungrouped.length > 0 && (
          <div className={styles.groupSection}>
            <div className={styles.groupHeader}>Other</div>
            {ungrouped.map((group) => (
              <CheckboxRow
                key={group.id}
                checked={selectedGroupIds.has(group.id)}
                onChange={() => {}}
                onClick={(e) =>
                  handleCheckboxClick(group.id, visibleFlat, e.shiftKey)
                }
              >
                {group.name}
              </CheckboxRow>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
