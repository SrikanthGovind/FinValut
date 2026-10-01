import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import GppGoodOutlined from "@mui/icons-material/GppGoodOutlined";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { ErrorState, LoadingState } from "../../components/common/States";
import { ReadOnlyBanner } from "../../components/common/ConfirmDialog";
import { AuditLogDetailDialog } from "../../components/domain/TransactionDetailDialog";
import { GET_AUDIT_LOGS, GET_USERS } from "../../graphql/operations";
import type { AuditAction, AuditLog, User } from "../../graphql/types";
import { useSnackbar } from "../../components/common/ToastProvider";
import { formatDate, formatDateTime, fullName, humanize } from "../../utils/format";
import { auditLogVariables, type AuditLogFilters } from "../../utils/audit";
import { EMPTY } from "../../utils/empty";

/** How many entries to pull in one request; the server paginates this query. */
const PAGE_LIMIT = 200;

const OUTCOME_OPTIONS = [
  { value: "SUCCESS", label: "Success" },
  { value: "FAILURE", label: "Failure" },
];

const ENTITY_OPTIONS = [
  { value: "User", label: "User" },
  { value: "BankAccount", label: "Bank account" },
  { value: "Transaction", label: "Transaction" },
];

const ACTION_OPTIONS: Array<{ value: AuditAction; label: string }> = [
  { value: "REGISTER", label: "Register" },
  { value: "LOGIN", label: "Login" },
  { value: "LOGIN_FAILED", label: "Login failed" },
  { value: "LOGOUT", label: "Logout" },
  { value: "PROFILE_UPDATED", label: "Profile updated" },
  { value: "PASSWORD_CHANGED", label: "Password changed" },
  { value: "ROLE_CHANGED", label: "Role changed" },
  { value: "USER_STATUS_CHANGED", label: "User status changed" },
  { value: "ACCOUNT_OPENED", label: "Account opened" },
  { value: "ACCOUNT_STATUS_CHANGED", label: "Account status changed" },
  { value: "ACCOUNT_CLOSED", label: "Account closed" },
  { value: "TRANSACTION_CREATED", label: "Transaction created" },
  { value: "TRANSACTION_REVERSED", label: "Transaction reversed" },
  { value: "CASH_DEPOSIT", label: "Cash deposit" },
  { value: "CASH_WITHDRAWAL", label: "Cash withdrawal" },
  { value: "TRANSACTION_APPROVED", label: "Transaction approved" },
  { value: "TRANSACTION_REJECTED", label: "Transaction rejected" },
  { value: "ACCESS_DENIED", label: "Access denied" },
];

/**
 * The audit trail.
 *
 * Unlike the account and transaction lists, this query is genuinely paginated
 * on the server (`limit`/`offset`), so the filters above are sent to the API
 * rather than applied in the browser. The table then paginates the returned
 * page, which is what keeps it usable once the trail grows.
 */
export function AuditorAuditLogsPage() {
  const { notify } = useSnackbar();
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [actorInput, setActorInput] = useState("");

  const usersQuery = useQuery<{ getUsers: User[] }>(GET_USERS, {
    fetchPolicy: "cache-and-network",
  });
  const users = usersQuery.data?.getUsers ?? EMPTY;

  const logsQuery = useQuery<{ getAuditLogs: AuditLog[] }>(GET_AUDIT_LOGS, {
    variables: auditLogVariables(filters, PAGE_LIMIT, 0),
    fetchPolicy: "network-only",
  });

  const logs = logsQuery.data?.getAuditLogs ?? EMPTY;

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) map.set(user.id, fullName(user));
    return map;
  }, [users]);

  const stats = useMemo(() => {
    const failures = logs.filter((entry) => entry.outcome === "FAILURE");
    const privileged = logs.filter((entry) =>
      [
        "ROLE_CHANGED",
        "USER_STATUS_CHANGED",
        "ACCOUNT_STATUS_CHANGED",
        "ACCOUNT_CLOSED",
        "TRANSACTION_REVERSED",
        "TRANSACTION_APPROVED",
        "TRANSACTION_REJECTED",
      ].includes(entry.action)
    );
    const days = new Set(logs.map((entry) => new Date(entry.createdAt).toDateString()));
    return {
      total: logs.length,
      failures: failures.length,
      privileged: privileged.length,
      days: days.size,
    };
  }, [logs]);

  const columns = useMemo<DataTableColumn<AuditLog>[]>(
    () => [
      {
        key: "createdAt",
        header: "When",
        sortable: true,
        width: 175,
        value: (row) => new Date(row.createdAt).getTime(),
        render: (row) => (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatDateTime(row.createdAt)}
          </Typography>
        ),
      },
      {
        key: "action",
        header: "Action",
        sortable: true,
        render: (row) => (
          <StatusChip value={row.action} outcome={row.outcome} label={humanize(row.action)} />
        ),
      },
      {
        key: "outcome",
        header: "Outcome",
        sortable: true,
        width: 110,
        render: (row) => <StatusChip value={row.outcome} />,
      },
      {
        key: "actor",
        header: "Actor",
        sortable: true,
        value: (row) => (row.actorId ? (names.get(row.actorId) ?? row.actorId) : "").toLowerCase(),
        render: (row) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {row.actorId ? names.get(row.actorId) ?? "Unknown actor" : "Anonymous"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {row.actorRole ? humanize(row.actorRole) : "—"}
            </Typography>
          </Box>
        ),
      },
      {
        key: "entityType",
        header: "Subject",
        hideBelow: "md",
        render: (row) => (
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {row.entityType ? humanize(row.entityType) : "—"}
            </Typography>
            {row.entityId && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", fontFamily: "ui-monospace, Menlo, monospace" }}
              >
                {row.entityId.length > 20 ? `${row.entityId.slice(0, 18)}…` : row.entityId}
              </Typography>
            )}
          </Box>
        ),
      },
      {
        key: "reason",
        header: "Reason",
        hideBelow: "lg",
        render: (row) => (
          <Typography variant="caption" color="text.secondary">
            {row.reason ?? "—"}
          </Typography>
        ),
      },
      {
        key: "ipAddress",
        header: "Source IP",
        hideBelow: "lg",
        render: (row) => (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}
          >
            {row.ipAddress ?? "—"}
          </Typography>
        ),
      },
    ],
    [names]
  );

  const exportCsv = () => {
    const header = ["Timestamp", "Action", "Outcome", "Actor ID", "Actor role", "Entity", "Entity ID", "IP", "Reason"];
    const body = logs.map((row) =>
      [
        row.createdAt,
        row.action,
        row.outcome,
        row.actorId ?? "",
        row.actorRole ?? "",
        row.entityType ?? "",
        row.entityId ?? "",
        row.ipAddress ?? "",
        (row.reason ?? "").replace(/[\r\n]+/g, " "),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finvault-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", `Exported ${logs.length} audit entries to CSV`);
  };

  if (logsQuery.error) {
    return <ErrorState error={logsQuery.error} onRetry={() => void logsQuery.refetch()} />;
  }

  const applyActor = () => {
    const trimmed = actorInput.trim();
    setFilters((current) => ({ ...current, actorId: trimmed || undefined }));
  };

  const activeFilters =
    (filters.action ? 1 : 0) +
    (filters.outcome ? 1 : 0) +
    (filters.entityType ? 1 : 0) +
    (filters.actorId ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Append-only record of every privileged action, with the field changes it made."
        note={`Showing the most recent ${PAGE_LIMIT} entries matching the filters`}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<RefreshRounded />}
              onClick={() => void logsQuery.refetch()}
              disabled={logsQuery.loading}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlined />}
              onClick={exportCsv}
              disabled={logs.length === 0}
            >
              Export CSV
            </Button>
            <Button variant="outlined" startIcon={<PrintOutlined />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />

      <ReadOnlyBanner>
        The trail is append-only. Nothing in this console can edit or delete an entry, and
        there is no mutation on the server that writes a corrected version over an existing
        one — the correction is a new entry.
      </ReadOnlyBanner>

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Stack spacing={2}>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
              }}
            >
              <TextField
                select
                label="Action"
                value={filters.action ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    action: (event.target.value || undefined) as AuditAction | undefined,
                  }))
                }
                helperText="Server-side filter"
              >
                <option value="">All actions</option>
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>

              <TextField
                select
                label="Outcome"
                value={filters.outcome ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    outcome: event.target.value || undefined,
                  }))
                }
              >
                <option value="">All outcomes</option>
                {OUTCOME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>

              <TextField
                select
                label="Entity"
                value={filters.entityType ?? ""}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    entityType: event.target.value || undefined,
                  }))
                }
              >
                <option value="">All entities</option>
                {ENTITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>

              <TextField
                label="Actor ID"
                value={actorInput}
                onChange={(event) => setActorInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyActor();
                }}
                placeholder="UUID of the actor"
                helperText="Press Enter to apply"
                slotProps={{
                  htmlInput: { style: { fontFamily: "ui-monospace, Menlo, monospace" } },
                }}
              />
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Button size="small" variant="contained" onClick={applyActor}>
                Apply actor filter
              </Button>
              {activeFilters > 0 && (
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    setActorInput("");
                    setFilters({});
                  }}
                >
                  Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
                </Button>
              )}
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="caption" color="text.secondary">
                These filters run on the server. The table below then searches and pages
                within the returned page of {PAGE_LIMIT}.
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard label="Entries returned" value={stats.total} caption="Current filter" loading={logsQuery.loading} />
        <StatCard
          label="Failed actions"
          value={stats.failures}
          caption="Worth investigating first"
          tone={stats.failures > 0 ? "danger" : "success"}
          loading={logsQuery.loading}
        />
        <StatCard
          label="Privileged changes"
          value={stats.privileged}
          caption="Role, status, close, reverse, approve"
          tone={stats.privileged > 0 ? "warning" : "neutral"}
          loading={logsQuery.loading}
        />
        <StatCard
          label="Days covered"
          value={stats.days}
          caption={`From ${logs.length ? formatDate(logs[logs.length - 1]?.createdAt) : "—"}`}
          icon={GppGoodOutlined}
          tone="neutral"
          loading={logsQuery.loading}
        />
      </Box>

      {logsQuery.loading && logs.length === 0 ? (
        <LoadingState label="Reading the audit trail…" />
      ) : (
        <DataTable
          rows={logs}
          columns={columns}
          getRowId={(row) => row.id}
          searchKeys={["action", "outcome", "entityType", "entityId", "reason", "actorRole", "actorId"]}
          searchPlaceholder="Search the loaded page by action, entity or reason…"
          filters={[
            { key: "outcome", label: "Outcome", options: OUTCOME_OPTIONS },
            { key: "actorRole", label: "Actor role", options: [
              { value: "CUSTOMER", label: "Customer" },
              { value: "TELLER", label: "Teller" },
              { value: "AUDITOR", label: "Auditor" },
              { value: "ADMIN", label: "Admin" },
            ] },
          ]}
          onRowClick={setSelected}
          initialRowsPerPage={25}
          initialSort={{ key: "createdAt", direction: "desc" }}
          emptyTitle="No entries match"
          emptyMessage="Widen the filters above. The trail is ordered newest first and capped at the requested limit."
        />
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="caption" color="text.secondary">
        Actor names are resolved from the user directory where it is readable. Where a user
        has been removed, or this console cannot list users, the raw actor ID is shown instead
        of guessing at a name.
      </Typography>

      <AuditLogDetailDialog
        entry={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        actorName={selected?.actorId ? names.get(selected.actorId) : undefined}
      />
    </>
  );
}

export default AuditorAuditLogsPage;