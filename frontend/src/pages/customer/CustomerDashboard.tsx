import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import PendingActionsRounded from "@mui/icons-material/PendingActionsRounded";
import TrendingDownRounded from "@mui/icons-material/TrendingDownRounded";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import AddCardOutlined from "@mui/icons-material/AddCardOutlined";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import {
  AmountText,
  TransactionDetailDialog,
} from "../../components/domain/TransactionDetailDialog";
import { MY_BANK_ACCOUNTS, MY_TRANSACTIONS } from "../../graphql/operations";
import type { BankAccount, Transaction } from "../../graphql/types";
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  humanize,
  maskAccountNumber,
} from "../../utils/format";
import { describeCounterparty, directionFor } from "../../utils/transaction";
import { useAuth } from "../../auth/AuthContext";
import { EMPTY } from "../../utils/empty";

export function CustomerDashboard() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Transaction | null>(null);

  const accountsQuery = useQuery<{ myBankAccounts: BankAccount[] }>(MY_BANK_ACCOUNTS);
  const transactionsQuery = useQuery<{ myTransactions: Transaction[] }>(MY_TRANSACTIONS);

  const accounts = accountsQuery.data?.myBankAccounts ?? EMPTY;
  const transactions = transactionsQuery.data?.myTransactions ?? EMPTY;

  const accountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  const numbers = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.accountNumber])),
    [accounts]
  );

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const activeCount = accounts.filter((a) => a.status === "ACTIVE").length;
  const pendingCount = transactions.filter((t) => t.status === "PENDING").length;
  const recent = transactions.slice(0, 6);

  const loading = accountsQuery.loading || transactionsQuery.loading;
  const error = accountsQuery.error ?? transactionsQuery.error;

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: "referenceNumber",
      header: "Reference",
      width: 170,
      render: (row) => (
        <Typography sx={{ fontSize: "0.8rem", fontWeight: 600 }}>{row.referenceNumber}</Typography>
      ),
    },
    {
      key: "transactionType",
      header: "Type",
      sortable: true,
      render: (row) => (
        <Typography variant="body2">{humanize(row.transactionType)}</Typography>
      ),
    },
    {
      key: "counterparty",
      header: "Counterparty",
      render: (row) => (
        <Typography variant="body2" color="text.secondary">
          {describeCounterparty(row, numbers, accountIds)}
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
        <AmountText
          amount={row.amount}
          currency={row.currency}
          direction={directionFor(row, accountIds)}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <StatusChip value={row.status} />,
    },
    {
      key: "transactionDate",
      header: "Date",
      align: "right",
      sortable: true,
      hideBelow: "sm",
      render: (row) => (
        <Typography variant="caption" color="text.secondary">
          {formatDate(row.transactionDate)}
        </Typography>
      ),
    },
  ];

  if (error) {
    return (
      <>
        <PageHeader title={`Welcome back, ${user?.firstName ?? ""}`} />
        <ErrorState
          error={error}
          onRetry={() => {
            void accountsQuery.refetch();
            void transactionsQuery.refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ""}`}
        description="Your balances, accounts and the latest activity on them."
        actions={
          <>
            {can("ACCOUNT_READ") && (
              <Button
                variant="outlined"
                startIcon={<AddCardOutlined />}
                onClick={() => navigate("/customer/accounts")}
              >
                My accounts
              </Button>
            )}
            {can("TRANSACTION_CREATE") && (
              <Button
                variant="contained"
                startIcon={<SwapHorizRounded />}
                onClick={() => navigate("/customer/transfer")}
              >
                Transfer money
              </Button>
            )}
          </>
        }
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard
          label="Total balance"
          value={formatMoney(totalBalance)}
          caption={`Across ${accounts.length} account${accounts.length === 1 ? "" : "s"}`}
          icon={AccountBalanceWalletOutlined}
          loading={loading}
        />
        <StatCard
          label="Accounts"
          value={accounts.length}
          caption={`${activeCount} active`}
          icon={AccountBalanceOutlined}
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Awaiting approval"
          value={pendingCount}
          caption={pendingCount > 0 ? "An administrator must action these" : "Nothing queued"}
          icon={PendingActionsRounded}
          tone={pendingCount > 0 ? "warning" : "success"}
          loading={loading}
        />
        <StatCard
          label="Recent outflow"
          value={formatCompactMoney(
            recent
              .filter((t) => directionFor(t, accountIds) === "out")
              .reduce((sum, t) => sum + t.amount, 0)
          )}
          caption="Last 6 transactions"
          icon={TrendingDownRounded}
          tone="danger"
          loading={loading}
        />
      </Box>

      {/* Accounts */}
      <Typography variant="h3" sx={{ mb: 1.5 }}>
        Your accounts
      </Typography>
      {loading && accounts.length === 0 ? (
        <LoadingState label="Loading your accounts…" minHeight={160} />
      ) : accounts.length === 0 ? (
        <Card sx={{ mb: 3 }}>
          <EmptyState
            title="No bank account yet"
            message="Self-registration creates your login but not a bank account. Visit a branch and a teller will open one for you; it starts at a zero balance and is funded by a cash deposit."
            action={
              <Button variant="outlined" onClick={() => navigate("/customer/transactions")}>
                View transactions
              </Button>
            }
          />
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "repeat(3, 1fr)" },
            mb: 3,
          }}
        >
          {accounts.map((account) => (
            <AccountSummaryCard key={account.id} account={account} />
          ))}
        </Box>
      )}

      {/* Recent activity */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h3">Recent transactions</Typography>
        <Button
          size="small"
          endIcon={<ArrowForwardRounded />}
          onClick={() => navigate("/customer/transactions")}
        >
          View all
        </Button>
      </Stack>
      <DataTable
        rows={recent}
        columns={columns}
        getRowId={(row) => row.id}
        onRowClick={setSelected}
        loading={loading}
        emptyTitle="No transactions yet"
        emptyMessage="Once money moves on your accounts it will appear here."
        initialRowsPerPage={6}
      />

      <TransactionDetailDialog
        transaction={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        direction={selected ? directionFor(selected, accountIds) : "neutral"}
      />
    </>
  );
}

function AccountSummaryCard({ account }: { account: BankAccount }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography
              sx={{ fontSize: "0.82rem", fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}
            >
              {maskAccountNumber(account.accountNumber)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {humanize(account.accountType)}
            </Typography>
          </Box>
          <StatusChip value={account.status} />
        </Stack>

        <Divider sx={{ my: 1.75 }} />

        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.06em" }}>
          AVAILABLE BALANCE
        </Typography>
        <Typography sx={{ fontSize: "1.45rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          {formatMoney(account.balance, account.currency)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
          {account.ifscCode} · Opened {formatDate(account.openedAt)}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default CustomerDashboard;
