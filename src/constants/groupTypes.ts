export const GROUP_TYPES = [
  "page",
  "settings",
  "component",
  "collection",
  "collection-item",
  "template",
] as const;

export type GroupType = (typeof GROUP_TYPES)[number];
