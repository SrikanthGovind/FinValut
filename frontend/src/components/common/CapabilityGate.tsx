import type { ReactNode } from "react";
import { Alert, Box, Card, CardContent, Stack, Typography } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import SecurityOutlined from "@mui/icons-material/SecurityOutlined";

import { useAuth } from "../../auth/AuthContext";
import { CAPABILITY_DESCRIPTIONS, ROLE_CAPABILITIES, type Capability } from "../../rbac";
import { humanize } from "../../utils/format";

interface CapabilityGateProps {
  capability: Capability;
  /** What the viewer was trying to do, in their terms. */
  title: string;
  /** Why the data is unavailable: a missing capability, a design choice, etc. */
  explanation: string;
  /** The page's fallback path, e.g. an ID entry form that still works. */
  children?: ReactNode;
}

/**
 * Explains a refusal instead of showing an empty table.
 *
 * Several screens a role is expected to have are backed by queries the server
 * gates behind a capability that role does not hold. Rendering a blank table
 * there reads as "no data"; rendering an error reads as a bug. This states the
 * capability, what it would grant, and what to do instead, so the restriction is
 * visible rather than mysterious.
 *
 * It is a UI affordance only. The server is still the thing that refuses the
 * query, and this component never attempts it.
 */
export function CapabilityGate({
  capability,
  title,
  explanation,
  children,
}: CapabilityGateProps) {
  const { role } = useAuth();
  const held = ROLE_CAPABILITIES[role ?? "CUSTOMER"] ?? [];

  return (
    <Card>
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: "#FDF3E3",
                color: "#8A5200",
                flexShrink: 0,
              }}
            >
              <LockOutlined fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h4">{title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {explanation}
              </Typography>
            </Box>
          </Stack>

          <Alert severity="warning" variant="outlined" icon={<SecurityOutlined />}>
            <Typography variant="caption" sx={{ display: "block" }}>
              Missing capability: <strong>{capability}</strong> —{" "}
              {CAPABILITY_DESCRIPTIONS[capability]}. The{" "}
              {role ? humanize(role) : "current"} role holds{" "}
              {held.length === 0 ? "no capabilities" : `${held.length}`}:{" "}
              <Box component="span" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
                {held.join(", ") || "—"}
              </Box>
              .
            </Typography>
          </Alert>

          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default CapabilityGate;
