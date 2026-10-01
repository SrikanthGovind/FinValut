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
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { StatusChip } from "../../components/common/StatusChip";
import { readableError } from "../../components/common/ToastProvider";
import { MY_BANK_ACCOUNTS } from "../../graphql/operations";
import type { BankAccount } from "../../graphql/types";
import { CAPABILITIES, ROLE_CAPABILITIES } from "../../rbac";
import { formatMoney, humanize } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";
import { EMPTY } from "../../utils/empty";

/** Mirrors `CASH_WITHDRAWAL_APPROVAL_THRESHOLD` in the backend DTO module. */
const WITHDRAWAL_APPROVAL_THRESHOLD = 50_000;

const QUICK_ACTIONS = [
  {
    to: "/teller/deposit",
    label: "Cash deposit",
    body: "Accept physical cash into a customer's account.",
    icon: PaymentsOutlined,
    capability: CAPABILITIES.TRANSACTION_CASH,
  },
  {
    to: "/teller/withdrawal",
    label: "Cash withdrawal",
    body: "Pay physical cash out, with the ₹50,000 counter limit.",
    icon: CreditCardOutlined,
    capability: CAPABILITIES.TRANSACTION_CASH,
  },
  {
    to: "/teller/open-account",
    label: "Open account",
    body: "Open an account for a customer who has registered.",
    icon: AccountBalanceOutlined,
    capability: CAPABILITIES.ACCOUNT_CREATE,
  },
  {
    to: "/teller/customers",
    label: "Search customer",
    body: "Look up a customer at the counter.",
    icon: PersonSearchOutlined,
    capability: CAPABILITIES.USER_READ,
  },
] as const;

/**
 * Teller home.
 *
 * The requested "today's deposits and withdrawals" tiles cannot be filled from
 * data this role is allowed to read: aggregating counter activity needs
 * TRANSACTION_READ_ANY, which a TELLER does not hold. Rather than inventing
 * numbers, the tiles say why they are empty and the working figures sit beside
 * them. Every quick action here is a capability the role genuinely holds.
 */
export function TellerDashboard() {
  const { user, role, can } = useAuth();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery<{ myBankAccounts: BankAccount[] }>(
    MY_BANK_ACCOUNTS
  );
  const accounts = data?.myBankAccounts ?? EMPTY;
  const ownBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  const canSeeAggregate = can(CAPABILITIES.TRANSACTION_READ_ANY);
  const heldCapabilities = ROLE_CAPABILITIES[role ?? "TELLER"] ?? [];

  return (
    <>
      <PageHeader
        title={`Counter shift · ${user?.firstName ?? ""}`}
        description="Your cash operations for the day, and the counter limits that apply to them."
      />

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2.5 }}>
        You hold <strong>{humanize(role ?? "TELLER")}</strong>, which may handle cash and
        open accounts but may not browse the customer directory or the account base, and
        may not freeze, close or approve anything.
      </Alert>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" },
          mb: 2.5,
        }}
      >
        <StatCard
          label="Deposits today"
          value="—"
          caption={
            canSeeAggregate
              ? "Aggregating counter activity"
              : `Needs ${CAPABILITIES.TRANSACTION_READ_ANY}`
          }
          icon={PaymentsOutlined}
          tone="success"
          loading={false}
        />
        <StatCard
          label="Withdrawals today"
          value="—"
          caption={
            canSeeAggregate
              ? "Aggregating counter activity"
              : `Needs ${CAPABILITIES.TRANSACTION_READ_ANY}`
          }
          icon={CreditCardOutlined}
          tone="warning"
          loading={false}
        />
        <StatCard
          label="Your own balance"
          value={formatMoney(ownBalance)}
          caption={`${accounts.length} account(s) in your own name`}
          icon={AccountBalanceOutlined}
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Counter limit"
          value={formatMoney(WITHDRAWAL_APPROVAL_THRESHOLD)}
          caption="Withdrawals above this need approval"
          icon={LockOutlined}
          tone="primary"
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2.5,
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.5fr) minmax(0, 1fr)" },
          alignItems: "start",
        }}
      >
        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Counter operations
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              }}
            >
              {QUICK_ACTIONS.filter((action) => can(action.capability)).map((action) => {
                const Icon = action.icon;
                return (
                  <Card
                    key={action.to}
                    variant="outlined"
                    onClick={() => navigate(action.to)}
                    sx={{
                      cursor: "pointer",
                      p: 2,
                      boxShadow: "none",
                      transition: "border-color 120ms, transform 120ms",
                      "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          display: "grid",
                          placeItems: "center",
                          bgcolor: "#EAF1FA",
                          color: "primary.main",
                          flexShrink: 0,
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2">{action.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {action.body}
                        </Typography>
                      </Box>
                    </Stack>
                  </Card>
                );
              })}
            </Box>

            <Divider sx={{ my: 2.5 }} />

            <Typography variant="h4" sx={{ mb: 1.5 }}>
              Accounts in your own name
            </Typography>
            {error ? (
              <Typography variant="body2" color="error">
                {readableError(error, "Could not load your accounts.")}
              </Typography>
            ) : accounts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                You do not hold a bank account. A teller account is optional and is opened
                by an administrator if your branch uses one.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {accounts.map((account) => (
                  <Stack
                    key={account.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700 }}
                      >
                        {account.accountNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {humanize(account.accountType)} · {account.ifscCode}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="body2" fontWeight={700}>
                        {formatMoney(account.balance, account.currency)}
                      </Typography>
                      <StatusChip value={account.status} />
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
            <Typography variant="h4" sx={{ mb: 1.5 }}>
              Your permissions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Exactly what the server will let this session do. Anything outside this list
              is refused, regardless of what the console shows.
            </Typography>
            <Stack spacing={0.75}>
              {heldCapabilities.map((capability) => (
                <Stack
                  key={capability}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: "#E6F5F0",
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#0E7C66" }} />
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700, color: "#0B6151" }}
                  >
                    {capability}
                  </Typography>
                </Stack>
              ))}
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
              Notably absent: {CAPABILITIES.USER_READ}, {CAPABILITIES.ACCOUNT_READ_ANY},{" "}
              {CAPABILITIES.ACCOUNT_UPDATE} and {CAPABILITIES.TRANSACTION_APPROVE}. Those
              are deliberate: a counter operator serves the customer in front of them, not
              the whole branch.
            </Typography>
            <Button
              size="small"
              sx={{ mt: 1.5, px: 0 }}
              onClick={() => navigate("/teller/accounts")}
            >
              What you can still reach
            </Button>
          </CardContent>
        </Card>
      </Box>
    </>
  );
}

export default TellerDashboard;
