import { alpha, createTheme } from "@mui/material/styles";

/**
 * FinVault design tokens.
 *
 * Enterprise banking: a deep navy rail, a white working surface, and one
 * restrained accent blue. Money movement is expressed with colour only in
 * green/red on amounts, and only once the direction is unambiguous.
 */
export const palette = {
  navy: {
    900: "#071B33",
    800: "#0B2545",
    700: "#123A63",
    600: "#1B4C7E",
  },
  brand: {
    main: "#0A4C92",
    light: "#2E6FB5",
    dark: "#063260",
    contrastText: "#FFFFFF",
  },
  success: "#0E7C66",
  warning: "#B26A00",
  danger: "#C0392B",
  surface: "#F4F7FB",
  border: "#E1E8F0",
  ink: {
    primary: "#16202E",
    secondary: "#5A6B7F",
  },
};

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: palette.brand.main,
      light: palette.brand.light,
      dark: palette.brand.dark,
      contrastText: palette.brand.contrastText,
    },
    secondary: { main: palette.success },
    success: { main: palette.success },
    warning: { main: palette.warning },
    error: { main: palette.danger },
    info: { main: palette.brand.main },
    background: { default: palette.surface, paper: "#FFFFFF" },
    text: { primary: palette.ink.primary, secondary: palette.ink.secondary },
    divider: palette.border,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily:
      '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif',
    h1: { fontSize: "1.9rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.015em" },
    h3: { fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em" },
    h4: { fontSize: "1.1rem", fontWeight: 700 },
    h5: { fontSize: "1rem", fontWeight: 700 },
    h6: { fontSize: "0.9rem", fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, fontSize: "0.82rem" },
    body1: { fontSize: "0.9rem" },
    body2: { fontSize: "0.84rem" },
    caption: { fontSize: "0.74rem", letterSpacing: "0.01em" },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        "*": { boxSizing: "border-box" },
        html: { WebkitFontSmoothing: "antialiased" },
        body: { margin: 0 },
        "::-webkit-scrollbar": { width: 10, height: 10 },
        "::-webkit-scrollbar-thumb": {
          background: "#C4D0DE",
          borderRadius: 8,
          border: "2px solid transparent",
          backgroundClip: "content-box",
        },
        "::-webkit-scrollbar-thumb:hover": { background: "#A9BACD" },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: palette.border },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${palette.border}`,
          borderRadius: 12,
          boxShadow:
            "0 1px 2px rgba(16, 32, 48, 0.04), 0 8px 24px rgba(16, 32, 48, 0.04)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, paddingInline: 16 },
        sizeSmall: { paddingInline: 12, fontSize: "0.8rem" },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8, backgroundColor: "#FFFFFF" },
        input: { paddingTop: 12, paddingBottom: 12 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.72rem", borderRadius: 6 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: palette.border, padding: "12px 16px" },
        head: {
          backgroundColor: "#F7FAFD",
          fontWeight: 700,
          fontSize: "0.72rem",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: palette.ink.secondary,
          whiteSpace: "nowrap",
        },
        body: { fontSize: "0.85rem" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": { borderBottom: 0 },
          "&.MuiTableRow-hover:hover": { backgroundColor: "#F7FAFD" },
        },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: {
        tooltip: { fontSize: "0.74rem", borderRadius: 6 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 14, border: `1px solid ${palette.border}` },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: palette.navy[800] } },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: "none", backgroundColor: "#FFFFFF" },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { height: 6, borderRadius: 6, backgroundColor: alpha(palette.brand.main, 0.12) },
        bar: { borderRadius: 6 },
      },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiTabs: { defaultProps: { variant: "scrollable", scrollButtons: false } },
  },
});

export default theme;
