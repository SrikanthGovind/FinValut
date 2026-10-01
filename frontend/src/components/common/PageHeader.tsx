import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Buttons, filters or a summary line, right-aligned on wide screens. */
  actions?: ReactNode;
  /** Small print under the description, e.g. a read-only notice. */
  note?: ReactNode;
}

/**
 * Title block for every page. Kept separate from the layout so a page owns its
 * own heading and the shell stays concerned only with chrome.
 */
export function PageHeader({
  title,
  description,
  actions,
  note,
}: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", md: "center" }}
      sx={{ mb: 2.5 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}
        {note && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
            {note}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexShrink: 0, flexWrap: "wrap", rowGap: 1 }}
        >
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

export default PageHeader;
