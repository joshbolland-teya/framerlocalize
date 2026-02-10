import { useState, ReactNode } from "react";
import { FilterContext, FilterContextValue } from "./createFilterContext";
import { GROUP_TYPES } from "../constants";

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedLocaleCodes, setSelectedLocaleCodes] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGroupTypes, setSelectedGroupTypes] = useState<Set<string>>(
    new Set(GROUP_TYPES),
  );
  const [pageSearch, setPageSearch] = useState("");

  const value: FilterContextValue = {
    selectedGroupIds,
    selectedLocaleCodes,
    selectedGroupTypes,
    pageSearch,
    setSelectedGroupIds,
    setSelectedLocaleCodes,
    setSelectedGroupTypes,
    setPageSearch,
  };

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}
