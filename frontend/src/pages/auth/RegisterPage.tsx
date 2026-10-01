import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonAddAltRounded from "@mui/icons-material/PersonAddAltRounded";
import { useNavigate } from "react-router-dom";

import AuthLayout, { AuthFooterLink } from "./AuthLayout";
import {
  PasswordRules,
  PasswordTextField,
  isPasswordValid,
} from "../../components/common/PasswordField";
import { useAuth, useAuthSubmitState } from "../../auth/AuthContext";

export function RegisterPage() {
  const { register, homeFor } = useAuth();
  const { pending, submitError, setSubmitError, run } = useAuthSubmitState();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const phoneValid = form.phone.trim() === "" || /^\d{10,15}$/.test(form.phone.trim());
  const passwordValid = isPasswordValid(form.password);
  const canSubmit =
    form.firstName.trim().length > 0 &&
    emailValid &&
    passwordValid &&
    phoneValid &&
    !pending;

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ firstName: true, email: true, password: true, phone: true });
    if (!canSubmit) return;

    await run(async () => {
      const user = await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
      });
      navigate(homeFor(user.role), { replace: true });
    });
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register once, then ask your branch to open a bank account."
      footer={
        <Typography variant="body2" color="text.secondary">
          Already registered? <AuthFooterLink to="/login">Sign in</AuthFooterLink>
        </Typography>
      }
    >
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.25}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              fullWidth
              label="First name"
              autoFocus
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) => update("firstName")(event.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
              error={touched.firstName && form.firstName.trim().length === 0}
              helperText={
                touched.firstName && form.firstName.trim().length === 0
                  ? "Required"
                  : " "
              }
            />
            <TextField
              fullWidth
              label="Last name"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(event) => update("lastName")(event.target.value)}
              helperText="Optional"
            />
          </Stack>

          <TextField
            fullWidth
            label="Email address"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => update("email")(event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={touched.email && !emailValid}
            helperText={touched.email && !emailValid ? "Enter a valid email address" : " "}
          />

          <TextField
            fullWidth
            label="Phone number"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => update("phone")(event.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
            error={touched.phone && !phoneValid}
            helperText={
              touched.phone && !phoneValid ? "Digits only, 10 to 15 characters" : "Optional"
            }
          />

          <Box>
            <PasswordTextField
              value={form.password}
              onChange={update("password")}
              label="Password"
              autoComplete="new-password"
              error={touched.password && !passwordValid}
              helperText={touched.password && !passwordValid ? "Does not meet the rules below" : " "}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            />
            <PasswordRules value={form.password} />
          </Box>

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={!canSubmit}
            startIcon={<PersonAddAltRounded />}
            sx={{ py: 1.25 }}
          >
            {pending ? "Creating your account…" : "Create account"}
          </Button>

          <Typography variant="caption" color="text.secondary">
            New accounts start as <strong>Customer</strong> with no bank account. A teller
            opens one for you at the counter; the account starts at a zero balance and is
            funded by a cash deposit.
          </Typography>
        </Stack>
      </Box>
    </AuthLayout>
  );
}

export default RegisterPage;
