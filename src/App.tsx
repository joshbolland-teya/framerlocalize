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
  width: 900,
  height: 600,
  resizable: true,
});

type NotificationVariant = "info" | "success" | "warning" | "error";

// Row structure for Excel export/import
type ExportRow = {
  sourceId: LocalizationSourceId;
  groupId: string;
  groupName: string;
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
    isLocalizationMode ? "Idle" : localizationModeHint
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
        g.sources.forEach((s) => existingSources.set(s.id, s))
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
          "error"
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

      for (const unit of units) {
        const id =
          unit.getAttribute("id") || unit.getAttribute("resname") || null;

        if (!id) continue;
        if (!existingSources.has(id)) continue;

        let targetNode: Element | null = null;

        if (xliffNS) {
          const t = unit.getElementsByTagNameNS(xliffNS, "target");
          targetNode = t.length > 0 ? t[0] : null;
        } else {
          const t = unit.getElementsByTagName("target");
          targetNode = t.length > 0 ? t[0] : null;
        }

        if (!targetNode) continue;

        const rawValue = targetNode.textContent || "";
        const value = rawValue.trim();

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
    new Set()
  );
  const [pageSearch, setPageSearch] = useState("");
  const [selectedLocaleCodes, setSelectedLocaleCodes] = useState<Set<string>>(
    new Set()
  );

  const groupsRef = useRef<readonly LocalizationGroup[]>([]);
  const localesRef = useRef<readonly Locale[]>([]);

  const [isLoadingFilters, setIsLoadingFilters] = useState(true);

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
      groupsRef.current = [...groups];
      localesRef.current = [...locales];

      const localeCols = locales
        .filter(
          (l) =>
            selectedLocaleCodes.size === 0 || selectedLocaleCodes.has(l.code)
        )
        .map((l) => ({
          id: l.id,
          code: l.code,
        }));

      const rows: ExportRow[] = [];

      const filteredGroups = groups.filter((g) => {
        if (selectedGroupIds.size === 0) return true;
        return selectedGroupIds.has(g.id);
      });
      filteredGroups.forEach((group) => {
        // Skip entire group if group name is too long
        if (group.name.length > 32767) {
          console.warn(
            `Skipping group ${group.id} because groupName length ${group.name.length} > 32767`
          );
          return;
        }
        group.sources.forEach((source) => {
          const baseValue = source.value ?? "";

          // ❌ Skip if base value too long
          if (baseValue.length > 32767) {
            console.warn(
              `Skipping sourceId ${source.id}: baseValue length ${baseValue.length} > 32767`
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
                `Skipping sourceId ${source.id}, locale ${locale.code}: value too long (${localized.length})`
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
            baseValue,
            ...localizedMap,
          };

          rows.push(row);
        });
      });

      setStatusMessage("Building Excel file…");

      const headerRow = [
        "sourceId",
        "groupId",
        "groupName",
        "baseValue",
        ...localeCols.map((l) => l.code),
      ];

      const aoaData = [
        headerRow,
        ...rows.map((r) => [
          r.sourceId,
          r.groupId,
          r.groupName,
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

      // Filter groups + languages based on user selection
      const filteredGroups = groups.filter((g) => {
        if (selectedGroupIds.size === 0) return true;
        return selectedGroupIds.has(g.id);
      });

      const selectedLocales = locales.filter(
        (l) => selectedLocaleCodes.size === 0 || selectedLocaleCodes.has(l.code)
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
          group.sources.forEach((source) => {
            const baseValue = source.value ?? "";
            const safeBase = baseValue
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;");

            const translated = source.valueByLocale?.[locale.id]?.value ?? "";
            const safeTranslated = translated
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;");

            xml += `      <trans-unit id="${source.id}" xml:space="preserve">\n`;
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

      const zip = new JSZip();

      for (const locale of selectedLocales) {
        const targetLang = locale.code;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2">\n`;
        xml += `  <file source-language="en-GB" target-language="${targetLang}" datatype="plaintext" original="group-export">\n`;
        xml += `    <body>\n`;

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

            xml += `      <trans-unit id="${source.id}" xml:space="preserve">\n`;
            xml += `        <source>${safeBase}</source>\n`;
            xml += `        <target>${safeTranslated}</target>\n`;
            xml += `      </trans-unit>\n`;
          });
        });

        xml += `    </body>\n  </file>\n</xliff>`;

        const safeGroupNames = filteredGroups
          .map((g) => g.name)
          .join("_")
          .replace(/[^a-zA-Z0-9_-]/g, "-");

        const filename = `framer-${safeGroupNames}-${targetLang}.xlf`;

        // Add file as UTF‑8 text
        zip.file(filename, xml);
      }

      // Generate ZIP as ArrayBuffer (more reliable inside Framer plugin)
      const zipArray = await zip.generateAsync({
        type: "arraybuffer",
        compression: "DEFLATE",
      });

      const zipBlob = new Blob([zipArray], { type: "application/zip" });

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
              `Skipping sourceId ${sourceId}: existing baseValue too long`
            );
            continue;
          }
          const hasOversized = locales.some((l) => {
            const val = existing.valueByLocale?.[l.id]?.value ?? "";
            return val.length > 32767;
          });
          if (hasOversized) {
            console.warn(
              `Skipping sourceId ${sourceId}: existing localized value too long`
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
              `❌ VALUE TOO LARGE for sourceId ${sourceId}, locale ${key}, length=${text.length}`
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
    <div
      style={{
        padding: "20px",
        background: "var(--framer-color-bg)",
        color: "var(--framer-color-text-primary)",
        height: "100%",
        overflowY: "auto",
      }}
    >
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
        }}
      >
        {/* LEFT PANEL — FILTERS */}
        <aside
          style={{
            background: "var(--framer-color-bg-subtle)",
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid var(--framer-color-border)",
            height: "fit-content",
          }}
        >
          <h2 style={{ fontSize: "16px", marginBottom: "12px" }}>Filters</h2>

          {isLoadingFilters && <p>Loading…</p>}

          {!isLoadingFilters && (
            <>
              {/* Pages */}
              <div style={{ marginBottom: "16px" }}>
                <div
                  style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
                >
                  <button
                    className="framer-button-secondary"
                    style={{ flex: 1 }}
                    onClick={() =>
                      setSelectedGroupIds(
                        new Set(groupsRef.current.map((g) => g.id))
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

                <h3 style={{ marginBottom: "8px" }}>Pages</h3>
                <input
                  type="text"
                  placeholder="Search pages…"
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid var(--framer-color-border)",
                    marginBottom: "10px",
                  }}
                  onChange={(e) => setPageSearch(e.target.value)}
                />

                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {[...groupsRef.current]
                    .filter((g) => {
                      if (!pageSearch.trim()) return true; // show all when search is empty
                      const query = pageSearch.trim().toLowerCase();
                      return g.name.toLowerCase().includes(query);
                    })
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((group) => (
                      <label
                        key={group.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          marginBottom: "6px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.has(group.id)}
                          onChange={() => {
                            const next = new Set(selectedGroupIds);
                            if (next.has(group.id)) {
                              next.delete(group.id);
                            } else {
                              next.add(group.id);
                            }
                            setSelectedGroupIds(next);
                          }}
                          style={{ marginRight: "6px" }}
                        />
                        {group.name}
                      </label>
                    ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <h3 style={{ marginBottom: "8px" }}>Languages</h3>
                <div
                  style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
                >
                  <button
                    className="framer-button-secondary"
                    style={{ flex: 1 }}
                    onClick={() =>
                      setSelectedLocaleCodes(
                        new Set(localesRef.current.map((l) => l.code))
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
                <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                  {localesRef.current.map((locale) => (
                    <label
                      key={locale.code}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        marginBottom: "6px",
                      }}
                    >
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
        <section>
          <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>Actions</h2>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <button
              className="framer-button-primary"
              onClick={handleExport}
              disabled={actionsDisabled}
              style={{ padding: "14px", background: "#6B4EFF" }}
            >
              {isExporting ? "Exporting…" : "Export to Excel"}
            </button>

            <button
              className="framer-button-primary"
              onClick={handleExportXLIFF}
              disabled={actionsDisabled}
              style={{
                padding: "14px",
                background: "#6B4EFF",
              }}
            >
              Export XLIFF 1.2
            </button>

            <button
              className="framer-button-secondary"
              onClick={handleImportFileClick}
              disabled={actionsDisabled}
              style={{ padding: "14px" }}
            >
              {isImporting ? "Importing…" : "Import from Excel"}
            </button>

            <button
              className="framer-button-secondary"
              onClick={handleImportXLIFFClick}
              disabled={actionsDisabled}
              style={{ padding: "14px" }}
            >
              Import XLIFF 1.2
            </button>
          </div>

          {/* hidden inputs */}
          <input
            type="file"
            accept=".xlsx"
            hidden
            ref={fileInputRef}
            onChange={handleImportFile}
          />
          <input
            type="file"
            accept=".xlf,.xliff"
            hidden
            ref={xlfInputRef}
            onChange={handleImportXLIFF}
          />

          <p
            style={{
              marginTop: "20px",
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
