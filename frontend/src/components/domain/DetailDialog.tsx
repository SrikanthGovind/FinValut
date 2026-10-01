import type { ReactNode } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";

interface DetailDialogProps {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg";
}

/** Shared frame for the read-only drill-downs: accounts, transactions, audit entries. */
export function DetailDialog({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "sm",
}: DetailDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {/* component="div": DialogTitle already renders an <h2>, so a nested
            <h3> is invalid DOM nesting. The size comes from the variant. */}
        <Typography variant="h3" component="div">
          {title}
        </Typography>
        {subtitle && (
          <Box sx={{ mt: 0.5 }}>
            {subtitle}
          </Box>
        )}
      </DialogTitle>
      <IconButton
        onClick={onClose}
        aria-label="Close"
        sx={{ position: "absolute", right: 12, top: 12, color: "text.secondary" }}
      >
        <CloseRounded fontSize="small" />
      </IconButton>
      <Divider />
      <DialogContent sx={{ py: 2.5 }}>{children}</DialogContent>
    </Dialog>
  );
}

/** One label/value line. Dotted leaders keep long values from drifting. */
export function DetailRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="baseline"
      sx={{ py: 0.75, borderBottom: "1px dashed", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minWidth: 148, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          wordBreak: "break-word",
          ...(mono ? { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.8rem" } : {}),
        }}
      >
        {children ?? "—"}
      </Typography>
    </Stack>
  );
}

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2.5, "&:last-of-type": { mb: 0 } }}>
      <Typography
        variant="caption"
        sx={{ display: "block", mb: 1, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        {title}
      </Typography>
      <Box>{children}</Box>
    </Box>
  );
}

export default DetailDialog;
