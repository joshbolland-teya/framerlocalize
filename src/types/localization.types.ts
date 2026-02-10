import { LocalizationSourceId } from "framer-plugin";

export type NotificationVariant = "info" | "success" | "warning" | "error";

export type ExportRow = {
  sourceId: LocalizationSourceId;
  groupId: string;
  groupName: string;
  groupType: string;
  sourceType: string;
  baseValue: string;
  [localeCode: string]: string;
};

export type ExcelRow = Record<string, string | number | null | undefined>;
