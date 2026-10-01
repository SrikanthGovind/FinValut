import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import { InlineError } from "../../components/common/States";
import AccountSelect from "../../components/domain/AccountSelect";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import { CREATE_TRANSACTION, MY_BANK_ACCOUNTS } from "../../graphql/operations";
import type { BankAccount, Transaction } from "../../graphql/types";
import { formatMoney, humanize } from "../../utils/format";

/**
 * Mirrors `TRANSFER_APPROVAL_THRESHOLD` in
 * `backend/src/modules/Transactions/dto/staff.dto.ts`.
 *
 * The UI shows the consequence before submitting rather than after, because
 * above the threshold nothing moves until an administrator acts and the
 * balance is untouched in the meantime.
 */
const TRANSFER_APPROVAL_THRESHOLD = 1_00_000;

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000, 25000];

export function TransferMoneyPage() {
  const navigate = useNavigate();
  const { notify } = useSnackbar();

  const { data, error: accountsError, refetch } = useQuery<{
    myBankAccounts: BankAccount[];
  }>(MY_BANK_ACCOUNTS);

  const [from, setFrom] = useState<BankAccount | null>(null);
  const [to, setTo] = useState<BankAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState<unknown>(null);

  const accounts = data?.myBankAccounts ?? [];

  const [createTransaction, { loading: submitting }] = useMutation<
    { createTransaction: Transaction },
    {
      fromAccountId: string;
      toAccountId: string;
      transactionType: "TRANSFER";
      amount: number;
      currency: string;
      description?: string;
    }
  >(CREATE_TRANSACTION);

  const numericAmount = Number(amount);
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0;
  const needsApproval =
    amountValid && numericAmount > TRANSFER_APPROVAL_THRESHOLD;

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!from) list.push("Choose the account money leaves from.");
    if (!to) list.push("Choose the account money arrives in.");
    if (from && to && from.id === to.id) {
      list.push("Source and destination must be different accounts.");
    }
    if (amount !== "" && !amountValid) list.push("Enter an amount greater than zero.");
    if (from && amountValid && numericAmount > from.balance) {
      list.push(
        `Amount exceeds the available balance of ${formatMoney(from.balance, from.currency)}.`
      );
    }
    return list;
  }, [from, to, amount, amountValid, numericAmount]);

  const canSubmit = problems.length === 0 && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !from || !to) return;
    setSubmitError(null);

    try {
      const result = await createTransaction({
        variables: {
          fromAccountId: from.id,
          toAccountId: to.id,
          transactionType: "TRANSFER",
          amount: numericAmount,
          currency: from.currency,
          ...(description.trim() ? { description: description.trim() } : {}),
        },
      });
      const created = result.data?.createTransaction;
      if (needsApproval) {
        notify(
          "warning",
          "Transfer queued. It settles once an administrator approves it."
        );
      } else {
        notify("success", `Transferred ${formatMoney(numericAmount, from.currency)}`);
      }
      void refetch();
      setAmount("");
      setDescription("");
      setTo(null);
      if (created) {
        navigate("/customer/transactions");
      }
    } catch (caught) {
      setSubmitError(caught);
      notify("error", readableError(caught, "The transfer was rejected."));
    }
  };

  if (accountsError) {
    return <InlineError error={accountsError} fallback="Could not load your accounts." />;
  }

  return (
    <>
      <PageHeader
        title="Transfer money"
        description="Move money between accounts you hold. Transfers settle immediately unless they need approval."
      />

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.4fr) minmax(0, 1fr)" },
          alignItems: "start",
        }}
      >
        <Card component="form" onSubmit={handleSubmit} noValidate>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Stack spacing={2.5}>
              {submitError ? <InlineError error={submitError} /> : null}

              <AccountSelect
                accounts={accounts}
                value={from}
                onChange={(account) => {
                  setFrom(account);
                  setSubmitError(null);
                }}
                label="From account"
                helperText={
                  from
                    ? `Available ${formatMoney(from.balance, from.currency)}`
                    : "Only active accounts can send money"
                }
              />

              <AccountSelect
                accounts={accounts}
                value={to}
                onChange={(account) => {
                  setTo(account);
                  setSubmitError(null);
                }}
                label="To account"
                helperText="Destination account in your name"
              />

              <Box>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  slotProps={{
                    htmlInput: { min: 1, step: 1 },
                    input: {
                      startAdornment: (
                        <Typography sx={{ mr: 1, color: "text.secondary", fontWeight: 700 }}>
                          {from?.currency ?? "INR"}
                        </Typography>
                      ),
                    },
                  }}
                  helperText={
                    needsApproval
                      ? "Above ₹1,00,000 this is queued for administrator approval."
                      : "Whole rupees. Minimum ₹1."
                  }
                />
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}>
                  {QUICK_AMOUNTS.map((value) => (
                    <Chip
                      key={value}
                      size="small"
                      label={formatMoney(value)}
                      variant={amount === String(value) ? "filled" : "outlined"}
                      color={amount === String(value) ? "primary" : "default"}
                      onClick={() => setAmount(String(value))}
                    />
                  ))}
                  {from && (
                    <Chip
                      size="small"
                      label="Full balance"
                      variant="outlined"
                      onClick={() => setAmount(String(Math.floor(from.balance)))}
                    />
                  )}
                </Stack>
              </Box>

              <TextField
                fullWidth
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                helperText="Optional. Appears on both accounts' statements."
                slotProps={{ htmlInput: { maxLength: 255 } }}
              />

              {needsApproval && (
                <Alert severity="warning" icon={<WarningAmberRounded />}>
                  {formatMoney(numericAmount, from?.currency ?? "INR")} is above the
                  approval threshold. The transfer will be created as{" "}
                  <strong>PENDING</strong> and no balance changes until an administrator
                  approves it.
                </Alert>
              )}

              <Divider />

              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                  onClick={() => {
                    setFrom(null);
                    setTo(null);
                    setAmount("");
                    setDescription("");
                    setSubmitError(null);
                  }}
                  color="inherit"
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SwapHorizRounded />}
                  disabled={!canSubmit}
                >
                  {submitting
                    ? "Submitting…"
                    : needsApproval
                      ? "Request transfer"
                      : "Transfer now"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Summary
            </Typography>
            <Stack spacing={1.25}>
              <SummaryRow label="From" value={from?.accountNumber ?? "—"} mono />
              <SummaryRow label="To" value={to?.accountNumber ?? "—"} mono />
              <SummaryRow
                label="Amount"
                value={
                  amountValid && from
                    ? formatMoney(numericAmount, from.currency)
                    : "—"
                }
              />
              <SummaryRow
                label="Type"
                value={humanize(needsApproval ? "PENDING" : "TRANSFER")}
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1} alignItems="flex-start">
              <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.disabled", mt: 0.25 }} />
              <Typography variant="caption" color="text.secondary">
                Transfers between your own accounts move the money without changing your
                combined balance. The server checks both accounts are active, that they
                differ, and that the source holds enough.
              </Typography>
            </Stack>

            {problems.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" fontWeight={700} color="error" sx={{ display: "block", mb: 0.5 }}>
                  Before you can submit
                </Typography>
                {problems.map((problem) => (
                  <Typography key={problem} variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    • {problem}
                  </Typography>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          textAlign: "right",
          ...(mono ? { fontFamily: "ui-monospace, Menlo, monospace", fontSize: "0.78rem" } : {}),
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export default TransferMoneyPage;
