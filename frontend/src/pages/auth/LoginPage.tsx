import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import { useLocation, useNavigate } from "react-router-dom";

import AuthLayout, { AuthFooterLink } from "./AuthLayout";
import { PasswordTextField } from "../../components/common/PasswordField";
import { useAuth, useAuthSubmitState } from "../../auth/AuthContext";
import { ROLE_CAPABILITIES, ROLES } from "../../rbac";
import { canVisit } from "../../navigation/navConfig";

export function LoginPage() {
  const { login, homeFor } = useAuth();
  const { pending, submitError, setSubmitError, run } = useAuthSubmitState();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailValid && password.length > 0 && !pending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!canSubmit) return;

    // `login` resolves with the authenticated user, so the destination comes
    // from the server's answer rather than from a guess based on the email.
    // A deep link the visitor was turned away from is only honoured if the role
    // they actually hold is allowed to see it; otherwise they land on their own
    // dashboard instead of a second refusal.
    const ok = await run(async () => {
      const user = await login({ email: email.trim(), password });
      const destination = from && canVisit(user.role, from) ? from : homeFor(user.role);
      navigate(destination, { replace: true });
    });
    void ok;
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use the email and password issued to you."
      footer={
        <Typography variant="body2" color="text.secondary">
          No account yet?{" "}
          <AuthFooterLink to="/register">Register as a customer</AuthFooterLink>
        </Typography>
      }
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.25}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <TextField
            fullWidth
            label="Email address"
            type="email"
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSubmitError(null);
            }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={touched.email && !emailValid}
            helperText={touched.email && !emailValid ? "Enter a valid email address" : " "}
          />

          <PasswordTextField
            value={password}
            onChange={(value) => {
              setPassword(value);
              setSubmitError(null);
            }}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            error={touched.password && password.length === 0}
            helperText={touched.password && password.length === 0 ? "Enter your password" : " "}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={!canSubmit}
            startIcon={<LockOutlined />}
            sx={{ py: 1.25 }}
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>

          <Divider>
            <Typography variant="caption" color="text.secondary">
              Roles in this build
            </Typography>
          </Divider>

          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Self-registration always creates a <strong>Customer</strong>. Teller, Auditor
              and Admin are granted by an administrator from User Management.
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.75 }}>
              {ROLES.map((role) => (
                <Typography
                  key={role}
                  variant="caption"
                  sx={{
                    px: 1,
                    py: 0.35,
                    borderRadius: 1,
                    bgcolor: "background.default",
                    border: "1px solid",
                    borderColor: "divider",
                    fontWeight: 700,
                  }}
                >
                  {role.charAt(0) + role.slice(1).toLowerCase()} ·{" "}
                  {ROLE_CAPABILITIES[role].length} caps
                </Typography>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Box>
    </AuthLayout>
  );
}

export default LoginPage;
