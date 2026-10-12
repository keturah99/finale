import { createTheme, type Theme } from '@mui/material/styles'

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const FONT_FAMILY = [
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
].join(',')

const sharedComponents = {
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
  },
  MuiTextField: { defaultProps: { size: 'small' as const } },
  MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
}

// ---------------------------------------------------------------------------
// Light theme
// ---------------------------------------------------------------------------

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1a3a6c',
      light: '#3f5f8f',
      dark: '#0f2548',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    divider: '#e2e8f0',
  },
  typography: { fontFamily: FONT_FAMILY, fontSize: 14 },
  shape: { borderRadius: 6 },
  components: sharedComponents,
})

// ---------------------------------------------------------------------------
// Dark theme
// ---------------------------------------------------------------------------

export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4a7fc1',
      light: '#6f9fd4',
      dark: '#1a3a6c',
      contrastText: '#ffffff',
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
    divider: '#334155',
  },
  typography: { fontFamily: FONT_FAMILY, fontSize: 14 },
  shape: { borderRadius: 6 },
  components: sharedComponents,
})

/** @deprecated use lightTheme or darkTheme via useTheme */
export const muiTheme = lightTheme