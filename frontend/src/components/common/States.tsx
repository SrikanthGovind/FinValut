import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import type { ReactNode } from "react";

import { readableError } from "./ToastProvider";

/** Full-width spinner block, used while a page's primary query is in flight. */
export function LoadingState({
  label = "Loading…",
  minHeight = 240,
}: {
  label?: string;
  minHeight?: number;
}) {
  return (
    <Stack
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      sx={{ minHeight, py: 6 }}
    >
      <CircularProgress size={30} thickness={4} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

/**
 * Rendered when a query fails. The server's own message is preferred over a
 * generic apology, because GraphQL here throws plain `Error`s whose text is
 * the actionable part ("Account must have a zero balance before closing").
 */
export function ErrorState({
  error,
  onRetry,
  title = "Something went wrong",
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}) {
  const message = readableError(error, "The request could not be completed.");

  if (compact) {
    return (
      <Alert
        severity="error"
        variant="outlined"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      >
        {message}
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent sx={{ py: 5 }}>
        <Stack spacing={1.5} alignItems="center" sx={{ textAlign: "center" }}>
          <ErrorOutlineIcon color="error" sx={{ fontSize: 36 }} />
          <Typography variant="h4">{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }}>
            {message}
          </Typography>
          {onRetry && (
            <Button variant="outlined" onClick={onRetry} sx={{ mt: 1 }}>
              Try again
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  message,
  action,
  icon,
}: {
  title?: string;
  message?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Stack
      spacing={1.25}
      alignItems="center"
      sx={{ py: 5, px: 2, textAlign: "center" }}
    >
      <Box sx={{ color: "text.disabled" }}>
        {icon ?? <InboxOutlinedIcon sx={{ fontSize: 36 }} />}
      </Box>
      <Typography variant="subtitle1">{title}</Typography>
      {message && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460 }}>
          {message}
        </Typography>
      )}
      {action}
    </Stack>
  );
}

export function InlineError({ error, fallback }: { error: unknown; fallback?: string }) {
  if (!error) return null;
  return (
    <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
      <AlertTitle sx={{ mb: 0.25, fontSize: "0.82rem" }}>Request failed</AlertTitle>
      {readableError(error, fallback ?? "Unknown error")}
    </Alert>
  );
}
