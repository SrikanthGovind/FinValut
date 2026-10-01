import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import BlockRounded from "@mui/icons-material/BlockRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ApprovalOutlined from "@mui/icons-material/ApprovalOutlined";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
  AmountText,
  TransactionDetailDialog,
} from "../../components/domain/TransactionDetailDialog";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import {
  APPROVE_TRANSACTION,
  GET_PENDING_APPROVALS,
  REJECT_TRANSACTION,
} from "../../graphql/operations";
import type { Transaction } from "../../graphql/types";
import { formatDateTime, formatMoney, humanize } from "../../utils/format";
import { EMPTY } from "../../utils/empty";

/**
 * The approval queue.
 *
 * Queued transactions are the ones above the server's thresholds — 50,000 for a
 * cash withdrawal, 1,00,000 for a transfer — so every row here is already
 * material money. `approveTransaction` takes no argument beyond the id;
 * `rejectTransaction` requires a reason, and that reason is stored on the
 * transaction, so the dialog will not let it be empty.
 *
 * This is the only queue in the system: a teller can raise a request but cannot
 * clear it, which is the separation of duties the whole approval step exists
 * for.
 */
export function AdminApprovalsPage() {
  const { notify } = useSnackbar();

  const [selected, setSelected] = useState<Transaction | null>(null);
  const [approveTarget, setApproveTarget] = useState<Transaction | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Transaction | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);

  const { data, loading, error, refetch } = useQuery<{ getPendingApprovals: Transaction[] }>(
    GET_PENDING_APPROVALS,
    {
      fetchPolicy: "network-only",
      // The sidebar badge polls the same query, so this page should not sit on
      // a stale queue while an operator works through it.
      pollInterval: 30_000,
    }
  );

  const [approve, approveState] = useMutation<
    { approveTransaction: Transaction },
    { id: string }
  >(APPROVE_TRANSACTION);
  const [reject, rejectState] = useMutation<
    { rejectTransaction: Transaction },
    { transactionId: string; reason: string }
  >(REJECT_TRANSACTION);

  const queue = data?.getPendingApprovals ?? EMPTY;

  const stats = useMemo(() => {
    const withdrawals = queue.filter((t) => t.transactionType === "CASH_WITHDRAWAL");
    const transfers = queue.filter((t) => t.transactionType !== "CASH_WITHDRAWAL");
    const value = queue.reduce((sum, t) => sum + t.amount, 0);
    return {
      total: queue.length,
      value,
      withdrawals: withdrawals.length,
      transfers: transfers.length,
      largest: [...queue].sort((a, b) => b.amount - a.amount)[0] ?? null,
    };
  }, [queue]);

  const columns: DataTableColumn<Transaction>[] = [
    {
      key: "transactionDate",
      header: "Raised",
      sortable: true,
      width: 160,
      value: (row) => new Date(row.transactionDate).getTime(),
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatDateTime(row.transactionDate)}
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
      key: "raisedBy",
      header: "Raised by",
      hideBelow: "md",
      render: (row) => (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}
        >
          {row.tellerId ? `${row.tellerId.slice(0, 8)}…` : row.channel ? humanize(row.channel) : "—"}
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
      key: "actions",
      header: "Decision",
      align: "right",
      width: 190,
      render: (row) => (
        <Stack
          direction="row"
          spacing={0.5}
          justifyContent="flex-end"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            size="small"
            color="inherit"
            startIcon={<BlockRounded />}
            onClick={() => {
              setRejectTarget(row);
              setReason("");
            }}
          >
            Reject
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<CheckCircleOutlineRounded />}
            onClick={() => setApproveTarget(row)}
          >
            Approve
          </Button>
        </Stack>
      ),
    },
  ];

  const decide = async (transaction: Transaction, action: "approve" | "reject", why?: string) => {
    setActionError(null);
    try {
      if (action === "approve") {
        const result = await approve({ variables: { id: transaction.id } });
        const updated = result.data?.approveTransaction;
        notify(
          "success",
          `${transaction.referenceNumber} approved. The money moves now, and the approval is written to the audit trail against your account.`
        );
        if (updated && selected?.id === updated.id) setSelected(updated);
      } else {
        const result = await reject({
          variables: { transactionId: transaction.id, reason: why ?? "" },
        });
        const updated = result.data?.rejectTransaction;
        notify(
          "warning",
          `${transaction.referenceNumber} rejected. The teller who raised it sees the reason.`
        );
        if (updated && selected?.id === updated.id) setSelected(updated);
      }
      setRejectTarget(null);
      setApproveTarget(null);
      setReason("");
      await refetch();
    } catch (caught) {
      setActionError(caught);
      notify("error", readableError(caught, "The decision was refused."));
    }
  };

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const pending = approveState.loading || rejectState.loading;

  return (
    <>
      <PageHeader
        title="Approval queue"
        description="Transfers and withdrawals above the automatic thresholds, waiting on a decision."
        note="Approving settles the money immediately. Rejecting records your reason against the transaction."
        actions={
          <Button variant="outlined" onClick={() => void refetch()} disabled={loading}>
            Refresh queue
          </Button>
        }
      />

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2.5 }}>
        Amounts above {formatMoney(50_000)} for a cash withdrawal or {formatMoney(1_00_000)} for
        a transfer are queued instead of settling. The thresholds live in{" "}
        <code>backend/src/modules/Transactions/dto/staff.dto.ts</code> and are enforced there, not
        here.
      </Alert>

      {actionError ? (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setActionError(null)}>
          {readableError(actionError, "The decision was refused.")}
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
          label="Awaiting decision"
          value={stats.total}
          caption={stats.total === 0 ? "Queue is empty" : "Settlement is blocked"}
          icon={ApprovalOutlined}
          tone={stats.total > 0 ? "warning" : "success"}
          loading={loading}
        />
        <StatCard
          label="Value on hold"
          value={formatMoney(stats.value)}
          caption="Sum of queued amounts"
          tone="primary"
          loading={loading}
        />
        <StatCard
          label="Withdrawals / transfers"
          value={`${stats.withdrawals} / ${stats.transfers}`}
          caption="Counter vs self-service"
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Largest request"
          value={stats.largest ? formatMoney(stats.largest.amount, stats.largest.currency) : "—"}
          caption={
            stats.largest
              ? humanize(stats.largest.transactionType)
              : "Nothing queued"
          }
          tone={stats.largest ? "danger" : "success"}
          loading={loading}
        />
      </Box>

      {loading && queue.length === 0 ? (
        <LoadingState label="Reading the approval queue…" />
      ) : queue.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing is waiting for approval"
            message="Every transfer under the threshold settled on submission, and every queued one has been decided. This queue refills automatically when a teller or customer raises an amount above the limit."
            icon={<ApprovalOutlined sx={{ fontSize: 36 }} />}
          />
        </Card>
      ) : (
        <DataTable
          rows={queue}
          columns={columns}
          getRowId={(row) => row.id}
          searchKeys={["referenceNumber", "transactionType", "description", "fromAccountId", "tellerId"]}
          searchPlaceholder="Search the queue by reference, type or account…"
          onRowClick={setSelected}
          initialRowsPerPage={10}
          initialSort={{ key: "amount", direction: "desc" }}
          footerNote="Click any row to inspect the full transaction before deciding on it."
        />
      )}

      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Typography variant="h4" sx={{ mb: 1 }}>
            Why this queue exists
          </Typography>
          <Typography variant="body2" color="text.secondary">
            A request above the threshold is parked in PENDING and settles when an administrator
            decides on it. The person who raised the request cannot clear it, and an auditor can
            only read the outcome — so no single identity can both create and approve a
            movement of this size. Every approval and rejection writes a TRANSACTION_APPROVED or
            TRANSACTION_REJECTED entry naming the approver.
          </Typography>
        </CardContent>
      </Card>

      <TransactionDetailDialog
        transaction={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />

      <Dialog
        open={Boolean(rejectTarget)}
        onClose={pending ? undefined : () => setRejectTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject this transaction</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Rejecting <strong>{rejectTarget?.referenceNumber}</strong> for{" "}
              <strong>
                {rejectTarget ? formatMoney(rejectTarget.amount, rejectTarget.currency) : ""}
              </strong>
              . The reason is stored on the transaction and shown to whoever raised it, so it
              should be something they can act on.
            </Typography>

            <TextField
              label="Reason"
              required
              multiline
              minRows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Beneficiary account number does not match the customer's instruction"
              error={reason.length > 0 && reason.trim().length < 10}
              helperText={
                reason.length > 0 && reason.trim().length < 10
                  ? "Give the raiser enough to act on."
                  : "Recorded as TRANSACTION_REJECTED."
              }
            />

            <Divider />

            <Typography variant="caption" color="text.secondary">
              Rejection is final for this transaction. The money does not move, and the account
              balance is unchanged. If the request was legitimate, a new transaction must be
              raised.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setRejectTarget(null)} disabled={pending}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={pending || reason.trim().length < 10}
            onClick={() => {
              if (rejectTarget) void decide(rejectTarget, "reject", reason.trim());
            }}
          >
            {pending ? "Recording…" : "Reject with reason"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="Approve this transaction?"
        tone="primary"
        confirmLabel="Approve and settle"
        pending={pending}
        message={
          <Stack spacing={1.25}>
            <Typography variant="body2">
              <strong>{approveTarget?.referenceNumber}</strong> of{" "}
              <strong>
                {approveTarget ? formatMoney(approveTarget.amount, approveTarget.currency) : ""}
              </strong>{" "}
              will settle immediately.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              From{" "}
              <code>
                {approveTarget?.fromAccount?.accountNumber ?? approveTarget?.fromAccountId ?? "—"}
              </code>{" "}
              to{" "}
              <code>
                {approveTarget?.toAccount?.accountNumber ?? approveTarget?.toAccountId ?? "—"}
              </code>
              .
            </Typography>
            <Typography variant="caption" color="text.secondary">
              There is no second step after this: the money leaves the account as soon as the
              server accepts. If the beneficiary has not been confirmed with the requester,
              reject it instead.
            </Typography>
          </Stack>
        }
        onConfirm={() => {
          if (approveTarget) void decide(approveTarget, "approve");
        }}
        onClose={() => setApproveTarget(null)}
      />
    </>
  );
}

export default AdminApprovalsPage;