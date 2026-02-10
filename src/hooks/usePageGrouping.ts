import { useMemo } from "react";
import { LocalizationGroup } from "framer-plugin";

export interface GroupedPages {
  grouped: Record<string, readonly LocalizationGroup[]>;
  ungrouped: readonly LocalizationGroup[];
  visibleFlat: readonly LocalizationGroup[];
}

export function usePageGrouping(
  groups: readonly LocalizationGroup[],
  searchQuery: string,
): GroupedPages {
  return useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const visibleGroups = [...groups]
      .filter((g) => {
        if (!query) return true;
        return g.name.toLowerCase().includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const visibleFlat = visibleGroups;
    const grouped: Record<string, typeof visibleGroups> = {};
    const ungrouped: typeof visibleGroups = [];

    visibleGroups.forEach((g) => {
      let prefix: string | null = null;

      if (g.name.includes("/")) {
        prefix = g.name.split("/")[0].trim();
      } else if (g.name.includes(">") || g.name.includes("›")) {
        const arrowChar = g.name.includes("›") ? "›" : ">";
        prefix = g.name.split(arrowChar)[0].trim();
      }

      if (prefix) {
        if (!grouped[prefix]) grouped[prefix] = [];
        grouped[prefix].push(g);
      } else {
        ungrouped.push(g);
      }
    });

    return { grouped, ungrouped, visibleFlat };
  }, [groups, searchQuery]);
}
