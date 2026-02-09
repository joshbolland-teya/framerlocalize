import {
  framer,
  LocalizationSourceId,
  LocalizationSourceUpdate,
  LocalizationGroup,
  Locale,
} from "framer-plugin";
import JSZip from "jszip";
import { ChangeEvent, useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./App.css";

framer.showUI({
  position: "top right",
  width: 1400,
  height: 1000,
  resizable: true,
  minWidth: 900,
  minHeight: 600,
});

type NotificationVariant = "info" | "success" | "warning" | "error";

// Row structure for Excel export/import
type ExportRow = {
  sourceId: LocalizationSourceId;
  groupId: string;
  groupName: string;
  groupType: string;
  sourceType: string;
  baseValue: string;
  [localeCode: string]: string;
};

// Payload from XLSX.sheet_to_json()
type ExcelRow = Record<string, string | number | null | undefined>;

// Values grouped by source for import

export function App() {
  const isLocalizationMode = framer.mode === "localization";
  const localizationModeHint =
    "Open this plugin from the Localizations panel to sync translations.";

  const [statusMessage, setStatusMessage] = useState(
    isLocalizationMode ? "Idle" : localizationModeHint,
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xlfInputRef = useRef<HTMLInputElement>(null);
  const handleImportXLIFFClick = () => {
    if (!requireLocalizationMode()) return;
    xlfInputRef.current?.click();
  };

  const handleImportXLIFF = async (evt: ChangeEvent<HTMLInputElement>) => {
    if (!requireLocalizationMode()) {
      evt.target.value = "";
      return;
    }
    const file = evt.target.files?.[0];
    evt.target.value = "";
    if (!file) return;

    setIsImporting(true);
    setStatusMessage("Reading XLIFF…");

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "application/xml");

      const locales = await framer.getLocales();
      const existingGroups = await framer.getLocalizationGroups();

      const existingSources = new Map();
      existingGroups.forEach((g) =>
        g.sources.forEach((s) => existingSources.set(s.id, s)),
      );

      const xliffNS = xml.documentElement.namespaceURI || null;

      const units = xliffNS
        ? Array.from(xml.getElementsByTagNameNS(xliffNS, "trans-unit"))
        : Array.from(xml.getElementsByTagName("trans-unit"));

      const fileTag = xml.getElementsByTagName("file")[0];
      const targetLangRaw =
        fileTag?.getAttribute("target-language")?.trim() || "";

      const targetLocaleObj =
        locales.find((l) => l.code === targetLangRaw) ||
        locales.find((l) => targetLangRaw.startsWith(l.code)) ||
        null;

      if (!targetLocaleObj) {
        notify(
          `Could not map locale "${targetLangRaw}" to any Framer locale`,
          "error",
        );
        setStatusMessage("Import failed.");
        setIsImporting(false);
        return;
      }

      const targetLocaleId = targetLocaleObj.id;

      const valuesBySource: Record<
        LocalizationSourceId,
        LocalizationSourceUpdate
      > = {};

      console.log("Processing", units.length, "trans-units from XLF");

      for (const unit of units) {
        const id =
          unit.getAttribute("id") || unit.getAttribute("resname") || null;

        if (!id) continue;
        const existingSource = existingSources.get(id);
        if (!existingSource) {
          console.debug("Skipping unknown source ID:", id);
          continue;
        }

        let targetNode: Element | null = null;

        if (xliffNS) {
          const t = unit.getElementsByTagNameNS(xliffNS, "target");
          targetNode = t.length > 0 ? t[0] : null;
        } else {
          const t = unit.getElementsByTagName("target");
          targetNode = t.length > 0 ? t[0] : null;
        }

        if (!targetNode) continue;

        // Handle both escaped (&lt;h1&gt;) and unescaped (<h1>) HTML
        // If target contains child elements, it has unescaped HTML - serialize it
        // Otherwise use textContent which unescapes entities
        let value: string;
        if (targetNode.children.length > 0) {
          // Has child HTML elements - serialize the innerHTML
          value = targetNode.innerHTML.trim();
          console.log(
            "Using innerHTML (has children):",
            id,
            value.substring(0, 50),
          );
        } else {
          // No child elements - use textContent to unescape entities like &lt;
          value = (targetNode.textContent || "").trim();
          if (value.includes("<") || value.includes(">")) {
            console.log(
              "Using textContent with HTML:",
              id,
              "type:",
              existingSource.type,
              "value:",
              value.substring(0, 80),
            );
          }
        }

        // For formattedText, strip outer wrapper tags (h1, h2, p, etc.)
        // Framer stores just the inner text, applying tags as formatting
        if (existingSource.type === "formattedText" && value.includes("<")) {
          const wrapperMatch = value.match(/^<(\w+)[^>]*>(.*)<\/\1>$/s);
          if (wrapperMatch) {
            const originalValue = value;
            const innerContent = wrapperMatch[2].trim();

            // Use DOM parser to strip ALL HTML tags and decode entities
            // This handles both outer wrappers and inline tags like <strong>, <em>, etc.
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = innerContent;
            value = tempDiv.textContent || tempDiv.innerText || "";
            value = value.trim();

            console.log(
              "Stripped HTML for formattedText:",
              id,
              "\nBefore:",
              originalValue.substring(0, 100),
              "\nAfter:",
              value.substring(0, 100),
            );
          }
        }

        // Log original value vs what we're importing for formattedText
        if (
          existingSource.type === "formattedText" &&
          (value.includes("<") || existingSource.value !== value)
        ) {
          console.log(
            "FormattedText field:",
            id,
            "\nOriginal:",
            existingSource.value?.substring(0, 100),
            "\nImporting:",
            value.substring(0, 100),
            "\nMatch:",
            existingSource.value === value,
          );
        }

        valuesBySource[id] = {
          [targetLocaleId]:
            value === "" ? { action: "clear" } : { action: "set", value },
        };
      }

      await framer.setLocalizationData({ valuesBySource });
      setStatusMessage("XLIFF import complete.");
      notify("Translations updated from XLIFF.", "success");
    } catch (err) {
      notify((err as Error).message || "XLIFF import failed.", "error");
      setStatusMessage("XLIFF import failed.");
    } finally {
      setIsImporting(false);
    }
  };
  const downloadUrlRef = useRef<string | null>(null);
  const modeWarningShownRef = useRef(false);

  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [pageSearch, setPageSearch] = useState("");
  const [selectedLocaleCodes, setSelectedLocaleCodes] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGroupTypes, setSelectedGroupTypes] = useState<Set<string>>(
    new Set([
      "page",
      "settings",
      "component",
      "collection",
      "collection-item",
      "template",
    ]),
  );

  // Ref for scroll-to-top on page search
  const pagesScrollRef = useRef<HTMLDivElement>(null);

  const groupsRef = useRef<readonly LocalizationGroup[]>([]);
  const localesRef = useRef<readonly Locale[]>([]);

  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const lastClickedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (framer.mode !== "localization") return;
    (async () => {
      const [locs, grps] = await Promise.all([
        framer.getLocales(),
        framer.getLocalizationGroups(),
      ]);
      groupsRef.current = [...grps];
      localesRef.current = [...locs];
      setIsLoadingFilters(false);
    })();
  }, []);

  const actionsDisabled = isExporting || isImporting || !isLocalizationMode;

  const notify = (msg: string, variant: NotificationVariant = "info") => {
    try {
      framer.notify(msg, { variant });
    } catch {
      console.log(`[${variant}] ${msg}`);
    }
  };

  /* ----------------------------------------------------------
       EXPORT (to Option A Excel Format)
       one row per source
       columns: sourceId | groupId | groupName | baseValue | en | es | it | ...
    ---------------------------------------------------------- */

  const handleExport = async () => {
    if (!requireLocalizationMode()) return;

    try {
      setIsExporting(true);
      setStatusMessage("Collecting localization data…");

      const [locales, groups] = await Promise.all([
        framer.getLocales(),
        framer.getLocalizationGroups(),
      ]);
      console.debug(
        "handleExport: got locales=%d groups=%d",
        locales.length,
        groups.length,
      );
      if (groups.length > 0)
        console.debug(
          "handleExport: sample group",
          groups[0].id,
          groups[0].name,
          groups[0].sources?.length,
        );
      groupsRef.current = [...groups];
      localesRef.current = [...locales];

      const localeCols = locales
        .filter(
          (l) =>
            selectedLocaleCodes.size === 0 || selectedLocaleCodes.has(l.code),
        )
        .map((l) => ({
          id: l.id,
          code: l.code,
        }));
      console.debug(
        "handleExport: localeCols=%d, selectedLocaleCodes=%d",
        localeCols.length,
        selectedLocaleCodes.size,
      );

      const rows: ExportRow[] = [];

      const filteredGroups = groups.filter((g) => {
        // Filter by type
        if (selectedGroupTypes.size > 0 && !selectedGroupTypes.has(g.type))
          return false;
        // Filter by selected IDs
        if (selectedGroupIds.size === 0) return true;
        return selectedGroupIds.has(g.id);
      });
      filteredGroups.forEach((group) => {
        // Skip entire group if group name is too long
        if (group.name.length > 32767) {
          console.warn(
            `Skipping group ${group.id} because groupName length ${group.name.length} > 32767`,
          );
          return;
        }
        group.sources.forEach((source) => {
          const baseValue = source.value ?? "";

          // ❌ Skip if base value too long
          if (baseValue.length > 32767) {
            console.warn(
              `Skipping sourceId ${source.id}: baseValue length ${baseValue.length} > 32767`,
            );
            return;
          }

          // Check localized values
          let skipSource = false;
          const localizedMap: Record<string, string> = {};

          localeCols.forEach((locale) => {
            const localized = source.valueByLocale?.[locale.id]?.value ?? "";

            if (localized.length > 32767) {
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

      setStatusMessage("Building Excel file…");
      console.debug("handleExport: building workbook, rows=%d", rows.length);

      const headerRow = [
        "sourceId",
        "groupId",
        "groupName",
        "groupType",
        "sourceType",
        "baseValue",
        ...localeCols.map((l) => l.code),
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
          ...localeCols.map((l) => r[l.code] ?? ""),
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoaData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Translations");

      const now = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `framer-localization-sync-translations-${now}.xlsx`;

      const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const url = URL.createObjectURL(new Blob([blob]));
      downloadUrlRef.current = url;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();

      setStatusMessage("Export complete.");
      notify("Excel export generated.", "success");
    } catch (err: unknown) {
      notify((err as Error).message || "Export failed", "error");
      setStatusMessage("Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  /* ----------------------------------------------------------
       EXPORT (to XLIFF 1.2)
    ---------------------------------------------------------- */

  const handleExportXLIFF = async () => {
    if (!requireLocalizationMode()) return;

    try {
      setIsExporting(true);
      setStatusMessage("Collecting localization data…");

      const groups = groupsRef.current;
      const locales = localesRef.current;
      console.debug(
        "handleExportXLIFF: groups=%d locales=%d selectedGroupIds=%d selectedLocaleCodes=%d",
        groups.length,
        locales.length,
        selectedGroupIds.size,
        selectedLocaleCodes.size,
      );

      // Filter groups + languages based on user selection
      const filteredGroups = groups.filter((g) => {
        // Filter by type
        if (selectedGroupTypes.size > 0 && !selectedGroupTypes.has(g.type))
          return false;
        // Filter by selected IDs
        if (selectedGroupIds.size === 0) return true;
        return selectedGroupIds.has(g.id);
      });

      const selectedLocales = locales.filter(
        (l) =>
          selectedLocaleCodes.size === 0 || selectedLocaleCodes.has(l.code),
      );

      if (selectedLocales.length === 0) {
        notify("No languages selected for XLIFF export.", "warning");
        setIsExporting(false);
        return;
      }

      // If only one locale, keep single-file behavior
      if (selectedLocales.length === 1) {
        const locale = selectedLocales[0];
        const targetLang = locale.code;

        // Build XML
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2">\n`;
        xml += `  <file source-language="en-GB" target-language="${targetLang}" datatype="plaintext" original="group-export">\n`;
        xml += `    <body>\n`;

        filteredGroups.forEach((group) => {
          console.debug(
            "handleExportXLIFF: group %s sources=%d",
            group.id,
            group.sources?.length ?? 0,
          );
          group.sources.forEach((source) => {
            const baseValue = source.value ?? "";
            const safeBase = baseValue
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;");

            const translated = source.valueByLocale?.[locale.id]?.value ?? "";
            const safeTranslated = translated
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;");

            xml += `      <trans-unit id="${source.id}" resname="${group.name}" extradata="groupType:${group.type},sourceType:${source.type}" xml:space="preserve">\n`;
            xml += `        <source>${safeBase}</source>\n`;
            xml += `        <target>${safeTranslated}</target>\n`;
            xml += `      </trans-unit>\n`;
          });
        });

        xml += `    </body>\n  </file>\n</xliff>`;

        // Download filename includes the selected group name(s)
        const groupNames = filteredGroups.map((g) => g.name).join("_");
        const safeGroupNames = groupNames.replace(/[^a-zA-Z0-9_-]/g, "-");

        const filename = `framer-${safeGroupNames}-${targetLang}.xlf`;

        const blob = new Blob([xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();

        setStatusMessage("XLIFF export complete.");
        notify("XLIFF 1.2 file generated.", "success");
        return;
      }

      // Multi-locale export → ZIP
      setStatusMessage("Building XLIFF files and ZIP…");
      console.debug(
        "handleExportXLIFF: building ZIP for %d locales",
        selectedLocales.length,
      );

      const zip = new JSZip();

      for (const locale of selectedLocales) {
        const targetLang = locale.code;

        // Use array and join for better memory management with large strings
        const xmlParts: string[] = [];
        xmlParts.push(
          `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2">\n`,
        );
        xmlParts.push(
          `  <file source-language="en-GB" target-language="${targetLang}" datatype="plaintext" original="group-export">\n`,
        );
        xmlParts.push(`    <body>\n`);

        filteredGroups.forEach((group) => {
          group.sources.forEach((source) => {
            const baseValue = source.value ?? "";
            const safeBase = baseValue
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;");

            const translated = source.valueByLocale?.[locale.id]?.value ?? "";
            const safeTranslated = translated
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;");

            xmlParts.push(
              `      <trans-unit id="${source.id}" resname="${group.name}" extradata="groupType:${group.type},sourceType:${source.type}" xml:space="preserve">\n`,
            );
            xmlParts.push(`        <source>${safeBase}</source>\n`);
            xmlParts.push(`        <target>${safeTranslated}</target>\n`);
            xmlParts.push(`      </trans-unit>\n`);
          });
        });

        xmlParts.push(`    </body>\n  </file>\n</xliff>`);
        const xml = xmlParts.join("");

        // Limit filename length to avoid filesystem issues (max 200 chars)
        let safeGroupNames = filteredGroups
          .map((g) => g.name)
          .join("_")
          .replace(/[^a-zA-Z0-9_-]/g, "-");

        if (safeGroupNames.length > 150) {
          safeGroupNames = safeGroupNames.substring(0, 150) + "-more";
        }

        const filename = `framer-${safeGroupNames}-${targetLang}.xlf`;

        // Add file as UTF‑8 text
        zip.file(filename, xml);
      }

      // Generate ZIP as blob (better for large files)
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = zipUrl;
      a.download = "framer-xliff-export.zip";
      a.click();

      setStatusMessage("XLIFF ZIP export complete.");
      notify("XLIFF 1.2 ZIP generated.", "success");
    } catch (err) {
      notify((err as Error).message || "XLIFF export failed.", "error");
      setStatusMessage("XLIFF export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileClick = () => {
    if (!requireLocalizationMode()) return;
    fileInputRef.current?.click();
  };

  const handleImportFile = async (evt: ChangeEvent<HTMLInputElement>) => {
    if (!requireLocalizationMode()) {
      evt.target.value = "";
      return;
    }

    const file = evt.target.files?.[0];
    evt.target.value = "";

    if (!file) return;

    setIsImporting(true);
    setStatusMessage("Reading Excel file…");

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: ExcelRow[] = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

      const valuesBySource: Record<
        LocalizationSourceId,
        LocalizationSourceUpdate
      > = {};

      const locales = await framer.getLocales();
      const existingGroups = await framer.getLocalizationGroups();
      const existingSources = new Map();
      existingGroups.forEach((group) => {
        group.sources.forEach((source) => {
          existingSources.set(source.id, source);
        });
      });

      for (const row of rows) {
        const sourceId = row["sourceId"] as LocalizationSourceId;
        const existing = existingSources.get(sourceId);
        if (existing) {
          if ((existing.value ?? "").length > 32767) {
            console.warn(
              `Skipping sourceId ${sourceId}: existing baseValue too long`,
            );
            continue;
          }
          const hasOversized = locales.some((l) => {
            const val = existing.valueByLocale?.[l.id]?.value ?? "";
            return val.length > 32767;
          });
          if (hasOversized) {
            console.warn(
              `Skipping sourceId ${sourceId}: existing localized value too long`,
            );
            continue;
          }
        }

        if (!sourceId) continue;

        const update: LocalizationSourceUpdate = {};

        Object.entries(row as ExcelRow).forEach(([key, val]) => {
          if (
            key === "sourceId" ||
            key === "groupId" ||
            key === "groupName" ||
            key === "baseValue"
          ) {
            return;
          }

          // Map Excel column (locale.code) → actual LocaleId
          const localeObj = locales.find((l) => l.code === key.trim());
          if (!localeObj) {
            console.warn("Unknown locale column in Excel:", key);
            return;
          }

          const localeId = localeObj.id;
          const text = (val ?? "").toString();

          if (text.length > 32767) {
            console.warn(
              `❌ VALUE TOO LARGE for sourceId ${sourceId}, locale ${key}, length=${text.length}`,
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

      setStatusMessage("Applying translations to Framer…");
      await framer.setLocalizationData({ valuesBySource });

      setStatusMessage("Import complete.");
      notify("Translations updated from Excel.", "success");
    } catch (err: unknown) {
      notify((err as Error).message || "Import failed.", "error");
      setStatusMessage("Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  /* ----------------------------------------------------------
       UTIL: ensure plugin is run in Localization mode
    ---------------------------------------------------------- */

  const requireLocalizationMode = () => {
    if (framer.mode === "localization") return true;

    setStatusMessage(localizationModeHint);
    if (!modeWarningShownRef.current) {
      notify("Open the Localizations panel first.", "warning");
      modeWarningShownRef.current = true;
    }
    return false;
  };

  /* ---------------------------------------------------------- */

  return (
    <div className="app-container">
      <header style={{ marginBottom: "20px" }}>
        <h1 style={{ margin: 0 }}>Framer Localization Sync</h1>
        <p
          style={{
            color: "var(--framer-color-text-secondary)",
            marginTop: "6px",
          }}
        >
          Export and import translations using Excel or XLIFF with full control.
        </p>
      </header>

      {!isLocalizationMode && (
        <div className="mode-warning">
          Switch to the Localizations panel to access locale data.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "400px 1fr",
          gap: "24px",
          height: "100%",
        }}
      >
        {/* LEFT PANEL — FILTERS */}
        <aside className="panel">
          <h2 style={{ fontSize: "16px", marginBottom: "12px" }}>Filters</h2>

          {isLoadingFilters && <p>Loading…</p>}

          {!isLoadingFilters && (
            <>
              {/* Pages */}
              <h3 style={{ marginBottom: "8px" }}>Pages</h3>
              <div
                ref={pagesScrollRef}
                style={{
                  marginBottom: "16px",
                  maxHeight: "600px",
                  overflowY: "auto",
                }}
              >
                <div className="row mb-8">
                  <button
                    className="framer-button-secondary"
                    style={{ flex: 1 }}
                    onClick={() =>
                      setSelectedGroupIds(
                        new Set(groupsRef.current.map((g) => g.id)),
                      )
                    }
                  >
                    Select All Pages
                  </button>
                  <button
                    className="framer-button-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedGroupIds(new Set())}
                  >
                    Clear All
                  </button>
                </div>

                <div className="search-wrapper search-sticky">
                  <input
                    type="text"
                    placeholder="Search pages…"
                    className="search-input"
                    value={pageSearch}
                    onChange={(e) => {
                      setPageSearch(e.target.value);
                      if (pagesScrollRef.current) {
                        pagesScrollRef.current.scrollTop = 0;
                      }
                    }}
                  />

                  {pageSearch.trim() !== "" && (
                    <button
                      className="search-clear-btn"
                      onClick={() => setPageSearch("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
                {(() => {
                  const query = pageSearch.trim().toLowerCase();

                  // 1. Filter by search
                  // 1. Filter by search
                  const visibleGroups = [...groupsRef.current]
                    .filter((g) => {
                      if (!query) return true;
                      return g.name.toLowerCase().includes(query);
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));

                  // 2. Flatten visible groups into an ordered list
                  const visibleFlat = visibleGroups;

                  // 3. Group items by "/" or ">" ("/" takes priority)
                  const grouped: Record<string, typeof visibleGroups> = {};
                  const ungrouped: typeof visibleGroups = [];

                  visibleGroups.forEach((g) => {
                    let prefix: string | null = null;

                    // Slash grouping
                    if (g.name.includes("/")) {
                      prefix = g.name.split("/")[0].trim();
                    }
                    // Arrow grouping (ASCII or Unicode)
                    else if (g.name.includes(">") || g.name.includes("›")) {
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

                  const handleCheckboxClick = (
                    groupId: string,
                    e: React.MouseEvent<HTMLInputElement>,
                  ) => {
                    const index = visibleFlat.findIndex(
                      (g) => g.id === groupId,
                    );
                    if (index === -1) return;

                    const next = new Set(selectedGroupIds);

                    // If shift key held + previous index exists → select range
                    if (e.shiftKey && lastClickedIndexRef.current !== null) {
                      const start = Math.min(
                        lastClickedIndexRef.current,
                        index,
                      );
                      const end = Math.max(lastClickedIndexRef.current, index);

                      for (let i = start; i <= end; i++) {
                        next.add(visibleFlat[i].id);
                      }

                      setSelectedGroupIds(next);
                      return;
                    }

                    // Normal toggle
                    if (next.has(groupId)) {
                      next.delete(groupId);
                    } else {
                      next.add(groupId);
                    }

                    setSelectedGroupIds(next);

                    // Update last clicked index
                    lastClickedIndexRef.current = index;
                  };

                  const output: JSX.Element[] = [];

                  // Render grouped sections
                  Object.entries(grouped).forEach(([prefix, items]) => {
                    output.push(
                      <div key={prefix} style={{ marginBottom: "14px" }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "13px",
                            margin: "6px 0 6px 2px",
                            opacity: 0.7,
                          }}
                        >
                          {prefix}
                        </div>

                        {items.map((group) => (
                          <label key={group.id} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.has(group.id)}
                              onClick={(e) => handleCheckboxClick(group.id, e)}
                              readOnly
                              style={{ marginRight: "6px" }}
                            />
                            {group.name}
                          </label>
                        ))}
                      </div>,
                    );
                  });

                  // Render ungrouped ("Other")
                  if (ungrouped.length > 0) {
                    output.push(
                      <div key="other" style={{ marginBottom: "14px" }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "13px",
                            margin: "6px 0 6px 2px",
                            opacity: 0.7,
                          }}
                        >
                          Other
                        </div>

                        {ungrouped.map((group) => (
                          <label key={group.id} className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={selectedGroupIds.has(group.id)}
                              onClick={(e) => handleCheckboxClick(group.id, e)}
                              readOnly
                              style={{ marginRight: "6px" }}
                            />
                            {group.name}
                          </label>
                        ))}
                      </div>,
                    );
                  }

                  return output;
                })()}
              </div>

              {/* Group Types */}
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ marginBottom: "8px" }}>Group Types</h3>
                <div className="row mb-8">
                  <button
                    className="framer-button-secondary"
                    style={{ flex: 1 }}
                    onClick={() =>
                      setSelectedGroupTypes(
                        new Set([
                          "page",
                          "settings",
                          "component",
                          "collection",
                          "collection-item",
                          "template",
                        ]),
                      )
                    }
                  >
                    Select All
                  </button>
                  <button
                    className="framer-button-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedGroupTypes(new Set())}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                  {[
                    "page",
                    "settings",
                    "component",
                    "collection",
                    "collection-item",
                    "template",
                  ].map((type) => (
                    <label key={type} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedGroupTypes.has(type)}
                        onChange={() => {
                          const next = new Set(selectedGroupTypes);
                          if (next.has(type)) {
                            next.delete(type);
                          } else {
                            next.add(type);
                          }
                          setSelectedGroupTypes(next);
                        }}
                        style={{ marginRight: "6px" }}
                      />
                      <span style={{ textTransform: "capitalize" }}>
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <h3 style={{ marginBottom: "8px" }}>Languages</h3>
                <div className="row mb-8">
                  <button
                    className="framer-button-secondary"
                    style={{ flex: 1 }}
                    onClick={() =>
                      setSelectedLocaleCodes(
                        new Set(localesRef.current.map((l) => l.code)),
                      )
                    }
                  >
                    Select All Languages
                  </button>
                  <button
                    className="framer-button-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedLocaleCodes(new Set())}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ maxHeight: "360px", overflowY: "auto" }}>
                  {localesRef.current.map((locale) => (
                    <label key={locale.code} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedLocaleCodes.has(locale.code)}
                        onChange={() => {
                          const next = new Set(selectedLocaleCodes);
                          if (next.has(locale.code)) {
                            next.delete(locale.code);
                          } else {
                            next.add(locale.code);
                          }
                          setSelectedLocaleCodes(next);
                        }}
                        style={{ marginRight: "6px" }}
                      />
                      {locale.code}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* RIGHT PANEL — ACTIONS */}
        <section className="panel">
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>Actions</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              padding: "4px 0",
            }}
          >
            {/* Export Excel */}
            <button
              className="framer-button-primary"
              onClick={handleExport}
              disabled={actionsDisabled}
            >
              {isExporting ? "Exporting…" : "Export to Excel"}
            </button>

            {/* Export XLIFF */}
            <button
              className="framer-button-primary"
              onClick={handleExportXLIFF}
              disabled={actionsDisabled}
            >
              Export XLIFF 1.2
            </button>

            {/* Import Excel */}
            <button
              className="framer-button-secondary"
              onClick={handleImportFileClick}
              disabled={actionsDisabled}
            >
              {isImporting ? "Importing…" : "Import from Excel"}
            </button>

            {/* Import XLIFF */}
            <button
              className="framer-button-secondary"
              onClick={handleImportXLIFFClick}
              disabled={actionsDisabled}
            >
              Import XLIFF 1.2
            </button>
          </div>

          {/* Fully invisible file inputs */}
          <input
            type="file"
            accept=".xlsx"
            ref={fileInputRef}
            onChange={handleImportFile}
            style={{ display: "none" }}
          />
          <input
            type="file"
            accept=".xlf,.xliff"
            ref={xlfInputRef}
            onChange={handleImportXLIFF}
            style={{ display: "none" }}
          />

          <p
            style={{
              marginTop: "24px",
              color: "var(--framer-color-text-secondary)",
            }}
          >
            {statusMessage}
          </p>
        </section>
      </div>
    </div>
  );
}
