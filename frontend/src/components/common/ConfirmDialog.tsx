import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Box,
} from "@mui/material";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** The consequence, stated plainly. Never just "Are you sure?". */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "error" | "warning";
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Confirmation for irreversible or privileged actions: freezing, closing,
 * reversing, rejecting, changing a role.
 *
 * `pending` disables both buttons while the mutation runs, so a double click
 * cannot fire the same reversal twice — the server locks the row, but the
 * second attempt would surface as a confusing error toast.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="confirm-dialog-title"
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div" variant="body2">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={pending} color="inherit">
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={pending}
          color={tone === "primary" ? "primary" : "error"}
          variant="contained"
          startIcon={pending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {pending ? "Working…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;

/** Compact "read only" banner for roles that hold no write capability. */
export function ReadOnlyBanner({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        mb: 2,
        px: 2,
        py: 1.25,
        borderRadius: 2,
        bgcolor: "#FDF3E3",
        border: "1px solid #F2DDB8",
        color: "#8A5200",
        fontSize: "0.8rem",
      }}
    >
      {children}
    </Box>
  );
}
