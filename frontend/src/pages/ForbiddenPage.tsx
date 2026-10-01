import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { ROLE_CAPABILITIES, type UserRole } from "../rbac";
import { humanize } from "../utils/format";
import { ROLE_ICONS } from "../navigation/navConfig";

/**
 * Shown when a route guard refuses.
 *
 * Two different refusals land here — wrong role, or missing capability — and
 * the page states which one it is and what the signed-in role does hold, because
 * "403 Forbidden" on its own tells a person nothing about what to do next.
 */
export function ForbiddenPage() {
  const { role, user, homeFor } = useAuth();
  const navigate = useNavigate();

  const home = role ? homeFor(role) : "/";
  const Icon = role ? ROLE_ICONS[role] : BlockOutlined;
  const held = role ? ROLE_CAPABILITIES[role as UserRole] ?? [] : [];

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", py: { xs: 2, lg: 6 } }}>
      <Card>
        <CardContent sx={{ p: 4, "&:last-child": { pb: 4 } }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "#FCEBE9",
                  color: "error.main",
                  flexShrink: 0,
                }}
              >
                <BlockOutlined />
              </Box>
              <Box>
                <Typography variant="h2">You do not have access to this page</Typography>
                <Typography variant="body2" color="text.secondary">
                  The server refused it, and so did the navigation. Nothing was loaded.
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                You are signed in as
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "primary.main",
                    color: "#FFF",
                    fontSize: "0.74rem",
                    fontWeight: 700,
                  }}
                >
                  <Icon sx={{ fontSize: 17 }} />
                </Box>
                <Typography variant="body2" fontWeight={700}>
                  {user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "—"}
                </Typography>
                <Chip size="small" label={role ? humanize(role) : "Unknown role"} />
              </Stack>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Your role holds
              </Typography>
              {held.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No capabilities at all. An administrator needs to assign you a role.
                </Typography>
              ) : (
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
                  {held.map((capability) => (
                    <Chip
                      key={capability}
                      size="small"
                      variant="outlined"
                      label={capability}
                      sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "0.66rem" }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            <Divider />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="contained" onClick={() => navigate(home)}>
                Back to my dashboard
              </Button>
              <Button variant="outlined" onClick={() => navigate(-1)}>
                Go back
              </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              If you believe you should have this access, it is a role question rather than a
              bug: an administrator assigns roles on the User management page. Every refusal
              like this is recorded in the audit trail as ACCESS_DENIED.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default ForbiddenPage;