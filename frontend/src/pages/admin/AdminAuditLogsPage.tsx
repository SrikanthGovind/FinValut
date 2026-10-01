import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { ErrorState, LoadingState } from "../../components/common/States";
import { AuditLogDetailDialog } from "../../components/domain/TransactionDetailDialog";
import { useSnackbar } from "../../components/common/ToastProvider";
import { GET_AUDIT_LOGS, GET_USERS } from "../../graphql/operations";
import type { AuditAction, AuditLog, User } from "../../graphql/types";
import { formatDate, formatDateTime, fullName, humanize } from "../../utils/format";
import { auditLogVariables } from "../../utils/audit";
import { EMPTY } from "../../utils/empty";

const PAGE_LIMIT = 200;

const ACTION_OPTIONS: Array<{ value: AuditAction; label: string }> = [
  { value: "ROLE_CHANGED", label: "Role changed" },
  { value: "USER_STATUS_CHANGED", label: "User status changed" },
  { value: "ACCOUNT_OPENED", label: "Account opened" },
  { value: "ACCOUNT_STATUS_CHANGED", label: "Account status changed" },
  { value: "ACCOUNT_CLOSED", label: "Account closed" },
  { value: "TRANSACTION_REVERSED", label: "Transaction reversed" },
  { value: "TRANSACTION_APPROVED", label: "Transaction approved" },
  { value: "TRANSACTION_REJECTED", label: "Transaction rejected" },
  { value: "LOGIN_FAILED", label: "Login failed" },
  { value: "ACCESS_DENIED", label: "Access denied" },
  { value: "PASSWORD_CHANGED", label: "Password changed" },
];

const OUTCOME_OPTIONS = [
  { value: "SUCCESS", label: "Success" },
  { value: "FAILURE", label: "Failure" },
];

const PRIVILEGED_ACTIONS: AuditAction[] = [
  "ROLE_CHANGED",
  "USER_STATUS_CHANGED",
  "ACCOUNT_STATUS_CHANGED",
  "ACCOUNT_CLOSED",
  "TRANSACTION_REVERSED",
  "TRANSACTION_APPROVED",
  "TRANSACTION_REJECTED",
];

/**
 * The administrator's view of the audit trail.
 *
 * Deliberately the same query and shape as the auditor's page: the trail is a
 * compliance artefact, and two differently-rendered copies of the same records
 * would be worse than one. The difference is intent — the admin view is for
 * checking their own actions after the fact.
 */
export function AdminAuditLogsPage() {
  const { notify } = useSnackbar();
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [action, setAction] = useState<AuditAction | "">("");
  const [outcome, setOutcome] = useState("");
  const [onlyPrivileged, setOnlyPrivileged] = useState(false);

  const usersQuery = useQuery<{ getUsers: User[] }>(GET_USERS, {
    fetchPolicy: "cache-and-network",
  });

  const logsQuery = useQuery<{ getAuditLogs: AuditLog[] }>(GET_AUDIT_LOGS, {
    variables: auditLogVariables({ action, outcome }, PAGE_LIMIT, 0),
    fetchPolicy: "network-only",
  });

  const raw = logsQuery.data?.getAuditLogs ?? EMPTY;
  const logs = useMemo(
    () => (onlyPrivileged ? raw.filter((entry) => PRIVILEGED_ACTIONS.includes(entry.action)) : raw),
    [raw, onlyPrivileged]
  );

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of usersQuery.data?.getUsers ?? []) map.set(user.id, fullName(user));
    return map;
  }, [usersQuery.data]);

  const stats = useMemo(() => {
    return {
      total: logs.length,
      failures: logs.filter((entry) => entry.outcome === "FAILURE").length,
      privileged: logs.filter((entry) => PRIVILEGED_ACTIONS.includes(entry.action)).length,
      days: new Set(logs.map((entry) => new Date(entry.createdAt).toDateString())).size,
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
        value: (row) =>
          (row.actorId ? names.get(row.actorId) ?? row.actorId : "").toLowerCase(),
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
                {row.entityId.length > 22 ? `${row.entityId.slice(0, 20)}…` : row.entityId}
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
    const header = [
      "Timestamp",
      "Action",
      "Outcome",
      "Actor ID",
      "Actor role",
      "Entity",
      "Entity ID",
      "IP",
      "Reason",
    ];
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
    anchor.download = `finvault-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", `Exported ${logs.length} audit entries to CSV`);
  };

  if (logsQuery.error) {
    return <ErrorState error={logsQuery.error} onRetry={() => void logsQuery.refetch()} />;
  }

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="Every privileged action taken on this platform, with the field changes it made."
        note={`Most recent ${PAGE_LIMIT} entries matching the filters`}
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

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
            <TextField
              select
              label="Action"
              value={action}
              onChange={(event) => setAction(event.target.value as AuditAction | "")}
              sx={{ minWidth: 240 }}
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
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              sx={{ minWidth: 180 }}
            >
              <option value="">All outcomes</option>
              {OUTCOME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </TextField>

            <Button
              variant={onlyPrivileged ? "contained" : "outlined"}
              onClick={() => setOnlyPrivileged((value) => !value)}
            >
              {onlyPrivileged ? "Showing privileged only" : "Privileged actions only"}
            </Button>

            <Box sx={{ flexGrow: 1 }} />

            {(action || outcome || onlyPrivileged) && (
              <Button
                color="inherit"
                onClick={() => {
                  setAction("");
                  setOutcome("");
                  setOnlyPrivileged(false);
                }}
              >
                Clear
              </Button>
            )}
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
        <StatCard
          label="Entries"
          value={stats.total}
          caption="Current filter"
          loading={logsQuery.loading}
        />
        <StatCard
          label="Failed actions"
          value={stats.failures}
          caption="Denied or errored"
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
          caption={logs.length ? `From ${formatDate(logs[logs.length - 1]?.createdAt)}` : "—"}
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
            {
              key: "actorRole",
              label: "Actor role",
              options: [
                { value: "CUSTOMER", label: "Customer" },
                { value: "TELLER", label: "Teller" },
                { value: "AUDITOR", label: "Auditor" },
                { value: "ADMIN", label: "Admin" },
              ],
            },
          ]}
          onRowClick={setSelected}
          initialRowsPerPage={25}
          initialSort={{ key: "createdAt", direction: "desc" }}
          emptyTitle="No entries match"
          emptyMessage="Widen the filters above. The trail is capped at the requested limit, so an empty result usually means the filter is too narrow rather than that nothing happened."
        />
      )}

      <AuditLogDetailDialog
        entry={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        actorName={selected?.actorId ? names.get(selected.actorId) : undefined}
      />
    </>
  );
}

export default AdminAuditLogsPage;