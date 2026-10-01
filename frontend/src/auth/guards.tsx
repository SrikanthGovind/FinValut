import type { ReactNode } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import AccountBalance from "@mui/icons-material/AccountBalance";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthContext";
import type { Capability, UserRole } from "../rbac";

function Splash({ label }: { label: string }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
      }}
    >
      <Stack spacing={2} alignItems="center">
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 3,
            display: "grid",
            placeItems: "center",
            bgcolor: "primary.main",
            color: "#FFFFFF",
          }}
        >
          <AccountBalance />
        </Box>
        <CircularProgress size={22} thickness={4} />
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * Gate for every authenticated route.
 *
 * The stored token is validated against `me` before any child renders, so a
 * deep link like /admin/users cannot paint a page the caller will then be
 * bounced off.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) return <Splash label="Restoring your session…" />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Restricts a route to one role. Used for the four role home routes. */
export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const { role, bootstrapping } = useAuth();

  if (bootstrapping) return <Splash label="Restoring your session…" />;
  if (!role || !roles.includes(role)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

/**
 * Capability gate for a single page.
 *
 * The server checks the same capability on the query the page runs, so this is
 * a courtesy rather than a security boundary: it turns a 403 from a table full
 * of rows into an explicit explanation before the request is made.
 */
export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  const { can, bootstrapping } = useAuth();

  if (bootstrapping) return <Splash label="Restoring your session…" />;
  if (!can(capability)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

/** Signed-in users have no business on the login or register screen. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, bootstrapping } = useAuth();

  if (bootstrapping) return <Splash label="Restoring your session…" />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
