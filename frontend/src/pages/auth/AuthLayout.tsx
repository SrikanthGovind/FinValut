import type { ReactNode } from "react";
import { Box, Card, Stack, Typography } from "@mui/material";
import AccountBalance from "@mui/icons-material/AccountBalance";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import { Link as RouterLink } from "react-router-dom";

import { palette } from "../../theme";

const PILLARS = [
  {
    icon: LockOutlined,
    title: "Capability-based access",
    body: "Every query and mutation names a permission, not a person. The role decides.",
  },
  {
    icon: HistoryOutlined,
    title: "Append-only audit trail",
    body: "Successes and failures are both recorded, with no API path to rewrite an entry.",
  },
  {
    icon: ShieldOutlined,
    title: "Ownership enforced server-side",
    body: "A signed-in customer can only ever reach their own accounts and transactions.",
  },
];

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * Split screen for the unauthenticated pages: a navy brand rail that states
 * what the system is, and a white form column. Used by both login and register
 * so the two are visually one journey.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Brand rail */}
      <Box
        sx={{
          display: { xs: "none", lg: "flex" },
          width: "46%",
          maxWidth: 620,
          flexShrink: 0,
          flexDirection: "column",
          justifyContent: "space-between",
          p: 6,
          color: "#E7EEF7",
          background: `radial-gradient(circle at 15% 10%, ${palette.navy[700]} 0%, ${palette.navy[800]} 42%, ${palette.navy[900]} 100%)`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(255,255,255,0.12)",
            }}
          >
            <AccountBalance sx={{ color: "#FFFFFF" }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "1.15rem", color: "#FFFFFF", lineHeight: 1.1 }}>
              FinVault
            </Typography>
            <Typography sx={{ fontSize: "0.66rem", letterSpacing: "0.16em", color: "rgba(231,238,247,0.6)" }}>
              CORE BANKING SUITE
            </Typography>
          </Box>
        </Stack>

        <Box>
          <Typography
            sx={{
              fontSize: "2.1rem",
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: "#FFFFFF",
              mb: 2,
            }}
          >
            Branch, teller and audit
            <br />
            in one console.
          </Typography>
          <Typography sx={{ color: "rgba(231,238,247,0.72)", maxWidth: 440, mb: 4 }}>
            Four roles, one ledger. Customers see their own money, tellers work
            the counter, auditors read everything and change nothing, and
            administrators hold the keys.
          </Typography>

          <Stack spacing={2.5}>
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Stack key={pillar.title} direction="row" spacing={1.75} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: "rgba(255,255,255,0.09)",
                      color: palette.brand.light,
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.88rem", color: "#FFFFFF" }}>
                      {pillar.title}
                    </Typography>
                    <Typography sx={{ fontSize: "0.8rem", color: "rgba(231,238,247,0.65)" }}>
                      {pillar.body}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ color: "rgba(231,238,247,0.45)" }}>
          FINT0 · Branch network · Internal use only
        </Typography>
      </Box>

      {/* Form column */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 2, sm: 4 },
        }}
      >
        <Card sx={{ width: "100%", maxWidth: 460 }}>
          <Box sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ display: { lg: "none" }, mb: 3 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "primary.main",
                  color: "#FFFFFF",
                }}
              >
                <AccountBalance sx={{ fontSize: 20 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>FinVault</Typography>
            </Stack>

            <Typography variant="h1" sx={{ mb: 0.75 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {subtitle}
            </Typography>

            {children}
          </Box>
          <Box
            sx={{
              px: { xs: 3, sm: 4 },
              py: 2.25,
              bgcolor: "background.default",
              borderTop: "1px solid",
              borderColor: "divider",
              textAlign: "center",
            }}
          >
            {footer}
          </Box>
        </Card>
      </Box>
    </Box>
  );
}

export function AuthFooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Typography
      component={RouterLink}
      to={to}
      variant="body2"
      sx={{ color: "primary.main", fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
    >
      {children}
    </Typography>
  );
}

export default AuthLayout;
