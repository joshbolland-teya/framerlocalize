import { framer } from "framer-plugin";
import { FilterProvider } from "./context/FilterContext";
import { useFramerData } from "./hooks/useFramerData";
import { isLocalizationMode } from "./utils/validation";
import { UI_CONFIG } from "./constants";
import { AppShell } from "./components/layout/AppShell";
import { TwoColumnLayout } from "./components/layout/TwoColumnLayout";
import { ModeWarning } from "./components/layout/ModeWarning";
import { FiltersPanel } from "./components/filters/FiltersPanel";
import { PageFilter } from "./components/filters/PageFilter";
import { GroupTypeFilter } from "./components/filters/GroupTypeFilter";
import { LanguageFilter } from "./components/filters/LanguageFilter";
import { ActionsPanel } from "./components/actions/ActionsPanel";
import "./styles/global.css";

framer.showUI(UI_CONFIG);

function AppContent() {
  const { groups, locales, isLoading } = useFramerData();
  const showModeWarning = !isLocalizationMode();

  return (
    <AppShell>
      {showModeWarning && <ModeWarning />}
      
      <TwoColumnLayout
        left={
          <FiltersPanel isLoading={isLoading}>
            <PageFilter groups={groups} />
            <GroupTypeFilter />
            <LanguageFilter locales={locales} />
          </FiltersPanel>
        }
        right={<ActionsPanel groups={groups} locales={locales} />}
      />
    </AppShell>
  );
}

export function App() {
  return (
    <FilterProvider>
      <AppContent />
    </FilterProvider>
  );
}
