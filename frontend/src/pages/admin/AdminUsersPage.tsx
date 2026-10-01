import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PersonAddAltRounded from "@mui/icons-material/PersonAddAltRounded";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { RoleChip, StatusChip } from "../../components/common/StatusChip";
import { ErrorState, LoadingState } from "../../components/common/States";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { PasswordRules, PasswordTextField, isPasswordValid } from "../../components/common/PasswordField";
import { CustomerSummary } from "../../components/domain/CustomerSummary";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import {
  GET_BANK_ACCOUNTS,
  GET_USERS,
  REGISTER,
  SET_USER_ROLE,
  SET_USER_STATUS,
} from "../../graphql/operations";
import type { BankAccount, User, UserRole, UserStatus } from "../../graphql/types";
import { formatDate, fullName } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";
import { EMPTY } from "../../utils/empty";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "BLOCKED", label: "Blocked" },
];

const ROLE_OPTIONS = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "TELLER", label: "Teller" },
  { value: "AUDITOR", label: "Auditor" },
  { value: "ADMIN", label: "Admin" },
];

const STATUS_CHOICES: Array<{ value: UserStatus; label: string; body: string }> = [
  {
    value: "ACTIVE",
    label: "Activate",
    body: "The login can be used again and the server will accept transactions for this user.",
  },
  {
    value: "INACTIVE",
    label: "Deactivate",
    body: "The login stops working but the user record and its accounts are kept.",
  },
  {
    value: "BLOCKED",
    label: "Block",
    body: "The login and every transaction on the user's accounts are refused. Use this for a suspected compromise.",
  },
];

/**
 * User administration.
 *
 * Two server facts shape this page. First, `register` is the only way to create
 * a user, and it always produces a CUSTOMER — so creating a teller or auditor
 * is a two-step act: register, then promote. Second, `setUserRole` and
 * `setUserStatus` take no expected-version argument, so the UI cannot offer
 * optimistic concurrency and simply refetches after a change.
 */
export function AdminUsersPage() {
  const { user: me } = useAuth();
  const { notify } = useSnackbar();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<User | null>(null);
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [roleChoice, setRoleChoice] = useState<UserRole>("CUSTOMER");
  const [statusTarget, setStatusTarget] = useState<{ user: User; status: UserStatus } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const usersQuery = useQuery<{ getUsers: User[] }>(GET_USERS, {
    fetchPolicy: "cache-and-network",
  });
  const accountsQuery = useQuery<{ getBankAccounts: BankAccount[] }>(GET_BANK_ACCOUNTS, {
    fetchPolicy: "cache-and-network",
  });

  const users = usersQuery.data?.getUsers ?? EMPTY;
  const accounts = accountsQuery.data?.getBankAccounts ?? EMPTY;

  const accountCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const account of accounts) {
      counts.set(account.userId, (counts.get(account.userId) ?? 0) + 1);
    }
    return counts;
  }, [accounts]);

  const [setRole, { loading: roleLoading }] = useMutation<
    { setUserRole: User },
    { userId: string; role: string }
  >(SET_USER_ROLE);

  const [setStatus, { loading: statusLoading }] = useMutation<
    { setUserStatus: User },
    { userId: string; status: string }
  >(SET_USER_STATUS);

  const stats = useMemo(
    () => ({
      total: users.length,
      staff: users.filter((u) => u.role !== "CUSTOMER").length,
      blocked: users.filter((u) => u.status !== "ACTIVE").length,
      admins: users.filter((u) => u.role === "ADMIN").length,
    }),
    [users]
  );

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      value: (row) => fullName(row).toLowerCase(),
      render: (row) => (
        <Box>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="body2" fontWeight={700}>
              {fullName(row)}
            </Typography>
            {row.id === me?.id && (
              <Chip size="small" label="You" sx={{ height: 18, fontSize: "0.64rem" }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {row.email}
          </Typography>
        </Box>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (row) => <RoleChip value={row.role} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <StatusChip value={row.status} />,
    },
    {
      key: "accounts",
      header: "Accounts",
      align: "center",
      hideBelow: "sm",
      sortable: true,
      value: (row) => accountCounts.get(row.id) ?? 0,
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {accountCounts.get(row.id) ?? 0}
        </Typography>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      hideBelow: "md",
      render: (row) => (
        <Typography variant="caption" color="text.secondary">
          {row.phone ?? "—"}
        </Typography>
      ),
    },
    {
      key: "createdAt",
      header: "Registered",
      sortable: true,
      align: "right",
      hideBelow: "md",
      value: (row) => new Date(row.createdAt).getTime(),
      render: (row) => (
        <Typography variant="caption" color="text.secondary">
          {formatDate(row.createdAt)}
        </Typography>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      width: 200,
      render: (row) => (
        <Stack direction="row" spacing={0.5} justifyContent="flex-end" onClick={(event) => event.stopPropagation()}>
          <Button
            size="small"
            onClick={() => {
              setRoleTarget(row);
              setRoleChoice(row.role);
            }}
          >
            Role
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={() =>
              setStatusTarget({
                user: row,
                status: row.status === "ACTIVE" ? "BLOCKED" : "ACTIVE",
              })
            }
          >
            {row.status === "ACTIVE" ? "Block" : "Activate"}
          </Button>
        </Stack>
      ),
    },
  ];

  const submitRole = async () => {
    if (!roleTarget) return;
    setSubmitError(null);
    try {
      const result = await setRole({
        variables: { userId: roleTarget.id, role: roleChoice },
      });
      const updated = result.data?.setUserRole;
      notify(
        "success",
        `${fullName(roleTarget)} is now ${roleChoice.toLowerCase()}. This grants every capability of that role immediately.`
      );
      setRoleTarget(null);
      if (updated) setSelected(updated);
      await usersQuery.refetch();
    } catch (caught) {
      setSubmitError(caught);
      notify("error", readableError(caught, "Could not change the role."));
    }
  };

  const submitStatus = async () => {
    if (!statusTarget) return;
    setSubmitError(null);
    try {
      const result = await setStatus({
        variables: { userId: statusTarget.user.id, status: statusTarget.status },
      });
      const updated = result.data?.setUserStatus;
      notify(
        statusTarget.status === "ACTIVE" ? "success" : "warning",
        `${fullName(statusTarget.user)} is now ${statusTarget.status.toLowerCase()}. Recorded in the audit trail as USER_STATUS_CHANGED.`
      );
      setStatusTarget(null);
      if (updated) setSelected(updated);
      await usersQuery.refetch();
    } catch (caught) {
      setSubmitError(caught);
      notify("error", readableError(caught, "Could not change the status."));
    }
  };

  if (usersQuery.error) {
    return <ErrorState error={usersQuery.error} onRetry={() => void usersQuery.refetch()} />;
  }

  const statusChoice = STATUS_CHOICES.find((choice) => choice.value === statusTarget?.status);

  return (
    <>
      <PageHeader
        title="User management"
        description="Every login on the platform, its role, and whether it may be used."
        actions={
          <>
            <Button variant="outlined" startIcon={<GroupsOutlined />} onClick={() => navigate("/admin/roles")}>
              Roles &amp; permissions
            </Button>
            <Button variant="contained" startIcon={<PersonAddAltRounded />} onClick={() => setCreateOpen(true)}>
              Create user
            </Button>
          </>
        }
      />

      {submitError ? (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setSubmitError(null)}>
          {readableError(submitError, "The change was refused.")}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard label="Users" value={stats.total} caption="All logins" loading={usersQuery.loading} />
        <StatCard
          label="Staff accounts"
          value={stats.staff}
          caption="Not customers"
          tone="neutral"
          loading={usersQuery.loading}
        />
        <StatCard
          label="Not active"
          value={stats.blocked}
          caption="Inactive or blocked"
          icon={LockOutlined}
          tone={stats.blocked > 0 ? "warning" : "success"}
          loading={usersQuery.loading}
        />
        <StatCard
          label="Administrators"
          value={stats.admins}
          caption="Hold every capability"
          tone={stats.admins > 1 ? "danger" : "primary"}
          loading={usersQuery.loading}
        />
      </Box>

      {usersQuery.loading && users.length === 0 ? (
        <LoadingState label="Loading users…" />
      ) : (
        <DataTable
          rows={users}
          columns={columns}
          getRowId={(row) => row.id}
          searchKeys={["firstName", "lastName", "email", "phone", "id", "role", "status"]}
          searchPlaceholder="Search by name, email, phone or user ID…"
          filters={[
            { key: "role", label: "Role", options: ROLE_OPTIONS },
            { key: "status", label: "Status", options: STATUS_OPTIONS },
          ]}
          onRowClick={setSelected}
          initialRowsPerPage={10}
          initialSort={{ key: "name", direction: "asc" }}
          footerNote="A role change takes effect on the user's next request — no re-login is needed, because capabilities are resolved per request from the server."
        />
      )}

      {/* User detail */}
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          {/* component="div": DialogTitle already renders an <h2>. */}
          <Typography variant="h3" component="div">
            {selected ? fullName(selected) : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            User record · {selected?.id}
          </Typography>
        </DialogTitle>
        <IconButton
          onClick={() => setSelected(null)}
          aria-label="Close"
          sx={{ position: "absolute", right: 12, top: 12, color: "text.secondary" }}
        >
          <CloseRounded fontSize="small" />
        </IconButton>
        <DialogContent dividers>
          {selected && (
            <Box>
              <CustomerSummary user={selected} />
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Holds {accountCounts.get(selected.id) ?? 0} bank account(s). Opening one for a
                customer is done from the counter, not from here.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setSelected(null)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role change */}
      <Dialog
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Change role</DialogTitle>
        <DialogContent>
          {submitError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {readableError(submitError, "The role change was refused.")}
            </Alert>
          ) : null}
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {roleTarget ? fullName(roleTarget) : ""} currently holds{" "}
              <strong>{roleTarget?.role}</strong>. The new role takes effect immediately and
              the change is written to the audit trail as ROLE_CHANGED.
            </Typography>

            <TextField
              select
              fullWidth
              label="Role"
              value={roleChoice}
              onChange={(event) => setRoleChoice(event.target.value as UserRole)}
            >
              {ROLE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {roleTarget && roleChoice !== roleTarget.role && (
              <Alert severity={roleChoice === "ADMIN" ? "warning" : "info"}>
                {roleChoice === "ADMIN"
                  ? "This grants every capability in the system, including reading unmasked Aadhaar and PAN and changing other administrators' roles."
                  : roleChoice === "AUDITOR"
                    ? "Auditor is read-only across the whole system. It is the role to use for someone who must inspect but not act."
                    : `Demoting from ${roleTarget.role} removes capabilities the user may currently be relying on. Existing sessions stay signed in but lose access on the next request.`}
              </Alert>
            )}

            {roleTarget && roleTarget.id === me?.id && roleChoice !== me.role && (
              <Alert severity="error">
                You are changing your own role. You will lose access to this page the moment
                the change lands, so confirm you can still reach the platform another way.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setRoleTarget(null)} disabled={roleLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitRole()}
            disabled={roleLoading || !roleTarget || roleChoice === roleTarget.role}
          >
            {roleLoading ? "Applying…" : "Change role"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status change */}
      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusChoice?.label ?? "Change status"}
        tone={statusTarget && statusTarget.status !== "ACTIVE" ? "error" : "primary"}
        confirmLabel={statusChoice?.label ?? "Apply"}
        pending={statusLoading}
        message={
          <Stack spacing={1}>
            <Typography variant="body2">
              <strong>{statusTarget ? fullName(statusTarget.user) : ""}</strong> will be set to{" "}
              <strong>{statusTarget?.status}</strong>.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {statusChoice?.body}
            </Typography>
            {statusTarget && statusTarget.user.role === "ADMIN" && (
              <Typography variant="caption" sx={{ color: "error.main" }}>
                This is an administrator account. Blocking it will remove the last route to
                every other privileged action.
              </Typography>
            )}
          </Stack>
        }
        onConfirm={() => void submitStatus()}
        onClose={() => setStatusTarget(null)}
      />

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await usersQuery.refetch();
        }}
      />
    </>
  );
}

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

/**
 * Create-user dialog built on `register`.
 *
 * The server has no admin-only create-user mutation: `createUser` is deprecated
 * and `register` always yields a CUSTOMER. So this form creates the login, and
 * if a staff role was chosen it then immediately calls `setUserRole`. Both steps
 * are shown, and a failure in the second step is reported as a half-created
 * user rather than being hidden.
 */
function CreateUserDialog({ open, onClose, onCreated }: CreateUserDialogProps) {
  const { notify } = useSnackbar();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [role, setRole] = useState<UserRole>("CUSTOMER");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);

  const [register] = useMutation<{ register: { user: User } }>(REGISTER);
  const [promote] = useMutation<{ setUserRole: User }, { userId: string; role: string }>(
    SET_USER_ROLE
  );

  const reset = () => {
    setForm({ firstName: "", lastName: "", email: "", phone: "", password: "" });
    setRole("CUSTOMER");
    setError(null);
    setDone(null);
  };

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await register({
        variables: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || null,
        },
      });
      const created = result.data?.register?.user;
      if (!created) throw new Error("The server did not return the new user.");

      if (role !== "CUSTOMER") {
        try {
          await promote({ variables: { userId: created.id, role } });
          setDone(`${created.email} created and promoted to ${humanizeRole(role)}.`);
          notify("success", `${created.email} created with the ${humanizeRole(role)} role.`);
        } catch (promotionFailure) {
          // The login exists but without the intended role. Saying so is the
          // honest outcome; the operator can re-run the role change from the table.
          setDone(`${created.email} created as a CUSTOMER, but the promotion failed.`);
          notify(
            "warning",
            `User created, but the role could not be set: ${readableError(
              promotionFailure,
              "unknown error"
            )}`
          );
        }
      } else {
        setDone(`${created.email} created as a customer.`);
        notify("success", `${created.email} created.`);
      }

      await onCreated();
    } catch (caught) {
      setError(caught);
    } finally {
      setPending(false);
    }
  };

  const canSubmit =
    form.firstName.trim().length > 0 &&
    form.email.includes("@") &&
    isPasswordValid(form.password);

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create a user</DialogTitle>
      <DialogContent>
        {done ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 3, textAlign: "center" }}>
            <CheckCircleRounded color="success" sx={{ fontSize: 42 }} />
            <Typography variant="h4">User created</Typography>
            <Typography variant="body2" color="text.secondary">
              {done}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Share the password over a channel the user can receive privately. Nobody can
              retrieve it afterwards — the server stores only a hash.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {error ? (
              <Alert severity="error">{readableError(error, "Could not create the user.")}</Alert>
            ) : null}

            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              }}
            >
              <TextField
                label="First name"
                required
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              />
              <TextField
                label="Last name"
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
            </Box>

            <TextField
              label="Email"
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              error={form.email.length > 0 && !form.email.includes("@")}
            />

            <TextField
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />

            <Box>
              <PasswordTextField
                label="Initial password"
                value={form.password}
                onChange={(value) => setForm({ ...form, password: value })}
                error={form.password.length > 0 && !isPasswordValid(form.password)}
                helperText="The user can change this after the first sign-in."
                autoComplete="new-password"
              />
              <PasswordRules value={form.password} />
            </Box>

            <TextField
              select
              fullWidth
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              helperText="Staff roles are applied as a second step, immediately after the login is created."
            >
              {ROLE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {role === "ADMIN" && (
              <Alert severity="warning">
                An administrator can read unmasked identity documents, change any role, and
                freeze or close any account. Create the least-privileged role that lets this
                person do their job.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={pending}>
          {done ? "Close" : "Cancel"}
        </Button>
        {!done && (
          <Button variant="contained" onClick={() => void submit()} disabled={pending || !canSubmit}>
            {pending ? "Creating…" : "Create user"}
          </Button>
        )}
        {done && (
          <Button variant="outlined" onClick={reset}>
            Create another
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function humanizeRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export default AdminUsersPage;