import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import { InlineError } from "../../components/common/States";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import CustomerSelect from "../../components/domain/CustomerSelect";
import { CustomerSummary } from "../../components/domain/CustomerSummary";
import { CUSTOMER_RECENT_KEY, isUuid, useRecentIds } from "../../hooks/useRecentIds";
import {
  GET_USERS,
  OPEN_ACCOUNT_FOR_CUSTOMER,
} from "../../graphql/operations";
import type { AccountType, BankAccount, User } from "../../graphql/types";
import { humanize } from "../../utils/format";
import { CAPABILITIES } from "../../rbac";
import { useAuth } from "../../auth/AuthContext";

const ACCOUNT_TYPES: AccountType[] = ["SAVINGS", "CURRENT", "SALARY", "FIXED_DEPOSIT"];

/**
 * Opens an account for a customer who has already signed up.
 *
 * This uses `openAccountForCustomer` rather than `createBankAccount`: the
 * self-service mutation always assigns the caller as owner and takes an opening
 * balance from them, which is not what happens at a counter. The DTO for the
 * counter path has no `initialBalance` field at all — a branch-opened account
 * starts at zero and is funded by a cash deposit.
 */
export function OpenAccountPage() {
  const { can } = useAuth();
  const { notify } = useSnackbar();
  const navigate = useNavigate();
  const { recent, remember } = useRecentIds(CUSTOMER_RECENT_KEY);

  const [customer, setCustomer] = useState<User | null>(null);
  const [manualId, setManualId] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("SAVINGS");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [created, setCreated] = useState<BankAccount | null>(null);

  const directoryAllowed = can(CAPABILITIES.USER_READ);
  const { data: usersData } = useQuery<{ getUsers: User[] }>(GET_USERS, {
    skip: !directoryAllowed,
    fetchPolicy: "cache-and-network",
  });
  const customers = usersData?.getUsers?.filter((user) => user.role === "CUSTOMER") ?? [];

  const [openAccount, { loading }] = useMutation<
    { openAccountForCustomer: BankAccount },
    { customerId: string; accountType: AccountType; currency: string }
  >(OPEN_ACCOUNT_FOR_CUSTOMER);

  const resolvedCustomerId = customer?.id ?? manualId.trim();
  const idValid = customer !== null || isUuid(manualId);
  const canReview = idValid && !loading;

  const reset = () => {
    setCustomer(null);
    setManualId("");
    setCreated(null);
    setSubmitError(null);
    setConfirmOpen(false);
  };

  const submit = async () => {
    setConfirmOpen(false);
    setSubmitError(null);
    try {
      const result = await openAccount({
        variables: {
          customerId: resolvedCustomerId,
          accountType,
          currency: "INR",
        },
      });
      const account = result.data?.openAccountForCustomer;
      setCreated(account ?? null);
      remember(resolvedCustomerId, customer ? customer.email : undefined);
      notify(
        "success",
        `Account ${account?.accountNumber ?? ""} opened. Fund it with a cash deposit.`
      );
    } catch (caught) {
      setSubmitError(caught);
      notify("error", readableError(caught, "Could not open the account."));
    }
  };

  if (created) {
    return (
      <>
        <PageHeader
          title="Account opened"
          description="The account exists. It starts at a zero balance and needs funding."
        />
        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Stack spacing={2.5} alignItems="center" sx={{ textAlign: "center" }}>
              <CheckCircleRounded color="success" sx={{ fontSize: 48 }} />
              <Box>
                <Typography variant="h2">{created.accountNumber}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {humanize(created.accountType)} · {created.ifscCode} · branch{" "}
                  {created.branchCode}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", justifyContent: "center" }}>
                <Button
                  variant="contained"
                  onClick={() => navigate("/teller/deposit")}
                >
                  Fund it with a cash deposit
                </Button>
                <Button variant="outlined" onClick={reset}>
                  Open another account
                </Button>
                <Button variant="text" onClick={() => navigate("/teller")}>
                  Back to dashboard
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 520 }}>
                The opening was written to the audit trail as ACCOUNT_OPENED with the
                account number, owner and type. Because the account starts at zero,
                the money that funds it always arrives as a separate, attributable cash
                deposit.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Open a bank account"
        description="For a customer who has already registered. The account opens at a zero balance."
      />

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

              {directoryAllowed ? (
                <CustomerSelect
                  users={customers}
                  value={customer}
                  onChange={(user) => {
                    setCustomer(user);
                    setManualId("");
                    setSubmitError(null);
                  }}
                  label="Customer"
                  restrictToRole="CUSTOMER"
                  helperText="Only active customers can hold a bank account."
                />
              ) : (
                <Alert severity="info" icon={<InfoOutlinedIcon />}>
                  Your role cannot browse the customer directory, so enter the customer's
                  user ID. It is on their registration record; ask them for it, or read it
                  from the branch copy.
                </Alert>
              )}

              {!directoryAllowed && (
                <TextField
                  fullWidth
                  label="Customer user ID"
                  value={manualId}
                  onChange={(event) => {
                    setManualId(event.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  error={manualId.length > 0 && !isUuid(manualId)}
                  helperText={
                    manualId.length > 0 && !isUuid(manualId)
                      ? "That is not a UUID."
                      : "The account will be owned by this user."
                  }
                  slotProps={{
                    htmlInput: { style: { fontFamily: "ui-monospace, Menlo, monospace" } },
                  }}
                />
              )}

              {recent.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    RECENT CUSTOMERS
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.75, flexWrap: "wrap", rowGap: 1 }}>
                    {recent.map((entry) => (
                      <Chip
                        key={entry.id}
                        size="small"
                        variant="outlined"
                        label={entry.label || `${entry.id.slice(0, 8)}…`}
                        onClick={() => {
                          setManualId(entry.id);
                          setCustomer(null);
                        }}
                      />
                    ))}
                  </Stack>
                </Box>
              )}

              <TextField
                select
                fullWidth
                label="Account type"
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as AccountType)}
              >
                {ACCOUNT_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {humanize(type)}
                  </MenuItem>
                ))}
              </TextField>

              <Alert severity="warning">
                There is no opening-balance field here on purpose. A branch-opened account
                is funded by the branch, not by the person standing at the counter, so an
                opening balance would be a request to mint money that never passed
                through any account. Fund it afterwards with a cash deposit.
              </Alert>

              <Divider />

              <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                <Button color="inherit" onClick={reset} disabled={loading}>
                  Reset
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AccountBalanceOutlined />}
                  disabled={!canReview}
                  onClick={() => setConfirmOpen(true)}
                >
                  {loading ? "Opening…" : "Review and open"}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Summary
            </Typography>
            <Stack spacing={1.25}>
              <SummaryRow
                label="Owner"
                value={customer ? customer.email : resolvedCustomerId || "—"}
                mono={!customer}
              />
              <SummaryRow label="Account type" value={humanize(accountType)} />
              <SummaryRow label="Opening balance" value="₹0.00" />
              <SummaryRow label="Currency" value="INR" />
              <SummaryRow label="Status on open" value="Active" />
            </Stack>

            {customer && (
              <>
                <Divider sx={{ my: 2 }} />
                <CustomerSummary user={customer} />
              </>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
              Account number, branch code and IFSC are generated by the server, so they
              cannot be entered by hand and cannot collide.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <ConfirmDialog
        open={confirmOpen}
        title="Open this account?"
        confirmLabel="Open account"
        message={
          <Stack spacing={1}>
            <Typography variant="body2">
              A <strong>{humanize(accountType)}</strong> account will be opened for{" "}
              {customer ? customer.email : resolvedCustomerId} at a zero balance.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              The account number and IFSC are generated now and cannot be changed. The
              opening is recorded in the audit trail.
            </Typography>
          </Stack>
        }
        onConfirm={() => void submit()}
        onClose={() => setConfirmOpen(false)}
      />
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
          wordBreak: "break-all",
          ...(mono
            ? { fontFamily: "ui-monospace, Menlo, monospace", fontSize: "0.74rem" }
            : {}),
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export default OpenAccountPage;
