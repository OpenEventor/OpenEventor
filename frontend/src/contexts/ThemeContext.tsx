/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
} from '@mui/material';
import type {} from '@mui/x-data-grid/themeAugmentation';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  compactView: boolean;
  setCompactView: (value: boolean) => void;
}

const STORAGE_KEY = 'openeventor_theme';
const HIGH_CONTRAST_KEY = 'openeventor_high_contrast';
const COMPACT_VIEW_KEY = 'openeventor_compact_view';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return ctx;
}

function getStoredMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function getStoredBool(key: string, defaultValue: boolean): boolean {
  const stored = localStorage.getItem(key);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return defaultValue;
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getStoredMode);
  const [highContrast, setHighContrastState] = useState(() => getStoredBool(HIGH_CONTRAST_KEY, false));
  const [compactView, setCompactViewState] = useState(() => getStoredBool(COMPACT_VIEW_KEY, false));
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const setMode = useCallback((newMode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, newMode);
    setModeState(newMode);
  }, []);

  const setHighContrast = useCallback((value: boolean) => {
    localStorage.setItem(HIGH_CONTRAST_KEY, String(value));
    setHighContrastState(value);
  }, []);

  const setCompactView = useCallback((value: boolean) => {
    localStorage.setItem(COMPACT_VIEW_KEY, String(value));
    setCompactViewState(value);
  }, []);

  const resolvedMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode;

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: { main: '#D87000' },
          ...(highContrast && {
            divider: resolvedMode === 'dark' ? '#FFFFFF' : '#000000',
          }),
          // background: resolvedMode === 'dark'
          //   ? { default: '#0C1116', paper: '#020408' }
          //   : { default: '#FFFFFF', paper: '#F7F8FA' },
        },
        ...(highContrast && {
          components: {
            MuiDataGrid: {
              styleOverrides: {
                root: {
                  '--DataGrid-t-color-border-base': `${resolvedMode === 'dark' ? '#FFFFFF' : '#000000'} !important`,
                },
              },
            },
          },
        }),
      }),
    [resolvedMode, highContrast],
  );

  const value: ThemeContextValue = { mode, setMode, highContrast, setHighContrast, compactView, setCompactView };

  return (
    <ThemeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
