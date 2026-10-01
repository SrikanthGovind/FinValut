import { useMemo, useState } from "react";
import { Box, Breadcrumbs, Link as MuiLink, Stack, Typography } from "@mui/material";
import NavigateIcon from "@mui/icons-material/NavigateNextRounded";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@apollo/client";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useAuth } from "../../auth/AuthContext";
import { findNavTrail } from "../../navigation/navConfig";
import { GET_PENDING_APPROVALS } from "../../graphql/operations";
import type { Transaction } from "../../graphql/types";

/**
 * Sidebar + topbar shell. Everything role-specific lives in the route table;
 * this only owns chrome, so a new page never has to think about layout.
 */
export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { role, homeFor } = useAuth();
  const location = useLocation();

  const { data } = useQuery<{ getPendingApprovals: Transaction[] }>(
    GET_PENDING_APPROVALS,
    {
      skip: role !== "ADMIN",
      fetchPolicy: "cache-and-network",
      errorPolicy: "all",
      pollInterval: 60_000,
    }
  );
  const pendingApprovals = data?.getPendingApprovals?.length ?? 0;

  const trail = useMemo(
    () => findNavTrail(role, location.pathname),
    [role, location.pathname]
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        pendingApprovals={pendingApprovals}
      />

      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar sidebarCollapsed={collapsed} onToggleSidebar={() => setCollapsed((v) => !v)} />

        <BreadcrumbBar trail={trail} homePath={role ? homeFor(role) : "/"} />

        <Box component="main" sx={{ flexGrow: 1, px: { xs: 2, lg: 3 }, py: { xs: 2, lg: 3 } }}>
          <Box sx={{ maxWidth: 1440, mx: "auto" }}>
            <Outlet />
          </Box>
        </Box>

        <Box component="footer" sx={{ px: 3, py: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="space-between"
            sx={{ maxWidth: 1440, mx: "auto" }}
          >
            <Typography variant="caption" color="text.secondary">
              FinVault Core Banking · Internal use only
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Every privileged action in this console is written to the append-only audit trail.
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function BreadcrumbBar({
  trail,
  homePath,
}: {
  trail: Array<{ label: string; path: string }>;
  homePath: string;
}) {
  const { role } = useAuth();

  return (
    <Box
      sx={{
        px: { xs: 2, lg: 3 },
        py: 1.1,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        position: "sticky",
        top: 64,
        zIndex: 5,
      }}
    >
      <Stack sx={{ maxWidth: 1440, mx: "auto" }}>
        <Breadcrumbs
          separator={<NavigateIcon fontSize="small" sx={{ color: "text.disabled" }} />}
          aria-label="Breadcrumb"
        >
          <MuiLink
            component={RouterLink}
            to={homePath}
            underline="hover"
            color="text.secondary"
            sx={{ display: "inline-flex", alignItems: "center", fontSize: "0.8rem" }}
          >
            <HomeOutlinedIcon sx={{ fontSize: 15, mr: 0.75 }} />
            {role ? role.charAt(0) + role.slice(1).toLowerCase() : "Home"}
          </MuiLink>
          {trail.map((crumb, index) =>
            index === trail.length - 1 ? (
              <Typography
                key={crumb.path}
                color="text.primary"
                sx={{ fontSize: "0.8rem", fontWeight: 700 }}
              >
                {crumb.label}
              </Typography>
            ) : (
              <MuiLink
                key={crumb.path}
                component={RouterLink}
                to={crumb.path}
                underline="hover"
                color="text.secondary"
                sx={{ fontSize: "0.8rem" }}
              >
                {crumb.label}
              </MuiLink>
            )
          )}
        </Breadcrumbs>
      </Stack>
    </Box>
  );
}

export default AppLayout;
