import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRounded from "@mui/icons-material/TrendingDownRounded";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
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
import { formatCompactMoney, formatDate, formatMoney, humanize } from "../../utils/format";
import { describeCounterparty, directionFor } from "../../utils/transaction";
import { useSnackbar } from "../../components/common/ToastProvider";
import { useAuth } from "../../auth/AuthContext";
import { EMPTY } from "../../utils/empty";

const TRANSACTION_TYPE_FILTERS = [
  { value: "TRANSFER", label: "Transfer" },
  { value: "DEBIT", label: "Debit" },
  { value: "CREDIT", label: "Credit" },
  { value: "CASH_DEPOSIT", label: "Cash deposit" },
  { value: "CASH_WITHDRAWAL", label: "Cash withdrawal" },
];

const STATUS_FILTERS = [
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REVERSED", label: "Reversed" },
];

export function TransactionHistoryPage() {
  const { can } = useAuth();
  const { notify } = useSnackbar();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Transaction | null>(null);

  const transactionsQuery = useQuery<{ myTransactions: Transaction[] }>(MY_TRANSACTIONS);
  const accountsQuery = useQuery<{ myBankAccounts: BankAccount[] }>(MY_BANK_ACCOUNTS);

  const transactions = transactionsQuery.data?.myTransactions ?? EMPTY;
  const accounts = accountsQuery.data?.myBankAccounts ?? EMPTY;

  const accountIds = useMemo(() => new Set(accounts.map((a) => a.id)), [accounts]);
  const numbers = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.accountNumber])),
    [accounts]
  );

  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const transaction of transactions) {
      const direction = directionFor(transaction, accountIds);
      if (direction === "in") inflow += transaction.amount;
      if (direction === "out") outflow += transaction.amount;
    }
    return { inflow, outflow, count: transactions.length };
  }, [transactions, accountIds]);

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: "transactionDate",
      header: "Date",
      sortable: true,
      width: 130,
      value: (row) => new Date(row.transactionDate).getTime(),
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatDate(row.transactionDate)}
        </Typography>
      ),
    },
    {
      key: "referenceNumber",
      header: "Reference",
      width: 175,
      render: (row) => (
        <Typography
          variant="body2"
          sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "0.76rem" }}
        >
          {row.referenceNumber}
        </Typography>
      ),
    },
    {
      key: "transactionType",
      header: "Type",
      sortable: true,
      render: (row) => <StatusChip value={row.transactionType} tone="neutral" label={humanize(row.transactionType)} />,
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
      key: "channel",
      header: "Channel",
      sortable: true,
      hideBelow: "md",
      render: (row) => (
        <Typography variant="caption" color="text.secondary">
          {humanize(row.channel ?? "SELF_SERVICE")}
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
  ];

  /** Client-side CSV of the rows currently loaded. */
  const exportCsv = () => {
    const header = [
      "Reference",
      "Date",
      "Type",
      "Status",
      "Amount",
      "Currency",
      "From",
      "To",
      "Channel",
      "Description",
    ];
    const body = transactions.map((row) =>
      [
        row.referenceNumber,
        new Date(row.transactionDate).toISOString(),
        row.transactionType,
        row.status,
        row.amount.toFixed(2),
        row.currency,
        row.fromAccount?.accountNumber ?? row.fromAccountId ?? "",
        row.toAccount?.accountNumber ?? row.toAccountId ?? "",
        row.channel ?? "",
        (row.description ?? "").replace(/[\r\n]+/g, " "),
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
    anchor.download = `finvault-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", `Exported ${transactions.length} transactions to CSV`);
  };

  if (transactionsQuery.error) {
    return <ErrorState error={transactionsQuery.error} onRetry={() => void transactionsQuery.refetch()} />;
  }

  return (
    <>
      <PageHeader
        title="Transaction history"
        description="Every movement on every account you hold, newest first."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlined />}
              onClick={exportCsv}
              disabled={transactions.length === 0}
            >
              Export CSV
            </Button>
            <Button variant="outlined" startIcon={<PrintOutlined />} onClick={() => window.print()}>
              Print
            </Button>
            {can("TRANSACTION_CREATE") && (
              <Button
                variant="contained"
                startIcon={<SwapHorizRounded />}
                onClick={() => navigate("/customer/transfer")}
              >
                New transfer
              </Button>
            )}
          </>
        }
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard
          label="Total transactions"
          value={totals.count}
          caption="All time"
          icon={ReceiptLongOutlined}
          tone="neutral"
          loading={transactionsQuery.loading}
        />
        <StatCard
          label="Money in"
          value={formatCompactMoney(totals.inflow)}
          caption="Credited to your accounts"
          icon={TrendingDownRounded}
          tone="success"
          loading={transactionsQuery.loading}
        />
        <StatCard
          label="Money out"
          value={formatCompactMoney(totals.outflow)}
          caption="Debited from your accounts"
          icon={TrendingUpRounded}
          tone="danger"
          loading={transactionsQuery.loading}
        />
      </Box>

      {transactionsQuery.loading && transactions.length === 0 ? (
        <LoadingState label="Loading your transactions…" />
      ) : transactions.length === 0 ? (
        <Card>
          <EmptyState
            title="No transactions yet"
            message="Once money moves on your accounts it will appear here with its reference number, direction and status."
          />
        </Card>
      ) : (
        <DataTable
          rows={transactions}
          columns={columns}
          getRowId={(row) => row.id}
          searchKeys={["referenceNumber", "description", "transactionType", "status", "channel"]}
          searchPlaceholder="Search by reference, type or description…"
          filters={[
            { key: "transactionType", label: "Type", options: TRANSACTION_TYPE_FILTERS },
            { key: "status", label: "Status", options: STATUS_FILTERS },
          ]}
          onRowClick={setSelected}
          initialRowsPerPage={10}
          initialSort={{ key: "transactionDate", direction: "desc" }}
        />
      )}

      <TransactionDetailDialog
        transaction={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        direction={selected ? directionFor(selected, accountIds) : "neutral"}
      />

      <Box sx={{ mt: 3 }}>
        <Card>
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Typography variant="caption" color="text.secondary">
              Totals are computed from the rows loaded above: {formatMoney(totals.inflow)} in,
              {" "}
              {formatMoney(totals.outflow)} out. A transfer between two of your own
              accounts is counted as neither, because it does not change your combined
              position.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </>
  );
}

export default TransactionHistoryPage;
