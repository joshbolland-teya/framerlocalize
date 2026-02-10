import {
  LocalizationSourceId,
  LocalizationSourceUpdate,
  Locale,
  LocalizationGroup,
} from "framer-plugin";
import { parseExcelFile } from "../utils/excelUtils";
import { parseXliff } from "../utils/xliffParser";
import { ExcelRow } from "../types";
import { EXCEL_MAX_CELL_LENGTH } from "../constants";

export async function importFromExcel(
  file: File,
  locales: readonly Locale[],
): Promise<Record<LocalizationSourceId, LocalizationSourceUpdate>> {
  const buffer = await file.arrayBuffer();
  const rows: ExcelRow[] = parseExcelFile(buffer);

  const valuesBySource: Record<LocalizationSourceId, LocalizationSourceUpdate> =
    {};

  for (const row of rows) {
    const sourceId = (row.sourceId ?? "").toString().trim();
    if (!sourceId) continue;

    const update: LocalizationSourceUpdate = {};

    Object.keys(row).forEach((key) => {
      if (
        [
          "sourceId",
          "groupId",
          "groupName",
          "groupType",
          "sourceType",
          "baseValue",
        ].includes(key)
      ) {
        return;
      }

      const val = row[key];
      if (val === null || val === undefined) return;

      const localeObj = locales.find((l) => l.code === key.trim());
      if (!localeObj) {
        console.warn("Unknown locale column in Excel:", key);
        return;
      }

      const localeId = localeObj.id;
      const text = (val ?? "").toString();

      if (text.length > EXCEL_MAX_CELL_LENGTH) {
        console.warn(
          `VALUE TOO LARGE for sourceId ${sourceId}, locale ${key}, length=${text.length}`,
        );
        return;
      }

      if (text === "") {
        update[localeId] = { action: "clear" };
      } else {
        update[localeId] = { action: "set", value: text };
      }
    });

    valuesBySource[sourceId] = update;
  }

  return valuesBySource;
}

export async function importFromXliff(
  file: File,
  locales: readonly Locale[],
  groups: readonly LocalizationGroup[],
): Promise<Record<LocalizationSourceId, LocalizationSourceUpdate>> {
  const text = await file.text();

  const existingSources = new Map();
  groups.forEach((g) => g.sources.forEach((s) => existingSources.set(s.id, s)));

  const result = parseXliff(text, locales, existingSources);

  if ("error" in result) {
    throw new Error(result.error);
  }

  return result.valuesBySource;
}
