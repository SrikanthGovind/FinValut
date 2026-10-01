import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import SearchOffRounded from "@mui/icons-material/SearchOffRounded";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

/**
 * Catch-all for unmatched paths.
 *
 * Rendered outside `AppLayout` so it works for a signed-out visitor too, but it
 * still offers the signed-in user's own home rather than sending them to the
 * login screen.
 */
export function NotFoundPage() {
  const { user, homeFor, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <Card sx={{ maxWidth: 560, width: "100%" }}>
        <CardContent sx={{ p: 4, "&:last-child": { pb: 4 }, textAlign: "center" }}>
          <Stack spacing={2.5} alignItems="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 3,
                display: "grid",
                placeItems: "center",
                bgcolor: "#F1F4F8",
                color: "text.secondary",
              }}
            >
              <SearchOffRounded />
            </Box>

            <Box>
              <Typography variant="h2">Page not found</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Nothing is routed at{" "}
                <Box
                  component="code"
                  sx={{
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: "background.default",
                    fontFamily: "ui-monospace, Menlo, monospace",
                    fontSize: "0.78rem",
                    wordBreak: "break-all",
                  }}
                >
                  {location.pathname}
                </Box>
              </Typography>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="center">
              {user && role ? (
                <Button variant="contained" onClick={() => navigate(homeFor(role))}>
                  Back to my dashboard
                </Button>
              ) : (
                <Button variant="contained" onClick={() => navigate("/login")}>
                  Go to sign in
                </Button>
              )}
              <Button variant="outlined" onClick={() => navigate(-1)}>
                Go back
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default NotFoundPage;