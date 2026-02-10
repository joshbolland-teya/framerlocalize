export interface FilterState {
  selectedGroupIds: Set<string>;
  selectedLocaleCodes: Set<string>;
  selectedGroupTypes: Set<string>;
  pageSearch: string;
}

export interface FilterActions {
  setSelectedGroupIds: (ids: Set<string>) => void;
  setSelectedLocaleCodes: (codes: Set<string>) => void;
  setSelectedGroupTypes: (types: Set<string>) => void;
  setPageSearch: (search: string) => void;
}
