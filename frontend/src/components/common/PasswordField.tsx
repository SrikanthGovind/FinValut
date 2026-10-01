import { useState } from "react";
import {
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlined from "@mui/icons-material/VisibilityOffOutlined";
import CheckRounded from "@mui/icons-material/CheckRounded";

/**
 * The rules are a copy of the ones in
 * `backend/src/modules/auth/dto/auth.dto.ts`. Showing them up front is
 * cheaper than a rejected mutation, and keeping one list here stops the login
 * and register forms from drifting apart.
 */
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "case", label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "digit", label: "One number", test: (v: string) => /\d/.test(v) },
  {
    id: "special",
    label: "One special character",
    test: (v: string) => /[!@#$%^&*]/.test(v),
  },
] as const;

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

export function PasswordTextField({
  value,
  onChange,
  label = "Password",
  error,
  helperText,
  autoComplete = "current-password",
  onBlur,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: boolean;
  helperText?: string;
  autoComplete?: string;
  onBlur?: () => void;
  name?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      fullWidth
      name={name}
      label={label}
      type={visible ? "text" : "password"}
      value={value}
      autoComplete={autoComplete}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      error={error}
      helperText={helperText}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setVisible((v) => !v)}
                edge="end"
                size="small"
                aria-label={visible ? "Hide password" : "Show password"}
              >
                {visible ? (
                  <VisibilityOffOutlined fontSize="small" />
                ) : (
                  <VisibilityOutlined fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

/** Live checklist shown under the register form's password field. */
export function PasswordRules({ value }: { value: string }) {
  return (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(value);
        return (
          <Stack
            key={rule.id}
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ color: passed ? "success.main" : "text.disabled" }}
          >
            <CheckRounded sx={{ fontSize: 14 }} />
            <Typography variant="caption">{rule.label}</Typography>
          </Stack>
        );
      })}
    </Stack>
  );
}
