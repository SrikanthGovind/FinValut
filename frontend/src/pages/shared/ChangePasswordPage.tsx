import { useState } from "react";
import { useMutation } from "@apollo/client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";

import PageHeader from "../../components/common/PageHeader";
import { InlineError } from "../../components/common/States";
import {
  PasswordRules,
  PasswordTextField,
  isPasswordValid,
} from "../../components/common/PasswordField";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import { CHANGE_PASSWORD } from "../../graphql/operations";
import type { User } from "../../graphql/types";
import { useAuth } from "../../auth/AuthContext";

/**
 * The server re-checks the current password before it will set a new one, so
 * the form asks for it too. An Auditor never sees this page: it holds no
 * USER_UPDATE_OWN.
 */
export function ChangePasswordPage() {
  const { user, can } = useAuth();
  const { notify } = useSnackbar();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<unknown>(null);

  const [changePassword, { loading }] = useMutation<
    { changePassword: User },
    { currentPassword: string; newPassword: string }
  >(CHANGE_PASSWORD);

  if (!can("USER_UPDATE_OWN")) {
    return (
      <>
        <PageHeader title="Change password" />
        <Alert severity="info">
          The Auditor role is read-only by design and holds no USER_UPDATE_OWN capability,
          so it cannot change even its own password.
        </Alert>
      </>
    );
  }

  const newValid = isPasswordValid(newPassword);
  const matches = newPassword === confirmPassword;
  const changed = newPassword.length > 0 && newPassword !== currentPassword;
  const canSubmit =
    currentPassword.length > 0 && newValid && matches && changed && !loading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);

    try {
      await changePassword({ variables: { currentPassword, newPassword } });
      notify("success", "Password changed. Use it the next time you sign in.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (caught) {
      setError(caught);
      notify("error", readableError(caught, "Could not change your password."));
    }
  };

  return (
    <>
      <PageHeader
        title="Change password"
        description="Rotating your own credentials. This is the only authentication change you can make."
      />

      <Box sx={{ maxWidth: 620 }}>
        <Card component="form" onSubmit={handleSubmit} noValidate>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Stack spacing={2.5}>
              {error ? <InlineError error={error} /> : null}

              <PasswordTextField
                value={currentPassword}
                onChange={setCurrentPassword}
                label="Current password"
                autoComplete="current-password"
                onBlur={() => setError(null)}
              />

              <Divider />

              <Box>
                <PasswordTextField
                  value={newPassword}
                  onChange={setNewPassword}
                  label="New password"
                  autoComplete="new-password"
                  error={newPassword.length > 0 && !newValid}
                  helperText={
                    newPassword.length > 0 && !newValid
                      ? "Does not meet every rule below"
                      : " "
                  }
                />
                <PasswordRules value={newPassword} />
              </Box>

              <PasswordTextField
                value={confirmPassword}
                onChange={setConfirmPassword}
                label="Confirm new password"
                autoComplete="new-password"
                error={confirmPassword.length > 0 && !matches}
                helperText={
                  confirmPassword.length > 0 && !matches
                    ? "The two entries do not match"
                    : " "
                }
              />

              <Alert severity="info" icon={<ShieldOutlined fontSize="small" />}>
                The change is recorded in the audit trail as{" "}
                <strong>PASSWORD_CHANGED</strong> with the value itself redacted. Signing
                out of other devices is not part of this build.
              </Alert>

              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                  color="inherit"
                  onClick={() => {
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setError(null);
                  }}
                >
                  Clear
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<LockOutlined />}
                  disabled={!canSubmit}
                >
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {user && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            Changing the password for {user.email}. It does not end your current session.
          </Typography>
        )}
      </Box>
    </>
  );
}

export default ChangePasswordPage;
