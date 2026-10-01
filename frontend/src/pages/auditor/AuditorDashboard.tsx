import { useMemo } from "react";
import { useQuery } from "@apollo/client";
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
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { StatusChip } from "../../components/common/StatusChip";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { LoadingState } from "../../components/common/States";
import { ReadOnlyBanner } from "../../components/common/ConfirmDialog";
import {
  GET_AUDIT_LOGS,
  GET_BANK_ACCOUNTS,
  GET_TRANSACTIONS,
  GET_USERS,
} from "../../graphql/operations";
import type { AuditLog, BankAccount, Transaction, User } from "../../graphql/types";
import { useAuth } from "../../auth/AuthContext";
import {
  formatCompactMoney,
  formatDateTime,
  formatMoney,
  humanize,
} from "../../utils/format";
import { EMPTY } from "../../utils/empty";

/**
 * Auditor home.
 *
 * Every figure here is computed client-side from the four system-wide lists the
 * AUDITOR role is allowed to read. There are no aggregate queries on the server,
 * and inventing "system totals" endpoints would be worse than a page that
 * visibly adds up what it fetched.
 *
 * The role is read-only by design, so nothing here mutates — that is stated on
 * the page rather than implied by the absence of buttons.
 */
export function AuditorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const accountsQuery = useQuery<{ getBankAccounts: BankAccount[] }>(GET_BANK_ACCOUNTS);
  const transactionsQuery = useQuery<{ getTransactions: Transaction[] }>(GET_TRANSACTIONS);
  const usersQuery = useQuery<{ getUsers: User[] }>(GET_USERS);
  const auditQuery = useQuery<{ getAuditLogs: AuditLog[] }>(GET_AUDIT_LOGS, {
    variables: { limit: 200 },
    fetchPolicy: "cache-and-network",
  });

  const accounts = accountsQuery.data?.getBankAccounts ?? EMPTY;
  const transactions = transactionsQuery.data?.getTransactions ?? EMPTY;
  const users = usersQuery.data?.getUsers ?? EMPTY;
  const auditLogs = auditQuery.data?.getAuditLogs ?? EMPTY;

  const loading =
    accountsQuery.loading ||
    transactionsQuery.loading ||
    usersQuery.loading ||
    auditQuery.loading;

  const stats = useMemo(() => {
    const deposits = transactions.filter((t) => t.transactionType === "CASH_DEPOSIT");
    const withdrawals = transactions.filter((t) => t.transactionType === "CASH_WITHDRAWAL");
    const flagged = accounts.filter((a) => a.status !== "ACTIVE");
    const failures = auditLogs.filter((entry) => entry.outcome === "FAILURE");

    return {
      totalBalance: accounts.reduce((sum, a) => sum + a.balance, 0),
      frozenOrClosed: flagged.length,
      customerCount: users.filter((u) => u.role === "CUSTOMER").length,
      staffCount: users.filter((u) => u.role !== "CUSTOMER").length,
      blockedUsers: users.filter((u) => u.status !== "ACTIVE").length,
      depositVolume: deposits.reduce((sum, t) => sum + t.amount, 0),
      withdrawalVolume: withdrawals.reduce((sum, t) => sum + t.amount, 0),
      pendingApprovals: transactions.filter((t) => t.status === "PENDING").length,
      reversed: transactions.filter((t) => t.status === "REVERSED").length,
      failures: failures.length,
    };
  }, [accounts, transactions, users, auditLogs]);

  const recentAudit: DataTableColumn<AuditLog>[] = [
    {
      key: "createdAt",
      header: "When",
      sortable: true,
      width: 170,
      value: (row) => new Date(row.createdAt).getTime(),
      render: (row) => (
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(row.createdAt)}
        </Typography>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (row) => <StatusChip value={row.action} outcome={row.outcome} />,
    },
    {
      key: "actorRole",
      header: "Actor role",
      sortable: true,
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {row.actorRole ? humanize(row.actorRole) : "—"}
        </Typography>
      ),
    },
    {
      key: "entityType",
      header: "Subject",
      hideBelow: "md",
      render: (row) => (
        <Typography variant="caption" color="text.secondary">
          {row.entityType ? `${humanize(row.entityType)} ${row.entityId ?? ""}`.trim() : "—"}
        </Typography>
      ),
    },
    {
      key: "outcome",
      header: "Outcome",
      sortable: true,
      render: (row) => <StatusChip value={row.outcome} />,
    },
  ];

  const largestAccounts = [...accounts]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Oversight · ${user?.firstName ?? ""}`}
        description="System-wide totals and the control posture of the platform."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<FactCheckOutlined />}
              onClick={() => navigate("/auditor/audit-logs")}
            >
              Audit logs
            </Button>
            <Button
              variant="contained"
              startIcon={<VisibilityOutlined />}
              onClick={() => navigate("/auditor/accounts")}
            >
              Review accounts
            </Button>
          </>
        }
      />

      <ReadOnlyBanner>
        The Auditor role holds no write capability: no account can be frozen or closed, no
        transaction reversed, and no user role changed from this console. Everything below is
        derived from the same records you can open in full on the other three screens.
      </ReadOnlyBanner>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard
          label="Total deposits held"
          value={formatCompactMoney(stats.totalBalance)}
          caption={`${accounts.length} account(s) across all holders`}
          icon={AccountBalanceWalletOutlined}
          loading={loading}
        />
        <StatCard
          label="Cash deposit volume"
          value={formatCompactMoney(stats.depositVolume)}
          caption="All time, counter channel"
          icon={ReceiptLongOutlined}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Cash paid out"
          value={formatCompactMoney(stats.withdrawalVolume)}
          caption="All time, counter channel"
          icon={ReceiptLongOutlined}
          tone="warning"
          loading={loading}
        />
        <StatCard
          label="Cash net position"
          value={formatCompactMoney(stats.depositVolume - stats.withdrawalVolume)}
          caption="Deposits minus withdrawals"
          icon={AccountBalanceWalletOutlined}
          tone="neutral"
          loading={loading}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard
          label="Customers"
          value={stats.customerCount}
          caption={`${stats.staffCount} staff account(s)`}
          icon={GroupsOutlined}
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Accounts not active"
          value={stats.frozenOrClosed}
          caption="Frozen, dormant or closed"
          icon={LockOutlined}
          tone={stats.frozenOrClosed > 0 ? "warning" : "success"}
          loading={loading}
        />
        <StatCard
          label="Users not active"
          value={stats.blockedUsers}
          caption="Inactive or blocked logins"
          icon={GroupsOutlined}
          tone={stats.blockedUsers > 0 ? "danger" : "success"}
          loading={loading}
        />
        <StatCard
          label="Control exceptions"
          value={stats.failures + stats.reversed}
          caption={`${stats.failures} failed action(s), ${stats.reversed} reversed transaction(s)`}
          icon={ErrorOutlineRounded}
          tone={stats.failures + stats.reversed > 0 ? "danger" : "success"}
          loading={loading}
        />
      </Box>

      {accountsQuery.error || transactionsQuery.error || auditQuery.error ? (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          One of the system-wide queries was refused or failed. The tiles above fall back to
          zero where their source did not load — open the individual screen to see the
          server's message.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.6fr) minmax(0, 1fr)" },
          alignItems: "start",
        }}
      >
        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h4">Largest balances held</Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardRounded />}
                onClick={() => navigate("/auditor/accounts")}
              >
                All accounts
              </Button>
            </Stack>

            {largestAccounts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No accounts have been opened yet.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {largestAccounts.map((account) => {
                  const share =
                    stats.totalBalance > 0
                      ? (account.balance / stats.totalBalance) * 100
                      : 0;
                  return (
                    <Box key={account.id}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700 }}
                        >
                          {account.accountNumber}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight={700}>
                            {formatMoney(account.balance, account.currency)}
                          </Typography>
                          <StatusChip value={account.status} />
                        </Stack>
                      </Stack>
                      <Box
                        sx={{
                          mt: 0.5,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: "background.default",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            width: `${Math.min(Math.max(share, 1), 100)}%`,
                            height: "100%",
                            bgcolor: "primary.main",
                          }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {share.toFixed(1)}% of total held
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="caption" color="text.secondary">
              Percentages are of the sum of all account balances returned by the server. If an
              account is frozen its money is still counted here, because a freeze blocks
              movement — it does not move the balance.
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="h4" sx={{ mb: 1.5 }}>
              What an auditor should check
            </Typography>
            <Stack spacing={1.25}>
              <ChecklistItem
                done={stats.failures === 0}
                label={`${stats.failures} failed privileged action(s) in the last 200 audit entries`}
                to="/auditor/audit-logs"
              />
              <ChecklistItem
                done={stats.pendingApprovals === 0}
                label={`${stats.pendingApprovals} transaction(s) awaiting administrator approval`}
                to="/auditor/transactions"
              />
              <ChecklistItem
                done={stats.reversed === 0}
                label={`${stats.reversed} reversed transaction(s) needing a matching entry`}
                to="/auditor/transactions"
              />
              <ChecklistItem
                done={stats.frozenOrClosed === 0}
                label={`${stats.frozenOrClosed} account(s) frozen, dormant or closed`}
                to="/auditor/accounts"
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="caption" color="text.secondary">
              The Auditor role reads the account and transaction bases in full but cannot
              change them. That is the separation of duties: the same person must never both
              perform and approve a privileged action, so approval lives with Admin alone.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="h3">Recent audit trail</Typography>
          <Button
            size="small"
            endIcon={<ArrowForwardRounded />}
            onClick={() => navigate("/auditor/audit-logs")}
          >
            Full trail
          </Button>
        </Stack>

        {auditQuery.loading && auditLogs.length === 0 ? (
          <LoadingState label="Loading the audit trail…" minHeight={180} />
        ) : (
          <DataTable
            rows={auditLogs.slice(0, 10)}
            columns={recentAudit}
            getRowId={(row) => row.id}
            initialRowsPerPage={10}
            initialSort={{ key: "createdAt", direction: "desc" }}
            emptyTitle="No audit entries"
            emptyMessage="Nothing has been recorded yet, or this role cannot read the trail."
          />
        )}
      </Box>
    </>
  );
}

function ChecklistItem({
  done,
  label,
  to,
}: {
  done: boolean;
  label: string;
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      onClick={() => navigate(to)}
      sx={{
        p: 1.25,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Box
        sx={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontSize: "0.68rem",
          fontWeight: 800,
          color: "#FFF",
          bgcolor: done ? "#0E7C66" : "#C0392B",
          flexShrink: 0,
        }}
      >
        {done ? "✓" : "!"}
      </Box>
      <Typography variant="caption" sx={{ flexGrow: 1, lineHeight: 1.5 }}>
        {label}
      </Typography>
      <ArrowForwardRounded sx={{ fontSize: 16, color: "text.disabled" }} />
    </Stack>
  );
}

export default AuditorDashboard;