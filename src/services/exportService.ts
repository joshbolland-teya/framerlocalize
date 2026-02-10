import * as XLSX from "xlsx";
import JSZip from "jszip";
import { LocalizationGroup, Locale } from "framer-plugin";
import {
  buildExcelData,
  createExcelWorkbook,
  generateExcelFilename,
} from "../utils/excelUtils";
import { buildXliff, sanitizeFilename } from "../utils/xliffBuilder";
import { downloadFile } from "../utils/fileDownload";

export interface ExportOptions {
  groups: readonly LocalizationGroup[];
  locales: readonly Locale[];
  selectedGroupIds: Set<string>;
  selectedLocaleCodes: Set<string>;
  selectedGroupTypes: Set<string>;
}

export async function exportToExcel(options: ExportOptions): Promise<void> {
  const { locales, selectedLocaleCodes } = options;

  const localeCols = locales
    .filter(
      (l) => selectedLocaleCodes.size === 0 || selectedLocaleCodes.has(l.code),
    )
    .map((l) => l.code);

  const rows = buildExcelData(options);
  const wb = createExcelWorkbook(rows, localeCols);
  const filename = generateExcelFilename();

  const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const excelBlob = new Blob([blob]);
  downloadFile(excelBlob, filename);
}

export async function exportToXliff(options: ExportOptions): Promise<void> {
  const {
    groups,
    locales,
    selectedGroupIds,
    selectedLocaleCodes,
    selectedGroupTypes,
  } = options;

  const filteredGroups = groups.filter((g) => {
    if (selectedGroupTypes.size > 0 && !selectedGroupTypes.has(g.type))
      return false;
    if (selectedGroupIds.size === 0) return true;
    return selectedGroupIds.has(g.id);
  });

  const selectedLocales = locales.filter(
    (l) => selectedLocaleCodes.size === 0 || selectedLocaleCodes.has(l.code),
  );

  if (selectedLocales.length === 0) {
    throw new Error("No languages selected for XLIFF export.");
  }

  if (selectedLocales.length === 1) {
    const locale = selectedLocales[0];
    const xml = buildXliff({ groups: filteredGroups, locale });

    const groupNames = filteredGroups.map((g) => g.name).join("_");
    const safeGroupNames = sanitizeFilename(groupNames);
    const filename = `framer-${safeGroupNames}-${locale.code}.xlf`;

    const blob = new Blob([xml], { type: "application/xml" });
    downloadFile(blob, filename);
    return;
  }

  const zip = new JSZip();

  for (const locale of selectedLocales) {
    const xml = buildXliff({ groups: filteredGroups, locale });

    let safeGroupNames = filteredGroups.map((g) => g.name).join("_");
    safeGroupNames = sanitizeFilename(safeGroupNames);

    const filename = `framer-${safeGroupNames}-${locale.code}.xlf`;
    zip.file(filename, xml);
  }

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  downloadFile(zipBlob, "framer-xliff-export.zip");
}
