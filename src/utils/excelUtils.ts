import * as XLSX from "xlsx";
import { ExportRow, ExcelRow } from "../types";
import { LocalizationGroup, Locale } from "framer-plugin";
import { EXCEL_MAX_CELL_LENGTH } from "../constants";

export interface ExcelExportOptions {
  groups: readonly LocalizationGroup[];
  locales: readonly Locale[];
  selectedGroupIds: Set<string>;
  selectedLocaleCodes: Set<string>;
  selectedGroupTypes: Set<string>;
}

export function buildExcelData(options: ExcelExportOptions): ExportRow[] {
  const {
    groups,
    locales,
    selectedGroupIds,
    selectedLocaleCodes,
    selectedGroupTypes,
  } = options;

  const localeCols = locales
    .filter(
      (l) => selectedLocaleCodes.size === 0 || selectedLocaleCodes.has(l.code),
    )
    .map((l) => ({
      id: l.id,
      code: l.code,
    }));

  const rows: ExportRow[] = [];

  const filteredGroups = groups.filter((g) => {
    if (selectedGroupTypes.size > 0 && !selectedGroupTypes.has(g.type))
      return false;
    if (selectedGroupIds.size === 0) return true;
    return selectedGroupIds.has(g.id);
  });

  filteredGroups.forEach((group) => {
    if (group.name.length > EXCEL_MAX_CELL_LENGTH) {
      console.warn(
        `Skipping group ${group.id} because groupName length ${group.name.length} > ${EXCEL_MAX_CELL_LENGTH}`,
      );
      return;
    }

    group.sources.forEach((source) => {
      const baseValue = source.value ?? "";

      if (baseValue.length > EXCEL_MAX_CELL_LENGTH) {
        console.warn(
          `Skipping sourceId ${source.id}: baseValue length ${baseValue.length} > ${EXCEL_MAX_CELL_LENGTH}`,
        );
        return;
      }

      let skipSource = false;
      const localizedMap: Record<string, string> = {};

      localeCols.forEach((locale) => {
        const localized = source.valueByLocale?.[locale.id]?.value ?? "";

        if (localized.length > EXCEL_MAX_CELL_LENGTH) {
          console.warn(
            `Skipping sourceId ${source.id}, locale ${locale.code}: value too long (${localized.length})`,
          );
          skipSource = true;
          return;
        }

        localizedMap[locale.code] = localized;
      });

      if (skipSource) {
        return;
      }

      const row: ExportRow = {
        sourceId: source.id,
        groupId: group.id,
        groupName: group.name,
        groupType: group.type,
        sourceType: source.type,
        baseValue,
        ...localizedMap,
      };

      rows.push(row);
    });
  });

  return rows;
}

export function createExcelWorkbook(
  rows: ExportRow[],
  localeCodes: string[],
): XLSX.WorkBook {
  const headerRow = [
    "sourceId",
    "groupId",
    "groupName",
    "groupType",
    "sourceType",
    "baseValue",
    ...localeCodes,
  ];

  const aoaData = [
    headerRow,
    ...rows.map((r) => [
      r.sourceId,
      r.groupId,
      r.groupName,
      r.groupType,
      r.sourceType,
      r.baseValue,
      ...localeCodes.map((code) => r[code] ?? ""),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoaData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Translations");

  return wb;
}

export function parseExcelFile(buffer: ArrayBuffer): ExcelRow[] {
  const wb = XLSX.read(buffer);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ExcelRow>(sheet);
}

export function generateExcelFilename(): string {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  return `framer-localization-sync-translations-${now}.xlsx`;
}
