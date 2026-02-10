# Framer Localization Sync

A Framer plugin for exporting and importing translations between Framer projects and external translation workflows. Supports both Excel (.xlsx) and XLIFF 1.2 formats with advanced filtering and batch operations.

## Features

### Export Formats

**Excel Export**

- One row per translation source with columns for source ID, group metadata, base value, and all locale translations
- Handles Excel's 32,767 character cell limit with validation and warnings
- Filter by pages, group types, and languages before export
- Timestamped filenames for version tracking

**XLIFF 1.2 Export**

- Industry-standard translation format compatible with professional translation tools
- Single-file export for one language or ZIP archive for multiple languages
- Preserves source/target pairs with metadata (group type, source type)
- XML escaping for special characters

### Import Formats

**Excel Import**

- Update translations from Excel files with automatic locale mapping
- Validates cell sizes before import to prevent data loss
- Clear or set values per locale with action-based updates

**XLIFF Import**

- Parse XLIFF 1.2 files with namespace support
- Handles both escaped and unescaped HTML in translation strings
- Strips formatting wrappers for formattedText fields while preserving content
- Maps target language codes to Framer locales automatically

### Advanced Filtering

**Page Selection**

- Hierarchical grouping by "/" or ">" separators
- Search functionality with sticky header
- Shift-click for range selection
- Select all / clear all batch operations

**Group Type Filtering**

- Filter by page, settings, component, collection, collection-item, or template
- Toggle individual types or use batch select/clear

**Language Selection**

- Multi-select languages for export/import
- All languages or specific locales
- Batch selection controls

### User Experience

- Mode validation requiring plugin to be opened from Framer's Localization panel
- Real-time status messages during operations
- Success/error notifications with contextual information
- Disabled states during export/import to prevent conflicts
- Light and dark mode support

## Architecture

The application follows a clean architecture pattern with strict separation of concerns:

### Directory Structure

```
src/
├── components/           # React components with CSS modules
│   ├── actions/         # Export/import action buttons
│   │   ├── ActionsPanel.tsx
│   │   └── ActionsPanel.module.css
│   ├── filters/         # Filter UI components
│   │   ├── FiltersPanel.tsx
│   │   ├── PageFilter.tsx
│   │   ├── GroupTypeFilter.tsx
│   │   ├── LanguageFilter.tsx
│   │   └── *.module.css
│   ├── layout/          # Layout and structure
│   │   ├── AppShell.tsx
│   │   ├── TwoColumnLayout.tsx
│   │   ├── ModeWarning.tsx
│   │   └── *.module.css
│   └── shared/          # Reusable UI primitives
│       ├── Button.tsx
│       ├── CheckboxRow.tsx
│       ├── FileInput.tsx
│       ├── SearchInput.tsx
│       └── *.module.css
├── context/             # React Context API
│   └── FilterContext.tsx    # Global filter state management
├── hooks/               # Custom React hooks
│   ├── useFramerData.ts     # Load locales and groups
│   ├── usePageGrouping.ts   # Hierarchical page grouping
│   ├── useShiftSelect.ts    # Multi-select with shift
│   └── useFileInput.ts      # File input handling
├── services/            # Business logic and API calls
│   ├── framerApi.ts         # Framer SDK wrapper
│   ├── exportService.ts     # Export orchestration
│   └── importService.ts     # Import orchestration
├── utils/               # Utility functions
│   ├── validation.ts        # Mode and size validation
│   ├── xliffParser.ts       # XLIFF XML parsing
│   ├── xliffBuilder.ts      # XLIFF XML generation
│   ├── excelUtils.ts        # Excel data transformation
│   ├── sanitization.ts      # HTML escaping/unescaping
│   ├── notifications.ts     # User notifications
│   └── fileDownload.ts      # File download helpers
├── types/               # TypeScript type definitions
│   ├── localization.types.ts
│   ├── filter.types.ts
│   └── index.ts
├── constants/           # Application constants
│   ├── groupTypes.ts
│   ├── xliffNamespaces.ts
│   ├── excelLimits.ts
│   ├── uiConfig.ts
│   └── index.ts
├── styles/              # Global styles
│   └── global.css
├── App.tsx              # Application coordinator (45 lines)
└── main.tsx             # Entry point
```

### Design Patterns

**Context API for State Management**

- FilterContext provides global filter state (pages, types, locales, search)
- Eliminates prop drilling through component hierarchy
- Single source of truth for user selections

**Custom Hooks for Logic Encapsulation**

- useFramerData: Data fetching from Framer API
- usePageGrouping: Complex grouping and search logic
- useShiftSelect: Range selection behavior
- useFileInput: File handling abstraction

**Service Layer for Business Logic**

- framerApi: Centralized SDK calls
- exportService: Export workflow orchestration
- importService: Import workflow orchestration
- Separation from UI components for testability

**Utility Modules**

- Pure functions for data transformation
- XLIFF parsing and building
- Excel data manipulation
- Validation and sanitization

**CSS Modules**

- Component-scoped styles
- No global CSS conflicts
- Co-located with components
- Theme variables for consistency

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Framer Desktop app

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the Vite development server with hot module replacement. The plugin will be available at https://localhost:5173 (HTTPS required by Framer).

### Building

```bash
npm run build
```

Outputs production-ready files to the `dist/` directory.

### Linting

```bash
npm run lint
```

Runs ESLint with TypeScript support to check code quality.

## Usage

### Opening the Plugin

1. Open your Framer project
2. Navigate to the Localizations panel
3. Click the plugins icon and select "Framer Localization Sync"
4. The plugin opens in the Framer sidebar

Note: The plugin must be opened from the Localizations panel to access locale data. Opening it from elsewhere will show a warning.

### Exporting Translations

**To Excel:**

1. Select pages, group types, and languages using the filters
2. Click "Export to Excel"
3. The file downloads automatically with a timestamped filename

**To XLIFF:**

1. Configure filters for the content you want to export
2. Click "Export XLIFF 1.2"
3. Single language: Downloads one .xlf file
4. Multiple languages: Downloads a .zip containing one .xlf per language

### Importing Translations

**From Excel:**

1. Click "Import from Excel"
2. Select your .xlsx file
3. The plugin validates and applies translations to Framer

**From XLIFF:**

1. Click "Import XLIFF 1.2"
2. Select your .xlf or .xliff file
3. The plugin parses the target language and updates translations

### Filtering

**Pages:**

- Type in the search box to filter by page name
- Click checkboxes to select individual pages
- Use shift-click to select ranges
- Pages are grouped by "/" or ">" prefixes

**Group Types:**

- Select which types of content to include
- page: Regular pages
- settings: Settings content
- component: Component overrides
- collection: Collection data
- collection-item: Collection item templates
- template: Page templates

**Languages:**

- Choose which locales to include in export/import
- Select all or specific languages
- Empty selection means all languages

## Technical Implementation

### Excel Cell Size Limits

Excel has a maximum cell size of 32,767 characters. The plugin:

- Validates all values before export
- Skips sources with values exceeding the limit
- Logs warnings to the console for skipped content
- Prevents import of oversized values

### XLIFF HTML Handling

Translation strings may contain HTML markup. The plugin:

- Escapes XML special characters (&, <, >) on export
- Handles both escaped and unescaped HTML on import
- Strips outer wrapper tags for formattedText fields
- Preserves inner content while removing formatting

### FormattedText Field Processing

Framer stores formattedText as plain text with separate formatting metadata. The plugin:

- Detects formattedText source types
- Strips HTML wrapper tags (h1, h2, p, etc.)
- Extracts inner text content
- Applies proper escaping for XLIFF export

### Hierarchical Page Grouping

Pages can be organized hierarchically:

- Slash separator: "Section / Page Name"
- Arrow separator: "Section > Page Name" or "Section › Page Name"
- Grouped pages appear under collapsible sections
- Ungrouped pages appear in "Other" section

### Shift-Click Multi-Select

Range selection for pages:

- Click first checkbox
- Shift-click last checkbox
- All checkboxes between are selected
- Works with grouped and ungrouped pages

### Mode Validation

The plugin requires localization mode:

- Checks framer.mode === "localization"
- Shows warning banner if opened elsewhere
- Disables all export/import actions
- Displays helpful hint message

## File Formats

### Excel Structure

```
sourceId | groupId | groupName | groupType | sourceType | baseValue | en | es | fr | ...
---------|---------|-----------|-----------|------------|-----------|----|----|----|-
abc123   | page_1  | Home      | page      | text       | Hello     | Hi | Hola | Bonjour
```

Columns:

- sourceId: Unique identifier for the translation source
- groupId: Parent group identifier
- groupName: Human-readable group name
- groupType: Type of group (page, component, etc.)
- sourceType: Type of source (text, formattedText, etc.)
- baseValue: Default/base language value
- Locale codes: One column per language (en, es, fr, etc.)

### XLIFF 1.2 Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file source-language="en-GB" target-language="es" datatype="plaintext" original="group-export">
    <body>
      <trans-unit id="source_id" resname="Page Name" extradata="groupType:page,sourceType:text" xml:space="preserve">
        <source>Hello</source>
        <target>Hola</target>
      </trans-unit>
    </body>
  </file>
</xliff>
```

Elements:

- trans-unit: One per translation source
- id: Source identifier
- resname: Group name for context
- extradata: Metadata about group and source types
- source: Base language text
- target: Translated text

## Contributing

This project uses:

- TypeScript for type safety
- React for UI components
- Vite for bundling
- ESLint for code quality
- CSS Modules for styling

Code organization principles:

- Single Responsibility: Each module has one clear purpose
- Separation of Concerns: UI, logic, and data are separated
- DRY: Shared logic in hooks and utilities
- Type Safety: Comprehensive TypeScript types
- Modularity: Small, composable components

## License

This plugin is provided as-is for use with Framer projects.
