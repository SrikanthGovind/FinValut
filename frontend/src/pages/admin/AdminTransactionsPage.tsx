import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import UndoRounded from "@mui/icons-material/UndoRounded";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { ErrorState, LoadingState } from "../../components/common/States";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
  TransactionDetailDialog,
} from "../../components/domain/TransactionDetailDialog";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import { GET_TRANSACTIONS, REVERSE_TRANSACTION } from "../../graphql/operations";
import type { Transaction } from "../../graphql/types";
import { CAPABILITIES } from "../../rbac";
import {
  formatCompactMoney,
  formatDate,
  formatDateTime,
  formatMoney,
  humanize,
} from "../../utils/format";
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

/**
 * Transaction administration, and the only place a completed movement can be
 * undone.
 *
 * `reverseTransaction` takes no reason and no amount: the server posts a
 * compensating entry in the opposite direction and marks the original
 * REVERSED, which is why the dialog makes no claim about a custom narrative.
 * Both the original and the compensating row stay in the ledger.
 */
export function AdminTransactionsPage() {
  const { notify } = useSnackbar();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<Transaction | null>(null);
  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const { data, loading, error, refetch } = useQuery<{ getTransactions: Transaction[] }>(
    GET_TRANSACTIONS,
    { fetchPolicy: "cache-and-network" }
  );

  const [reverse, { loading: reversing }] = useMutation<
    { reverseTransaction: Transaction },
    { id: string }
  >(REVERSE_TRANSACTION);

  const transactions = data?.getTransactions ?? EMPTY;

  const stats = useMemo(() => {
    const completed = transactions.filter((t) => t.status === "COMPLETED");
    return {
      total: transactions.length,
      volume: completed.reduce((sum, t) => sum + t.amount, 0),
      pending: transactions.filter((t) => t.status === "PENDING").length,
      reversed: transactions.filter((t) => t.status === "REVERSED").length,
      reversable: completed.length,
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
          <StatusChip
            value={row.transactionType}
            tone="neutral"
            label={humanize(row.transactionType)}
          />
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
        key: "actions",
        header: "",
        align: "right",
        width: 110,
        render: (row) => (
          <Button
            size="small"
            color="error"
            startIcon={<UndoRounded />}
            disabled={row.status !== "COMPLETED"}
            onClick={(event) => {
              event.stopPropagation();
              setReverseTarget(row);
            }}
          >
            Reverse
          </Button>
        ),
      },
    ],
    []
  );

  const runReverse = async () => {
    if (!reverseTarget) return;
    setActionError(null);
    try {
      const result = await reverse({ variables: { id: reverseTarget.id } });
      const updated = result.data?.reverseTransaction;
      notify(
        "warning",
        `Reversed ${reverseTarget.referenceNumber}. A compensating entry was posted; both rows remain in the ledger.`
      );
      setReverseTarget(null);
      if (selected && updated && selected.id === updated.id) setSelected(updated);
      await refetch();
    } catch (caught) {
      setActionError(caught);
      notify("error", readableError(caught, "The reversal was refused."));
    }
  };

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
    anchor.download = `finvault-admin-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", `Exported ${transactions.length} transactions to CSV`);
  };

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        title="Transaction management"
        description="Every movement on record, and the authority to reverse a settled one."
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

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2.5 }}>
        A reversal does not delete anything. The server posts a compensating entry in the
        opposite direction and marks the original REVERSED, so both rows remain visible and
        the audit trail keeps the link between them.
      </Alert>

      {actionError ? (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setActionError(null)}>
          {readableError(actionError, "The reversal was refused.")}
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
        <StatCard
          label="Transactions"
          value={stats.total}
          caption="All time"
          loading={loading}
        />
        <StatCard
          label="Settled volume"
          value={formatCompactMoney(stats.volume)}
          caption="Completed movements"
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Awaiting approval"
          value={stats.pending}
          caption="Blocked from settling"
          tone={stats.pending > 0 ? "warning" : "success"}
          loading={loading}
        />
        <StatCard
          label="Reversed"
          value={stats.reversed}
          caption={`${stats.reversable} still reversible`}
          tone={stats.reversed > 0 ? "danger" : "neutral"}
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
          searchPlaceholder="Search by reference, description, type or status…"
          filters={[
            { key: "transactionType", label: "Type", options: TYPE_OPTIONS },
            { key: "status", label: "Status", options: STATUS_OPTIONS },
          ]}
          onRowClick={setSelected}
          initialRowsPerPage={25}
          initialSort={{ key: "transactionDate", direction: "desc" }}
          footerNote="Reversal is only offered on COMPLETED rows. Anything else is either still queued or already undone."
        />
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button variant="text" onClick={() => navigate("/admin/approvals")}>
          Go to the approval queue ({stats.pending})
        </Button>
      </Stack>

      <TransactionDetailDialog
        transaction={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />

      <ConfirmDialog
        open={Boolean(reverseTarget)}
        title="Reverse this transaction?"
        tone="error"
        confirmLabel="Reverse transaction"
        pending={reversing}
        message={
          <Stack spacing={1.25}>
            <Typography variant="body2">
              <strong>{reverseTarget?.referenceNumber}</strong> of{" "}
              <strong>
                {reverseTarget ? formatMoney(reverseTarget.amount, reverseTarget.currency) : ""}
              </strong>{" "}
              will be reversed.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              From{" "}
              <code>
                {reverseTarget?.fromAccount?.accountNumber ?? reverseTarget?.fromAccountId ?? "—"}
              </code>{" "}
              to{" "}
              <code>
                {reverseTarget?.toAccount?.accountNumber ?? reverseTarget?.toAccountId ?? "—"}
              </code>
              , recorded {reverseTarget ? formatDateTime(reverseTarget.transactionDate) : ""}.
            </Typography>
            <Typography variant="caption" sx={{ color: "error.main" }}>
              This posts a compensating entry and marks the original REVERSED. It cannot be
              undone from this console — the two rows stay in the ledger permanently. Capability
              used: {CAPABILITIES.TRANSACTION_REVERSE}.
            </Typography>
          </Stack>
        }
        onConfirm={() => void runReverse()}
        onClose={() => setReverseTarget(null)}
      />
    </>
  );
}

export default AdminTransactionsPage;