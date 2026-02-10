import {
  LocalizationSourceId,
  LocalizationSourceUpdate,
  LocalizationSource,
  Locale,
} from "framer-plugin";
import { stripFormattedTextWrapper } from "./sanitization";

export interface XliffParseResult {
  valuesBySource: Record<LocalizationSourceId, LocalizationSourceUpdate>;
  targetLocaleId: string;
}

export function parseXliff(
  xmlText: string,
  locales: readonly Locale[],
  existingSources: Map<string, LocalizationSource>,
): XliffParseResult | { error: string } {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");

  const xliffNS = xml.documentElement.namespaceURI || null;

  const units = xliffNS
    ? Array.from(xml.getElementsByTagNameNS(xliffNS, "trans-unit"))
    : Array.from(xml.getElementsByTagName("trans-unit"));

  const fileTag = xml.getElementsByTagName("file")[0];
  const targetLangRaw = fileTag?.getAttribute("target-language")?.trim() || "";

  const targetLocaleObj =
    locales.find((l) => l.code === targetLangRaw) ||
    locales.find((l) => targetLangRaw.startsWith(l.code)) ||
    null;

  if (!targetLocaleObj) {
    return {
      error: `Could not map locale "${targetLangRaw}" to any Framer locale`,
    };
  }

  const targetLocaleId = targetLocaleObj.id;
  const valuesBySource: Record<LocalizationSourceId, LocalizationSourceUpdate> =
    {};

  console.log("Processing", units.length, "trans-units from XLF");

  for (const unit of units) {
    const id = unit.getAttribute("id") || unit.getAttribute("resname") || null;

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

    let value: string;
    if (targetNode.children.length > 0) {
      value = targetNode.innerHTML.trim();
      console.log(
        "Using innerHTML (has children):",
        id,
        value.substring(0, 50),
      );
    } else {
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

    if (existingSource.type === "formattedText" && value.includes("<")) {
      const originalValue = value;
      value = stripFormattedTextWrapper(value);

      console.log(
        "Stripped HTML for formattedText:",
        id,
        "\nBefore:",
        originalValue.substring(0, 100),
        "\nAfter:",
        value.substring(0, 100),
      );
    }

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

  return { valuesBySource, targetLocaleId };
}
