import {
  Alert,
  AlertColor,
  Snackbar,
  Stack,
} from "@mui/material";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "success" | "error" | "info" | "warning";

interface ToastState {
  open: boolean;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const SEVERITY: Record<ToastKind, AlertColor> = {
  success: "success",
  error: "error",
  info: "info",
  warning: "warning",
};

/**
 * Single app-wide toast surface.
 *
 * GraphQL failures arrive as `Error` instances with the server's message
 * attached, so the same helper is used for both local validation messages and
 * rejected mutations without the caller having to unwrap anything.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    kind: "info",
  });

  const notify = useCallback((kind: ToastKind, message: string) => {
    setToast({ open: true, message, kind });
  }, []);

  const handleClose = useCallback(() => {
    setToast((current) => ({ ...current, open: false }));
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Stack
        spacing={1}
        sx={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: (t) => t.zIndex.snackbar + 10,
          minWidth: { xs: 280, sm: 360 },
        }}
      >
        <Snackbar
          open={toast.open}
          autoHideDuration={toast.kind === "error" ? 8000 : 4000}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={handleClose}
            severity={SEVERITY[toast.kind]}
            variant="filled"
            sx={{ borderRadius: 2, boxShadow: 4 }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Stack>
    </ToastContext.Provider>
  );
}

export function useSnackbar(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useSnackbar must be used inside <ToastProvider>");
  }
  return context;
}

/**
 * Normalises whatever `catch` gave us into a sentence worth showing a user.
 * Apollo prefixes some errors with the operation name, which reads badly in a
 * toast, so it is stripped when present.
 */
export function readableError(caught: unknown, fallback: string): string {
  if (!caught) return fallback;
  if (Array.isArray(caught)) {
    const messages = caught
      .map((entry) => (entry instanceof Error ? entry.message : String(entry)))
      .filter(Boolean);
    return messages.length ? messages.join(". ") : fallback;
  }
  if (caught instanceof Error) {
    return (
      caught.message
        .replace(/^GraphQL error:\s*/i, "")
        .replace(/^[A-Za-z]+:\s*/, "") || fallback
    );
  }
  return typeof caught === "string" ? caught : fallback;
}
