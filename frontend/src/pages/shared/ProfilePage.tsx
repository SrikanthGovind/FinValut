import { useState } from "react";
import { useMutation } from "@apollo/client";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SaveRounded from "@mui/icons-material/SaveRounded";
import BadgeOutlined from "@mui/icons-material/BadgeOutlined";

import PageHeader from "../../components/common/PageHeader";
import { RoleChip, StatusChip } from "../../components/common/StatusChip";
import { DetailRow } from "../../components/domain/DetailDialog";
import { InlineError } from "../../components/common/States";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import { UPDATE_PROFILE } from "../../graphql/operations";
import type { User } from "../../graphql/types";
import { formatDate, formatDateTime, fullName, humanize, initials, toDateInputValue } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";

/**
 * Only the fields the profile form can send.
 *
 * A field may be `null`, and that is not the same as absent. The resolver
 * applies whatever it receives, so `null` is how the form *clears* a value the
 * user erased, while omitting the key entirely leaves the stored value alone.
 *
 * The distinction is enforced server-side: the DTO annotates each field with
 * `@Length`, and class-validator rejects an empty string — sending `""` to
 * clear a name fails with "Argument Validation Error" rather than clearing it.
 */
interface ProfileVariables {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
}

function formFromUser(user: User): ProfileForm {
  return {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
    dateOfBirth: toDateInputValue(user.dateOfBirth),
  };
}

/**
 * Available to every role except AUDITOR, which holds no USER_UPDATE_OWN.
 * Registering it under each role's own path keeps the URL saying who the page
 * belongs to even though the form is identical.
 */
export function ProfilePage() {
  const { user, can } = useAuth();
  const { notify } = useSnackbar();

  const [form, setForm] = useState<ProfileForm>(() =>
    user ? formFromUser(user) : { firstName: "", lastName: "", phone: "", dateOfBirth: "" }
  );
  const [error, setError] = useState<unknown>(null);

  // Seeded from the signed-in user and then owned by the form, so typing is
  // never overwritten by a background refetch. The identity it was seeded from
  // is tracked so a switch to a different user (or a sign-out and back in)
  // replaces the seed rather than showing the previous person's details.
  const [seededFor, setSeededFor] = useState<string | null>(user?.id ?? null);
  if (user && user.id !== seededFor) {
    setSeededFor(user.id);
    setForm(formFromUser(user));
  }

  const [updateProfile, { loading }] = useMutation<
    { updateProfile: User },
    ProfileVariables
  >(UPDATE_PROFILE);

  if (!can("USER_UPDATE_OWN")) {
    return (
      <>
        <PageHeader title="My profile" />
        <Alert severity="info">
          The Auditor role is read-only by design. It holds neither USER_UPDATE nor
          USER_UPDATE_OWN, so it cannot edit even its own record.
        </Alert>
      </>
    );
  }

  const dirty =
    user !== null &&
    (form.firstName !== (user.firstName ?? "") ||
      form.lastName !== (user.lastName ?? "") ||
      form.phone !== (user.phone ?? "") ||
      form.dateOfBirth !== toDateInputValue(user.dateOfBirth));

  const phoneValid = form.phone.trim() === "" || /^\d{10,15}$/.test(form.phone.trim());
  const canSave =
    dirty && form.firstName.trim().length > 0 && phoneValid && !loading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setError(null);

    try {
      // Only the fields that actually changed are sent. The resolver applies
      // what it receives. An explicit `null` clears an erased value, but the
      // server's validation rejects empty strings, so a trimmed empty becomes
      // `null` instead of being sent as `""`.
      const variables: Partial<ProfileVariables> = {};
      if (form.firstName !== (user?.firstName ?? "")) {
        const v = form.firstName.trim();
        variables.firstName = v === "" ? null : v;
      }
      if (form.lastName !== (user?.lastName ?? "")) {
        const v = form.lastName.trim();
        variables.lastName = v === "" ? null : v;
      }
      if (form.phone !== (user?.phone ?? "")) {
        const v = form.phone.trim();
        variables.phone = v === "" ? null : v;
      }
      if (form.dateOfBirth !== toDateInputValue(user?.dateOfBirth)) {
        // The calendar value is already `YYYY-MM-DD`, which is exactly what the
        // API accepts and returns. Round-tripping it through `new Date(...)` and
        // `.toISOString()` would reinterpret it as UTC midnight and shift the
        // stored day for anyone west of UTC, so the string is sent as-is.
        variables.dateOfBirth = form.dateOfBirth || null;
      }

      await updateProfile({ variables });
      notify("success", "Profile updated");
    } catch (caught) {
      setError(caught);
      notify("error", readableError(caught, "Could not update your profile."));
    }
  };

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your name and contact details. Role, status and identity documents are managed by an administrator."
      />

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1.2fr)" },
          alignItems: "start",
        }}
      >
        {/* Read-only identity summary */}
        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Stack spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: "primary.main", fontWeight: 700 }}>
                {user ? initials(user) : "?"}
              </Avatar>
              <Box sx={{ textAlign: "center" }}>
                <Typography variant="h4">{user ? fullName(user) : "—"}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                {user && <RoleChip value={user.role} />}
                {user && <StatusChip value={user.status} />}
              </Stack>
            </Stack>

            <Divider sx={{ mb: 1.5 }} />

            <DetailRow label="User ID" mono>
              {user?.id ?? "—"}
            </DetailRow>
            <DetailRow label="Member since">{formatDate(user?.createdAt)}</DetailRow>
            <DetailRow label="Last updated">{formatDateTime(user?.updatedAt)}</DetailRow>
            <DetailRow label="Aadhaar" mono>
              {user?.aadharNumber ?? "Not recorded"}
            </DetailRow>
            <DetailRow label="PAN" mono>
              {user?.panNumber ?? "Not recorded"}
            </DetailRow>

            <Alert severity="info" sx={{ mt: 2.5 }} icon={<BadgeOutlined fontSize="small" />}>
              Identity documents are shown masked to your role. Your role cannot read them
              in full, so only the last four characters are visible.
            </Alert>
          </CardContent>
        </Card>

        {/* Editable fields */}
        <Card component="form" onSubmit={handleSubmit} noValidate>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="h4" sx={{ mb: 2.5 }}>
              Editable details
            </Typography>
            <Stack spacing={2.25}>
              {error ? <InlineError error={error} /> : null}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="First name"
                  value={form.firstName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, firstName: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
                <TextField
                  fullWidth
                  label="Last name"
                  value={form.lastName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, lastName: event.target.value }))
                  }
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
              </Stack>

              <TextField
                fullWidth
                label="Phone number"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                error={!phoneValid}
                helperText={phoneValid ? "Optional. Digits only, 10 to 15 characters." : "Digits only, 10 to 15 characters."}
                slotProps={{ htmlInput: { maxLength: 20 } }}
              />

              <TextField
                fullWidth
                label="Date of birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(event) =>
                  setForm((current) => ({ ...current, dateOfBirth: event.target.value }))
                }
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Optional. Used for identity checks at the counter."
              />

              <Alert severity="info">
                Your role is <strong>{user ? humanize(user.role) : "—"}</strong> and your
                status is <strong>{user ? humanize(user.status) : "—"}</strong>. Neither
                can be changed from this page; an administrator controls both, and every
                change is written to the audit trail.
              </Alert>

              <Divider />

              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                  color="inherit"
                  disabled={!dirty}
                  onClick={() =>
                    user &&
                    setForm({
                      firstName: user.firstName ?? "",
                      lastName: user.lastName ?? "",
                      phone: user.phone ?? "",
                      dateOfBirth: toDateInputValue(user.dateOfBirth),
                    })
                  }
                >
                  Discard changes
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveRounded />}
                  disabled={!canSave}
                >
                  {loading ? "Saving…" : "Save changes"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </>
  );
}

export default ProfilePage;
