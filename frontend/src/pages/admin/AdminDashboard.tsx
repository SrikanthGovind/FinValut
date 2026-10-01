import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import ApprovalOutlined from "@mui/icons-material/ApprovalOutlined";
import PendingActionsRounded from "@mui/icons-material/PendingActionsRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { RoleChip, StatusChip } from "../../components/common/StatusChip";
import { EmptyState, LoadingState } from "../../components/common/States";
import { AmountText } from "../../components/domain/TransactionDetailDialog";
import {
  GET_BANK_ACCOUNTS,
  GET_PENDING_APPROVALS,
  GET_TRANSACTIONS,
  GET_USERS,
} from "../../graphql/operations";
import type { BankAccount, Transaction, User } from "../../graphql/types";
import { useAuth } from "../../auth/AuthContext";
import {
  formatCompactMoney,
  formatDateTime,
  formatMoney,
  fullName,
  humanize,
} from "../../utils/format";
import { EMPTY } from "../../utils/empty";

/**
 * Administrator home.
 *
 * The approval queue is the only thing here that is time-critical, so it leads:
 * every other tile is context for it. The queue query refetches on an interval
 * because a teller can add to it while this page is open, and a stale count is
 * worse than no count on a screen whose purpose is deciding.
 */
export function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const approvalsQuery = useQuery<{ getPendingApprovals: Transaction[] }>(
    GET_PENDING_APPROVALS,
    {
      fetchPolicy: "network-only",
      pollInterval: 30_000,
      errorPolicy: "all",
    }
  );
  const usersQuery = useQuery<{ getUsers: User[] }>(GET_USERS, {
    fetchPolicy: "cache-and-network",
  });
  const accountsQuery = useQuery<{ getBankAccounts: BankAccount[] }>(GET_BANK_ACCOUNTS, {
    fetchPolicy: "cache-and-network",
  });
  const transactionsQuery = useQuery<{ getTransactions: Transaction[] }>(GET_TRANSACTIONS, {
    fetchPolicy: "cache-and-network",
  });

  const queue = approvalsQuery.data?.getPendingApprovals ?? EMPTY;
  const users = usersQuery.data?.getUsers ?? EMPTY;
  const accounts = accountsQuery.data?.getBankAccounts ?? EMPTY;
  const transactions = transactionsQuery.data?.getTransactions ?? EMPTY;

  const loading =
    approvalsQuery.loading ||
    usersQuery.loading ||
    accountsQuery.loading ||
    transactionsQuery.loading;

  const stats = useMemo(() => {
    const settled = transactions.filter((t) => t.status === "COMPLETED");
    return {
      queueValue: queue.reduce((sum, t) => sum + t.amount, 0),
      deposits: accounts
        .filter((a) => a.status !== "CLOSED")
        .reduce((sum, a) => sum + a.balance, 0),
      customers: users.filter((u) => u.role === "CUSTOMER").length,
      staff: users.filter((u) => u.role !== "CUSTOMER").length,
      lockedAccounts: accounts.filter((a) => a.status === "FROZEN" || a.status === "CLOSED")
        .length,
      volumeToday: settled
        .filter((t) => isToday(t.transactionDate))
        .reduce((sum, t) => sum + t.amount, 0),
      settledToday: settled.filter((t) => isToday(t.transactionDate)).length,
    };
  }, [queue, accounts, users, transactions]);

  const queueColumns: DataTableColumn<Transaction>[] = [
    {
      key: "referenceNumber",
      header: "Reference",
      width: 175,
      render: (row) => (
        <Typography
          variant="body2"
          sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "0.76rem", fontWeight: 700 }}
        >
          {row.referenceNumber}
        </Typography>
      ),
    },
    {
      key: "transactionType",
      header: "Type",
      sortable: true,
      render: (row) => (
        <StatusChip value={row.transactionType} tone="neutral" label={humanize(row.transactionType)} />
      ),
    },
    {
      key: "account",
      header: "Account",
      hideBelow: "sm",
      render: (row) => (
        <Typography
          variant="caption"
          sx={{ fontFamily: "ui-monospace, Menlo, monospace", color: "text.secondary" }}
        >
          {row.fromAccount?.accountNumber ?? row.fromAccountId ?? "—"}
        </Typography>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (row) => row.amount,
      render: (row) => (
        <AmountText amount={row.amount} currency={row.currency} direction="neutral" />
      ),
    },
    {
      key: "transactionDate",
      header: "Raised",
      align: "right",
      sortable: true,
      hideBelow: "md",
      value: (row) => new Date(row.transactionDate).getTime(),
      render: (row) => (
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(row.transactionDate)}
        </Typography>
      ),
    },
  ];

  const staffColumns: DataTableColumn<User>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      value: (row) => fullName(row).toLowerCase(),
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={700}>
            {fullName(row)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.email}
          </Typography>
        </Box>
      ),
    },
    { key: "role", header: "Role", sortable: true, render: (row) => <RoleChip value={row.role} /> },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <StatusChip value={row.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Operations · ${user?.firstName ?? ""}`}
        description="Platform health, and the queue of decisions only you can make."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<ApprovalOutlined />}
              onClick={() => navigate("/admin/approvals")}
            >
              Approval queue{queue.length > 0 ? ` (${queue.length})` : ""}
            </Button>
            <Button
              variant="contained"
              startIcon={<GroupsOutlined />}
              onClick={() => navigate("/admin/users")}
            >
              Manage users
            </Button>
          </>
        }
      />

      {approvalsQuery.error && (
        <Alert severity="warning" sx={{ mb: 2.5 }}>
          The approval queue could not be read:{" "}
          {approvalsQuery.error.message}. That query needs{" "}
          <code>TRANSACTION_APPROVE</code>, which this session's role should hold — if you
          see this, your token may have been issued before a role change.
        </Alert>
      )}

      {/* Approval queue first: it is the only actionable item here. */}
      <Typography variant="h3" sx={{ mb: 1.5 }}>
        Needs your decision
      </Typography>

      {approvalsQuery.loading && queue.length === 0 ? (
        <Box sx={{ mb: 3 }}>
          <LoadingState label="Reading the approval queue…" minHeight={160} />
        </Box>
      ) : queue.length === 0 ? (
        <Card sx={{ mb: 3 }}>
          <EmptyState
            title="The approval queue is clear"
            message="Nothing is waiting above the automatic thresholds. Transfers under 1,00,000 and cash withdrawals under 50,000 settle on submission without an administrator."
            icon={<ApprovalOutlined sx={{ fontSize: 36 }} />}
            action={
              <Button variant="outlined" onClick={() => navigate("/admin/transactions")}>
                Review all transactions
              </Button>
            }
          />
        </Card>
      ) : (
        <Box sx={{ mb: 3 }}>
          <Alert severity="warning" icon={<PendingActionsRounded />} sx={{ mb: 2 }}>
            <strong>
              {queue.length} transaction{queue.length === 1 ? "" : "s"} worth{" "}
              {formatMoney(stats.queueValue)}
            </strong>{" "}
            {queue.length === 1 ? "is" : "are"} queued. Each one is above the amount that
            settles automatically, and each is blocked until you approve or reject it.
          </Alert>

          <DataTable
            rows={queue}
            columns={queueColumns}
            getRowId={(row) => row.id}
            onRowClick={() => navigate("/admin/approvals")}
            initialRowsPerPage={5}
            initialSort={{ key: "amount", direction: "desc" }}
            emptyTitle="Queue is empty"
            loading={approvalsQuery.loading}
            footerNote="Open the approval queue to decide on any of these."
          />
        </Box>
      )}

      <Typography variant="h3" sx={{ mb: 1.5 }}>
        Platform
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard
          label="Funds held"
          value={formatCompactMoney(stats.deposits)}
          caption={`${accounts.length} account(s), closed excluded`}
          icon={AccountBalanceWalletOutlined}
          loading={loading}
        />
        <StatCard
          label="Users"
          value={users.length}
          caption={`${stats.customers} customer(s), ${stats.staff} staff`}
          icon={GroupsOutlined}
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Transactions today"
          value={stats.settledToday}
          caption={formatCompactMoney(stats.volumeToday)}
          icon={ReceiptLongOutlined}
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Locked accounts"
          value={stats.lockedAccounts}
          caption="Frozen or closed"
          icon={WarningAmberRounded}
          tone={stats.lockedAccounts > 0 ? "warning" : "success"}
          loading={loading}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.4fr) minmax(0, 1fr)" },
          alignItems: "start",
        }}
      >
        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h4">Staff accounts</Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardRounded />}
                onClick={() => navigate("/admin/users")}
              >
                All users
              </Button>
            </Stack>

            {users.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No users loaded yet.
              </Typography>
            ) : (
              <DataTable
                rows={users.filter((u) => u.role !== "CUSTOMER")}
                columns={staffColumns}
                getRowId={(row) => row.id}
                initialRowsPerPage={5}
                initialSort={{ key: "role", direction: "asc" }}
                emptyTitle="No staff accounts"
                emptyMessage="Everyone registered so far is a customer."
                footerNote="Shown here because staff accounts are the ones that can act on other people's money."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="h4" sx={{ mb: 1.5 }}>
              Administration
            </Typography>
            <Stack spacing={1}>
              <AdminLink
                to="/admin/users"
                label="User management"
                body="Create logins, change roles, block access."
              />
              <AdminLink
                to="/admin/accounts"
                label="Bank accounts"
                body="Freeze, unfreeze, dormancy and closure."
              />
              <AdminLink
                to="/admin/transactions"
                label="Transactions"
                body="Reverse a settled movement."
              />
              <AdminLink
                to="/admin/roles"
                label="Roles & permissions"
                body="What each role is allowed to do."
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Chip size="small" variant="outlined" label="Every action is audit-logged" />
              <Chip size="small" variant="outlined" label="Audit is append-only" />
              <Chip size="small" variant="outlined" label="No self-approval" />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="caption" color="text.secondary">
              Your role holds every capability, including reading unmasked identity documents.
              There is nothing this console will refuse you. That is why the audit trail
              exists and why it cannot be edited from here.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </>
  );
}

function AdminLink({ to, label, body }: { to: string; label: string; body: string }) {
  const navigate = useNavigate();
  return (
    <Box
      onClick={() => navigate(to)}
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        transition: "border-color 120ms",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="body2" fontWeight={700}>
          {label}
        </Typography>
        <ArrowForwardRounded sx={{ fontSize: 16, color: "text.disabled" }} />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {body}
      </Typography>
    </Box>
  );
}

/** Local so the dashboard does not import a hook-shaped helper for one check. */
function isToday(value: string, now: Date = new Date()): boolean {
  const date = new Date(value);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default AdminDashboard;