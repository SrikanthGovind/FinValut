import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { Box, Button, Typography } from "@mui/material";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { ErrorState, LoadingState } from "../../components/common/States";
import { ReadOnlyBanner } from "../../components/common/ConfirmDialog";
import { TransactionDetailDialog } from "../../components/domain/TransactionDetailDialog";
import { GET_TRANSACTIONS } from "../../graphql/operations";
import type { Transaction } from "../../graphql/types";
import { useSnackbar } from "../../components/common/ToastProvider";
import { formatCompactMoney, formatDate, formatDateTime, formatMoney, humanize } from "../../utils/format";
import { EMPTY } from "../../utils/empty";

const TYPE_OPTIONS = [
  { value: "TRANSFER", label: "Transfer" },
  { value: "DEBIT", label: "Debit" },
  { value: "CREDIT", label: "Credit" },
  { value: "CASH_DEPOSIT", label: "Cash deposit" },
  { value: "CASH_WITHDRAWAL", label: "Cash withdrawal" },
];

const STATUS_OPTIONS = [
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "REVERSED", label: "Reversed" },
];

const CHANNEL_OPTIONS = [
  { value: "SELF_SERVICE", label: "Self service" },
  { value: "COUNTER", label: "Counter" },
  { value: "SYSTEM", label: "System" },
];

/**
 * Every transaction in the system, read-only.
 *
 * Amounts are shown unsigned and greyed rather than signed green/red: "money in"
 * only means something relative to an account, and this console spans every
 * account. The from/to pair carries the direction instead.
 */
export function AuditorTransactionsPage() {
  const { notify } = useSnackbar();
  const [selected, setSelected] = useState<Transaction | null>(null);

  const { data, loading, error, refetch } = useQuery<{ getTransactions: Transaction[] }>(
    GET_TRANSACTIONS,
    { fetchPolicy: "cache-and-network" }
  );

  const transactions = data?.getTransactions ?? EMPTY;

  const stats = useMemo(() => {
    const volume = transactions
      .filter((t) => t.status === "COMPLETED")
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      total: transactions.length,
      volume,
      pending: transactions.filter((t) => t.status === "PENDING").length,
      failed: transactions.filter((t) => t.status === "FAILED").length,
      reversed: transactions.filter((t) => t.status === "REVERSED").length,
    };
  }, [transactions]);

  const columns = useMemo<DataTableColumn<Transaction>[]>(
    () => [
      {
        key: "transactionDate",
        header: "When",
        sortable: true,
        width: 160,
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
        render: (row) => (
          <StatusChip value={row.transactionType} tone="neutral" label={humanize(row.transactionType)} />
        ),
      },
      {
        key: "from",
        header: "From",
        hideBelow: "sm",
        render: (row) => (
          <Typography
            variant="caption"
            sx={{ fontFamily: "ui-monospace, Menlo, monospace", color: "text.secondary" }}
          >
            {row.fromAccount?.accountNumber ?? row.fromAccountId ?? "External"}
          </Typography>
        ),
      },
      {
        key: "to",
        header: "To",
        hideBelow: "sm",
        render: (row) => (
          <Typography
            variant="caption"
            sx={{ fontFamily: "ui-monospace, Menlo, monospace", color: "text.secondary" }}
          >
            {row.toAccount?.accountNumber ?? row.toAccountId ?? "External"}
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
            {humanize(row.channel ?? "—")}
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
          <Typography variant="body2" fontWeight={700}>
            {formatMoney(row.amount, row.currency)}
          </Typography>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (row) => <StatusChip value={row.status} />,
      },
      {
        key: "tellerId",
        header: "Teller",
        hideBelow: "lg",
        render: (row) => (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}
          >
            {row.tellerId ? `${row.tellerId.slice(0, 8)}…` : "—"}
          </Typography>
        ),
      },
    ],
    []
  );

  const exportCsv = () => {
    const header = [
      "Reference",
      "Transaction date",
      "Type",
      "Status",
      "Amount",
      "Currency",
      "From",
      "To",
      "Channel",
      "Teller",
      "Approved by",
      "Description",
    ];
    const body = transactions.map((row) =>
      [
        row.referenceNumber,
        row.transactionDate,
        row.transactionType,
        row.status,
        row.amount.toFixed(2),
        row.currency,
        row.fromAccount?.accountNumber ?? row.fromAccountId ?? "",
        row.toAccount?.accountNumber ?? row.toAccountId ?? "",
        row.channel ?? "",
        row.tellerId ?? "",
        row.approvedById ?? "",
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
    anchor.download = `finvault-all-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", `Exported ${transactions.length} transactions to CSV`);
  };

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        title="All transactions"
        description="Every recorded movement across every account, as the ledger recorded it."
        note={`${transactions.length} transaction(s) returned by getTransactions`}
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
          </>
        }
      />

      <ReadOnlyBanner>
        Reversal requires TRANSACTION_REVERSE, which Auditor does not hold. Flag a
        suspicious transaction by raising it with an administrator; the reversal and its reason
        will then appear in the audit trail against your request.
      </ReadOnlyBanner>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard label="Transactions" value={stats.total} caption="All time" loading={loading} />
        <StatCard
          label="Completed volume"
          value={formatCompactMoney(stats.volume)}
          caption="Sum of settled amounts"
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Awaiting approval"
          value={stats.pending}
          caption="Queued for an administrator"
          tone={stats.pending > 0 ? "warning" : "success"}
          loading={loading}
        />
        <StatCard
          label="Failed / reversed"
          value={`${stats.failed} / ${stats.reversed}`}
          caption="Needs explanation in the trail"
          tone={stats.failed + stats.reversed > 0 ? "danger" : "success"}
          loading={loading}
        />
      </Box>

      {loading && transactions.length === 0 ? (
        <LoadingState label="Loading the transaction ledger…" />
      ) : (
        <DataTable
          rows={transactions}
          columns={columns}
          getRowId={(row) => row.id}
          searchKeys={["referenceNumber", "description", "transactionType", "status", "channel"]}
          searchPlaceholder="Search by reference, description, channel or type…"
          filters={[
            { key: "transactionType", label: "Type", options: TYPE_OPTIONS },
            { key: "status", label: "Status", options: STATUS_OPTIONS },
            { key: "channel", label: "Channel", options: CHANNEL_OPTIONS },
          ]}
          onRowClick={setSelected}
          initialRowsPerPage={25}
          initialSort={{ key: "transactionDate", direction: "desc" }}
          footerNote={`Last recorded movement: ${
            transactions[0] ? formatDateTime(transactions[0].createdAt) : "none"
          }`}
        />
      )}

      <TransactionDetailDialog
        transaction={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

export default AuditorTransactionsPage;