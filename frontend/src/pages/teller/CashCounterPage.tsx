import { useState } from "react";
import { useMutation } from "@apollo/client";
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
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import PageHeader from "../../components/common/PageHeader";
import { InlineError } from "../../components/common/States";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import { ACCOUNT_RECENT_KEY, isUuid, useRecentIds } from "../../hooks/useRecentIds";
import { CASH_DEPOSIT, CASH_WITHDRAWAL } from "../../graphql/operations";
import type { Transaction } from "../../graphql/types";
import { formatMoney, humanize } from "../../utils/format";

/** Mirrors `CASH_WITHDRAWAL_APPROVAL_THRESHOLD` in the backend DTO module. */
const WITHDRAWAL_APPROVAL_THRESHOLD = 50_000;

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 25000, 50000];

interface CounterFormState {
  accountId: string;
  holder: string;
  amount: string;
  tellerReference: string;
  description: string;
}

const EMPTY: CounterFormState = {
  accountId: "",
  holder: "",
  amount: "",
  tellerReference: "",
  description: "",
};

interface CashCounterPageProps {
  mode: "deposit" | "withdrawal";
}

/**
 * One form, two operations.
 *
 * Deposit and withdrawal differ only in direction and in the approval
 * threshold, so sharing the component keeps the two screens from drifting. Both
 * act on an account the teller does not own, which the server permits under
 * TRANSACTION_CASH and refuses for a customer under every role.
 */
export function CashCounterPage({ mode }: CashCounterPageProps) {
  const isDeposit = mode === "deposit";
  const { notify } = useSnackbar();
  const { recent, remember } = useRecentIds(ACCOUNT_RECENT_KEY);

  const [form, setForm] = useState<CounterFormState>(EMPTY);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const [deposit, depositState] = useMutation<
    { cashDeposit: Transaction },
    { accountId: string; amount: number; tellerReference?: string; description?: string }
  >(CASH_DEPOSIT);

  const [withdraw, withdrawState] = useMutation<
    { cashWithdrawal: Transaction },
    { accountId: string; amount: number; tellerReference?: string; description?: string }
  >(CASH_WITHDRAWAL);

  const submitting = depositState.loading || withdrawState.loading;

  const accountIdValid = isUuid(form.accountId);
  const numericAmount = Number(form.amount);
  const amountValid = Number.isFinite(numericAmount) && numericAmount >= 1;
  const needsApproval =
    !isDeposit && amountValid && numericAmount > WITHDRAWAL_APPROVAL_THRESHOLD;

  const update = (key: keyof CounterFormState) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSubmitError(null);
  };

  const problems: string[] = [];
  if (form.accountId && !accountIdValid) {
    problems.push("Account ID must be a UUID, for example 3f2b…-…-….");
  }
  if (form.amount !== "" && !amountValid) problems.push("Amount must be at least 1.");
  if (form.tellerReference.length > 64) problems.push("Counter reference is limited to 64 characters.");

  const canReview =
    accountIdValid && amountValid && problems.length === 0 && !submitting;

  const submit = async () => {
    setConfirmOpen(false);
    setSubmitError(null);
    const variables = {
      accountId: form.accountId.trim(),
      amount: numericAmount,
      ...(form.tellerReference.trim() ? { tellerReference: form.tellerReference.trim() } : {}),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
    };

    try {
      // Branches rather than a ternary over a union: the two mutations have
      // different result shapes, and only one runs per submit.
      const created = isDeposit
        ? (await deposit({ variables })).data?.cashDeposit
        : (await withdraw({ variables })).data?.cashWithdrawal;

      remember(form.accountId.trim(), form.holder.trim() || undefined);

      if (created?.status === "PENDING") {
        notify(
          "warning",
          `Queued for administrator approval. Reference ${created.referenceNumber}. No balance has moved yet.`
        );
      } else {
        notify(
          "success",
          `${isDeposit ? "Deposit" : "Withdrawal"} of ${formatMoney(numericAmount)} recorded · ${created?.referenceNumber ?? ""}`
        );
      }

      setForm((current) => ({ ...EMPTY, accountId: current.accountId, holder: current.holder }));
    } catch (caught) {
      setSubmitError(caught);
      notify("error", readableError(caught, "The counter operation was rejected."));
    }
  };

  return (
    <>
      <PageHeader
        title={isDeposit ? "Cash deposit" : "Cash withdrawal"}
        description={
          isDeposit
            ? "Accept physical cash into a customer's account. Credited immediately and stamped with your ID."
            : "Pay physical cash out of a customer's account. Above the threshold it waits for administrator approval."
        }
      />

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2.5 }}>
        The API identifies accounts by UUID only — there is no lookup by account number.
        Read the ID from the customer's record, or pick one of the accounts you have
        served recently.
      </Alert>

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
            <Stack spacing={2.5}>
              {submitError ? <InlineError error={submitError} /> : null}

              {recent.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    RECENTLY SERVED
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.75, flexWrap: "wrap", rowGap: 1 }}>
                    {recent.map((entry) => (
                      <Chip
                        key={entry.id}
                        size="small"
                        variant="outlined"
                        label={entry.label || `${entry.id.slice(0, 8)}…`}
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            accountId: entry.id,
                            holder: entry.label ?? current.holder,
                          }));
                          setSubmitError(null);
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              <TextField
                fullWidth
                label="Customer account ID"
                value={form.accountId}
                onChange={(event) => update("accountId")(event.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                error={form.accountId.length > 0 && !accountIdValid}
                helperText={
                  form.accountId.length > 0 && !accountIdValid
                    ? "That is not a UUID."
                    : "UUID of the account receiving or paying out the cash."
                }
                slotProps={{ htmlInput: { style: { fontFamily: "ui-monospace, Menlo, monospace" } } }}
              />

              <TextField
                fullWidth
                label="Customer name (for your reference)"
                value={form.holder}
                onChange={(event) => update("holder")(event.target.value)}
                helperText="Kept in this browser only, to label the account ID above. Never sent to the server."
              />

              <Box>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={form.amount}
                  onChange={(event) => update("amount")(event.target.value)}
                  slotProps={{
                    htmlInput: { min: 1, step: 1 },
                    input: {
                      startAdornment: (
                        <Typography sx={{ mr: 1, color: "text.secondary", fontWeight: 700 }}>
                          INR
                        </Typography>
                      ),
                    },
                  }}
                  helperText={
                    !isDeposit && needsApproval
                      ? "Above ₹50,000 this is queued for administrator approval."
                      : "Whole rupees, minimum ₹1."
                  }
                />
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}>
                  {QUICK_AMOUNTS.map((value) => (
                    <Chip
                      key={value}
                      size="small"
                      label={formatMoney(value)}
                      variant={form.amount === String(value) ? "filled" : "outlined"}
                      color={form.amount === String(value) ? "primary" : "default"}
                      onClick={() => update("amount")(String(value))}
                    />
                  ))}
                </Stack>
              </Box>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  fullWidth
                  label="Counter / till reference"
                  value={form.tellerReference}
                  onChange={(event) => update("tellerReference")(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 64 } }}
                  helperText="Optional. Up to 64 characters."
                />
                <TextField
                  fullWidth
                  label="Description"
                  value={form.description}
                  onChange={(event) => update("description")(event.target.value)}
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                  helperText="Optional. Defaults to the counter reference."
                />
              </Stack>

              {needsApproval && (
                <Alert severity="warning" icon={<WarningAmberRounded />}>
                  {formatMoney(numericAmount)} is above the ₹50,000 counter limit. The
                  transaction is recorded as <strong>PENDING</strong> and the balance is
                  only debited once an administrator approves it.
                </Alert>
              )}

              <Divider />

              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button
                  color="inherit"
                  onClick={() => {
                    setForm(EMPTY);
                    setSubmitError(null);
                  }}
                  disabled={submitting}
                >
                  Clear
                </Button>
                <Button
                  variant="contained"
                  startIcon={
                    isDeposit ? <PaymentsOutlined /> : <CreditCardOutlined />
                  }
                  disabled={!canReview}
                  onClick={() => setConfirmOpen(true)}
                >
                  {isDeposit ? "Review deposit" : "Review withdrawal"}
                </Button>
              </Stack>

              {problems.length > 0 && (
                <Box>
                  {problems.map((problem) => (
                    <Typography key={problem} variant="caption" color="error" sx={{ display: "block" }}>
                      • {problem}
                    </Typography>
                  ))}
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              What happens next
            </Typography>
            <Stack spacing={1.5}>
              {[
                isDeposit
                  ? "The destination account is locked and credited inside one database transaction."
                  : "The source account is locked and its balance checked before any cash is paid.",
                isDeposit
                  ? "A CASH_DEPOSIT row is written with channel COUNTER and your teller ID."
                  : "A CASH_WITHDRAWAL row is written with channel COUNTER and your teller ID.",
                needsApproval
                  ? "Above the threshold, no balance moves until an administrator approves it."
                  : "The balance moves immediately and the row is marked COMPLETED.",
                "Either way the attempt is written to the audit trail, and a rejection is recorded too.",
              ].map((step, index) => (
                <Stack key={step} direction="row" spacing={1.25} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      bgcolor: index === 0 ? "primary.main" : "background.default",
                      color: index === 0 ? "#FFF" : "text.secondary",
                      fontSize: "0.66rem",
                      fontWeight: 800,
                      flexShrink: 0,
                      mt: 0.25,
                      border: index === 0 ? 0 : "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {step}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ my: 2.5 }} />

            <Typography variant="caption" color="text.secondary">
              Operation type recorded: <strong>{humanize(isDeposit ? "CASH_DEPOSIT" : "CASH_WITHDRAWAL")}</strong>.
              Both are gated by <strong>TRANSACTION_CASH</strong>, which no customer role
              holds.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <ConfirmDialog
        open={confirmOpen}
        title={isDeposit ? "Confirm cash deposit" : "Confirm cash withdrawal"}
        confirmLabel={isDeposit ? "Accept deposit" : "Pay out"}
        tone={isDeposit ? "primary" : "warning"}
        message={
          <Stack spacing={1}>
            <Typography variant="body2">
              {isDeposit ? "Credit" : "Debit"}{" "}
              <strong>{formatMoney(numericAmount || 0)}</strong>{" "}
              {isDeposit ? "into" : "from"} account{" "}
              <code style={{ fontSize: "0.76rem" }}>
                {form.accountId.trim() || "—"}
              </code>
              .
            </Typography>
            {form.holder && (
              <Typography variant="body2" color="text.secondary">
                Customer: {form.holder}
              </Typography>
            )}
            {needsApproval && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                This is above the counter limit, so it will be queued rather than paid out.
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary">
              This cannot be edited afterwards. A mistake is corrected by reversing the
              transaction, which is an admin action.
            </Typography>
          </Stack>
        }
        onConfirm={() => void submit()}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

export function CashDepositPage() {
  return <CashCounterPage mode="deposit" />;
}

export function CashWithdrawalPage() {
  return <CashCounterPage mode="withdrawal" />;
}

export default CashCounterPage;
