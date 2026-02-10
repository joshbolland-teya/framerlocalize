import { framer } from "framer-plugin";

export function isLocalizationMode(): boolean {
  return framer.mode === "localization";
}

export function getLocalizationModeHint(): string {
  return "Open this plugin from the Localizations panel to sync translations.";
}

export function validateCellSize(
  text: string,
  maxLength: number = 32767,
): boolean {
  return text.length <= maxLength;
}
