import { LocalizationGroup, Locale } from "framer-plugin";
import { escapeXml } from "./sanitization";

export interface XliffBuildOptions {
  groups: readonly LocalizationGroup[];
  locale: Locale;
  sourceLang?: string;
}

export function buildXliff(options: XliffBuildOptions): string {
  const { groups, locale, sourceLang = "en-GB" } = options;
  const targetLang = locale.code;

  const xmlParts: string[] = [];
  xmlParts.push(
    `<?xml version="1.0" encoding="UTF-8"?>\n<xliff version="1.2">\n`,
  );
  xmlParts.push(
    `  <file source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext" original="group-export">\n`,
  );
  xmlParts.push(`    <body>\n`);

  groups.forEach((group) => {
    group.sources.forEach((source) => {
      const baseValue = source.value ?? "";
      const safeBase = escapeXml(baseValue);

      const translated = source.valueByLocale?.[locale.id]?.value ?? "";
      const safeTranslated = escapeXml(translated);

      xmlParts.push(
        `      <trans-unit id="${source.id}" resname="${group.name}" extradata="groupType:${group.type},sourceType:${source.type}" xml:space="preserve">\n`,
      );
      xmlParts.push(`        <source>${safeBase}</source>\n`);
      xmlParts.push(`        <target>${safeTranslated}</target>\n`);
      xmlParts.push(`      </trans-unit>\n`);
    });
  });

  xmlParts.push(`    </body>\n  </file>\n</xliff>`);
  return xmlParts.join("");
}

export function sanitizeFilename(
  name: string,
  maxLength: number = 150,
): string {
  let safe = name.replace(/[^a-zA-Z0-9_-]/g, "-");
  if (safe.length > maxLength) {
    safe = safe.substring(0, maxLength) + "-more";
  }
  return safe;
}
