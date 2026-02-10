import { useRef } from "react";
import { LocalizationGroup } from "framer-plugin";

export function useShiftSelect(
  selectedGroupIds: Set<string>,
  setSelectedGroupIds: (ids: Set<string>) => void,
) {
  const lastClickedIndexRef = useRef<number | null>(null);

  const handleCheckboxClick = (
    groupId: string,
    visibleFlat: readonly LocalizationGroup[],
    shiftKey: boolean,
  ) => {
    const index = visibleFlat.findIndex((g) => g.id === groupId);
    if (index === -1) return;

    const next = new Set(selectedGroupIds);

    if (shiftKey && lastClickedIndexRef.current !== null) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);

      for (let i = start; i <= end; i++) {
        next.add(visibleFlat[i].id);
      }
    } else {
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
    }

    lastClickedIndexRef.current = index;
    setSelectedGroupIds(next);
  };

  return { handleCheckboxClick };
}
