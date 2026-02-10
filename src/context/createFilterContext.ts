import { createContext } from "react";
import { FilterState, FilterActions } from "../types";

export interface FilterContextValue extends FilterState, FilterActions {}

export const FilterContext = createContext<FilterContextValue | undefined>(
  undefined,
);
