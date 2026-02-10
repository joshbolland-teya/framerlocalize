import {
  framer,
  LocalizationGroup,
  Locale,
  LocalizationSourceUpdate,
  LocalizationSourceId,
} from "framer-plugin";

export async function getLocales(): Promise<readonly Locale[]> {
  return await framer.getLocales();
}

export async function getLocalizationGroups(): Promise<
  readonly LocalizationGroup[]
> {
  return await framer.getLocalizationGroups();
}

export async function setLocalizationData(data: {
  valuesBySource: Record<LocalizationSourceId, LocalizationSourceUpdate>;
}): Promise<void> {
  await framer.setLocalizationData(data);
}
