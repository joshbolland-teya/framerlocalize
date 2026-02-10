import { useState, useEffect, useRef } from "react";
import { LocalizationGroup, Locale } from "framer-plugin";
import { getLocales, getLocalizationGroups } from "../services/framerApi";
import { isLocalizationMode } from "../utils/validation";

export function useFramerData() {
  const [isLoading, setIsLoading] = useState(true);
  const groupsRef = useRef<readonly LocalizationGroup[]>([]);
  const localesRef = useRef<readonly Locale[]>([]);

  useEffect(() => {
    if (!isLocalizationMode()) return;

    (async () => {
      const [locs, grps] = await Promise.all([
        getLocales(),
        getLocalizationGroups(),
      ]);
      groupsRef.current = [...grps];
      localesRef.current = [...locs];
      setIsLoading(false);
    })();
  }, []);

  return {
    groups: groupsRef.current,
    locales: localesRef.current,
    isLoading,
  };
}
