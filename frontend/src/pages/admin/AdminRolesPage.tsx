import { useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import { ROLE_ACCENTS, ROLE_ICONS } from "../../navigation/navConfig";
import {
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_GROUPS,
  ROLE_CAPABILITIES,
  ROLE_DESCRIPTIONS,
  ROLES,
  hasPermission,
  type UserRole,
} from "../../rbac";
import { humanize } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";

/**
 * The role and permission matrix.
 *
 * Read-only by construction: the server exposes no mutation that edits
 * `ROLE_CAPABILITIES`, so this page documents what the server will actually do
 * rather than pretending to configure it. The table is generated from the same
 * `ROLE_CAPABILITIES` map that guards every route and every button, which makes
 * it a faithful view of the current policy — and, if the map and the backend
 * ever diverge, the first place that shows it.
 */
export function AdminRolesPage() {
  const { role: viewer } = useAuth();
  const navigate = useNavigate();

  const totalCapabilities = CAPABILITY_GROUPS.reduce(
    (count, group) => count + group.capabilities.length,
    0
  );

  const matrix = useMemo(
    () =>
      CAPABILITY_GROUPS.map((group) => ({
        ...group,
        rows: group.capabilities.map((capability) => ({
          capability,
          description: CAPABILITY_DESCRIPTIONS[capability],
          held: Object.fromEntries(
            ROLES.map((role) => [role, hasPermission(role, capability)])
          ) as Record<UserRole, boolean>,
        })),
      })),
    []
  );

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="What each of the four roles is allowed to do, exactly as the server enforces it."
        actions={
          <Chip
            variant="outlined"
            label={`${totalCapabilities} capabilities · 4 roles`}
            sx={{ alignSelf: "center" }}
          />
        }
      />

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
            <InfoOutlinedIcon color="info" sx={{ mt: 0.25, flexShrink: 0 }} />
            <Box>
              <Typography variant="body2">
                This page is a read-only view of the policy, not a way to change it. The
                capability table lives in <code>backend/src/permissions.ts</code>, the server
                checks it on every request, and the frontend keeps a mirror in{" "}
                <code>frontend/src/rbac.ts</code> so it only ever offers buttons that will
                succeed. Editing the table here would change nothing on the server.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                To change a role's powers, edit the server table, restart it, and update the
                mirror in the same commit. The two must never drift.
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h3" sx={{ mb: 1.5 }}>
        The four roles
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 3,
        }}
      >
        {ROLES.map((role) => {
          const Icon = ROLE_ICONS[role];
          const accent = ROLE_ACCENTS[role];
          const held = ROLE_CAPABILITIES[role].length;

          return (
            <Card key={role} sx={{ borderTop: `3px solid ${accent}` }}>
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: `${accent}18`,
                      color: accent,
                      flexShrink: 0,
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {humanize(role)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {held} of {totalCapabilities} capabilities
                    </Typography>
                  </Box>
                  {viewer === role && (
                    <Chip
                      size="small"
                      label="You"
                      sx={{ ml: "auto", height: 20, fontSize: "0.64rem" }}
                    />
                  )}
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 60 }}>
                  {ROLE_DESCRIPTIONS[role]}
                </Typography>

                <Box sx={{ height: 6, borderRadius: 3, bgcolor: "background.default", overflow: "hidden" }}>
                  <Box
                    sx={{
                      width: `${(held / totalCapabilities) * 100}%`,
                      height: "100%",
                      bgcolor: accent,
                    }}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary">
                  {Math.round((held / totalCapabilities) * 100)}% of the full capability set
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Typography variant="h3" sx={{ mb: 1.5 }}>
        Capability matrix
      </Typography>

      <Stack spacing={2.5}>
        {matrix.map((group) => (
          <Card key={group.label}>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <Box sx={{ px: 2.5, py: 1.75 }}>
                <Typography variant="h4">{group.label}</Typography>
              </Box>
              <Divider />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ minWidth: 300 }}>Capability</TableCell>
                      {ROLES.map((role) => (
                        <TableCell
                          key={role}
                          align="center"
                          sx={{ minWidth: 110, color: ROLE_ACCENTS[role] }}
                        >
                          {humanize(role)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.rows.map((row) => (
                      <TableRow key={row.capability} hover>
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: "ui-monospace, Menlo, monospace",
                              fontWeight: 700,
                              fontSize: "0.78rem",
                            }}
                          >
                            {row.capability}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.description}
                          </Typography>
                        </TableCell>
                        {ROLES.map((role) => (
                          <TableCell key={role} align="center">
                            <Tooltip
                              title={
                                row.held[role]
                                  ? `${humanize(role)} holds ${row.capability}`
                                  : `${humanize(role)} does not hold ${row.capability}`
                              }
                            >
                              <Box
                                sx={{
                                  display: "inline-grid",
                                  placeItems: "center",
                                  width: 26,
                                  height: 26,
                                  borderRadius: "50%",
                                  bgcolor: row.held[role] ? "#E6F5F0" : "transparent",
                                }}
                              >
                                {row.held[role] ? (
                                  <CheckRounded sx={{ fontSize: 17, color: "#0E7C66" }} />
                                ) : (
                                  <CloseRounded sx={{ fontSize: 15, color: "#D3DBE5" }} />
                                )}
                              </Box>
                            </Tooltip>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Card sx={{ mt: 2.5 }}>
        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
          <Typography variant="h4" sx={{ mb: 1.5 }}>
            Separation of duties
          </Typography>
          <Stack spacing={1.25}>
            <Rule
              title="A teller acts, it does not authorise"
              body="A TELLER can open accounts and handle cash but holds neither ACCOUNT_UPDATE nor TRANSACTION_APPROVE, so it cannot freeze an account or clear its own queued request."
            />
            <Rule
              title="An auditor observes, it does not act"
              body="AUDITOR holds ACCOUNT_READ_ANY, TRANSACTION_READ_ANY and AUDIT_READ — enough to inspect every record — but no write capability at all, including TRANSACTION_REVERSE."
            />
            <Rule
              title="An administrator holds everything, which is why it holds one"
              body="ADMIN is the only role with USER_UPDATE and TRANSACTION_APPROVE. Because one administrator can act on any record, the audit trail is the accountability mechanism — and role changes themselves are logged."
            />
            <Rule
              title="The customer is confined to itself"
              body="CUSTOMER can read only accounts it owns and move only its own money. It has no path to another customer's record, including its own teller's."
            />
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="text.secondary">
            Roles are assigned on the User management page. A role change takes effect on the
            user's next request without re-authentication, because capabilities are resolved
            per request from the server's table rather than baked into the token.
          </Typography>

          <Box sx={{ mt: 1.5 }}>
            <Typography
              variant="body2"
              component="button"
              onClick={() => navigate("/admin/users")}
              sx={{
                border: 0,
                background: "none",
                p: 0,
                cursor: "pointer",
                color: "primary.main",
                fontWeight: 700,
                fontFamily: "inherit",
                fontSize: "0.84rem",
              }}
            >
              Go to user management
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          bgcolor: "primary.main",
          mt: 1,
          flexShrink: 0,
        }}
      />
      <Box>
        <Typography variant="body2" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {body}
        </Typography>
      </Box>
    </Stack>
  );
}

export default AdminRolesPage;