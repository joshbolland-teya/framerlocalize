import { useState, ChangeEvent } from "react";
import { LocalizationGroup, Locale } from "framer-plugin";
import { useFilters } from "../../hooks/useFilters";
import { useFileInput } from "../../hooks/useFileInput";
import { exportToExcel, exportToXliff } from "../../services/exportService";
import { importFromExcel, importFromXliff } from "../../services/importService";
import { setLocalizationData } from "../../services/framerApi";
import { notify } from "../../utils/notifications";
import {
  isLocalizationMode,
  getLocalizationModeHint,
} from "../../utils/validation";
import { Button } from "../shared/Button";
import { FileInput } from "../shared/FileInput";
import styles from "./ActionsPanel.module.css";

interface ActionsPanelProps {
  groups: readonly LocalizationGroup[];
  locales: readonly Locale[];
}

export function ActionsPanel({ groups, locales }: ActionsPanelProps) {
  const { selectedGroupIds, selectedLocaleCodes, selectedGroupTypes } =
    useFilters();
  const [statusMessage, setStatusMessage] = useState(
    isLocalizationMode() ? "Idle" : getLocalizationModeHint(),
  );
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const {
    fileInputRef,
    xlfInputRef,
    triggerExcelImport,
    triggerXliffImport,
    handleFileChange,
  } = useFileInput();

  const actionsDisabled = isExporting || isImporting || !isLocalizationMode();

  const handleExportExcel = async () => {
    if (!isLocalizationMode()) {
      setStatusMessage(getLocalizationModeHint());
      notify("Open the Localizations panel first.", "warning");
      return;
    }

    try {
      setIsExporting(true);
      setStatusMessage("Collecting localization data…");

      await exportToExcel({
        groups,
        locales,
        selectedGroupIds,
        selectedLocaleCodes,
        selectedGroupTypes,
      });

      setStatusMessage("Export complete.");
      notify("Excel export generated.", "success");
    } catch (err) {
      notify((err as Error).message || "Export failed", "error");
      setStatusMessage("Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXliff = async () => {
    if (!isLocalizationMode()) {
      setStatusMessage(getLocalizationModeHint());
      notify("Open the Localizations panel first.", "warning");
      return;
    }

    try {
      setIsExporting(true);
      setStatusMessage("Collecting localization data…");

      await exportToXliff({
        groups,
        locales,
        selectedGroupIds,
        selectedLocaleCodes,
        selectedGroupTypes,
      });

      setStatusMessage("XLIFF export complete.");
      notify("XLIFF 1.2 file generated.", "success");
    } catch (err) {
      notify((err as Error).message || "XLIFF export failed.", "error");
      setStatusMessage("XLIFF export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportExcel = async (file: File) => {
    if (!isLocalizationMode()) {
      setStatusMessage(getLocalizationModeHint());
      return;
    }

    setIsImporting(true);
    setStatusMessage("Reading Excel file…");

    try {
      const valuesBySource = await importFromExcel(file, locales);

      setStatusMessage("Applying translations to Framer…");
      await setLocalizationData({ valuesBySource });

      setStatusMessage("Import complete.");
      notify("Translations updated from Excel.", "success");
    } catch (err) {
      notify((err as Error).message || "Import failed.", "error");
      setStatusMessage("Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportXliff = async (file: File) => {
    if (!isLocalizationMode()) {
      setStatusMessage(getLocalizationModeHint());
      return;
    }

    setIsImporting(true);
    setStatusMessage("Reading XLIFF…");

    try {
      const valuesBySource = await importFromXliff(file, locales, groups);

      setStatusMessage("Applying translations to Framer…");
      await setLocalizationData({ valuesBySource });

      setStatusMessage("XLIFF import complete.");
      notify("Translations updated from XLIFF.", "success");
    } catch (err) {
      notify((err as Error).message || "XLIFF import failed.", "error");
      setStatusMessage("XLIFF import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Actions</h2>

      <div className={styles.grid}>
        <Button onClick={handleExportExcel} disabled={actionsDisabled}>
          {isExporting ? "Exporting…" : "Export to Excel"}
        </Button>

        <Button onClick={handleExportXliff} disabled={actionsDisabled}>
          Export XLIFF 1.2
        </Button>

        <Button
          variant="secondary"
          onClick={triggerExcelImport}
          disabled={actionsDisabled}
        >
          {isImporting ? "Importing…" : "Import from Excel"}
        </Button>

        <Button
          variant="secondary"
          onClick={triggerXliffImport}
          disabled={actionsDisabled}
        >
          Import XLIFF 1.2
        </Button>
      </div>

      <div style={{ display: "none" }}>
        <FileInput
          ref={fileInputRef}
          accept=".xlsx"
          onChange={(evt: ChangeEvent<HTMLInputElement>) =>
            handleFileChange(evt, handleImportExcel)
          }
        />
        <FileInput
          ref={xlfInputRef}
          accept=".xlf,.xliff"
          onChange={(evt: ChangeEvent<HTMLInputElement>) =>
            handleFileChange(evt, handleImportXliff)
          }
        />
      </div>

      <p className={styles.status}>{statusMessage}</p>
    </section>
  );
}
