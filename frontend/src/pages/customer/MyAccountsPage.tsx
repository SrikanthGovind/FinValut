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
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { StatusChip } from "../../components/common/StatusChip";
import { EmptyState, ErrorState, LoadingState } from "../../components/common/States";
import { AccountDetailDialog } from "../../components/domain/TransactionDetailDialog";
import { MY_BANK_ACCOUNTS } from "../../graphql/operations";
import type { BankAccount } from "../../graphql/types";
import { useSnackbar } from "../../components/common/ToastProvider";
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  humanize,
} from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";
import { EMPTY } from "../../utils/empty";

export function MyAccountsPage() {
  const { can } = useAuth();
  const { notify } = useSnackbar();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<BankAccount | null>(null);

  const { data, loading, error, refetch } = useQuery<{ myBankAccounts: BankAccount[] }>(
    MY_BANK_ACCOUNTS
  );
  const accounts = data?.myBankAccounts ?? EMPTY;

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );
  const totalCurrency = accounts[0]?.currency ?? "INR";

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notify("success", `${label} copied to clipboard`);
    } catch {
      notify("error", "Could not copy to clipboard");
    }
  };

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        title="My bank accounts"
        description="Every account held in your name, with its live balance and routing details."
        actions={
          can("TRANSACTION_CREATE") ? (
            <Button
              variant="contained"
              startIcon={<AddRounded />}
              onClick={() => navigate("/customer/transfer")}
            >
              New transfer
            </Button>
          ) : undefined
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
          label="Combined balance"
          value={formatMoney(totalBalance, totalCurrency)}
          caption="Across all accounts"
          loading={loading}
        />
        <StatCard
          label="Total value in flow"
          value={formatCompactMoney(
            accounts.reduce((sum, account) => sum + account.balance, 0),
            totalCurrency
          )}
          tone="neutral"
          caption="Same figure, compact"
          loading={loading}
        />
        <StatCard
          label="Inactive accounts"
          value={accounts.filter((a) => a.status !== "ACTIVE").length}
          tone={accounts.some((a) => a.status !== "ACTIVE") ? "warning" : "success"}
          caption="Frozen, dormant or closed"
          loading={loading}
        />
      </Box>

      {loading && accounts.length === 0 ? (
        <LoadingState label="Loading your accounts…" />
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState
            title="You do not hold a bank account yet"
            message="Your login is active but no account is linked to it. A teller can open one for you at any branch; the account opens at a zero balance and is funded by a cash deposit."
          />
        </Card>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", xl: "repeat(3, 1fr)" },
          }}
        >
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        bgcolor: "#EAF1FA",
                        color: "primary.main",
                      }}
                    >
                      <Typography sx={{ fontSize: "0.7rem", fontWeight: 800 }}>
                        {humanize(account.accountType).slice(0, 2).toUpperCase()}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.85rem", fontWeight: 700 }}>
                        {humanize(account.accountType)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}
                      >
                        {account.accountNumber}
                      </Typography>
                    </Box>
                  </Stack>
                  <StatusChip value={account.status} />
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.06em" }}>
                  AVAILABLE BALANCE
                </Typography>
                <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", mb: 2 }}>
                  {formatMoney(account.balance, account.currency)}
                </Typography>

                <Stack spacing={0.75}>
                  <RoutingLine label="IFSC" value={account.ifscCode} onCopy={copy} />
                  <RoutingLine label="Branch" value={account.branchCode} onCopy={copy} />
                  <RoutingLine label="Opened" value={formatDate(account.openedAt)} />
                  {account.closedAt && (
                    <RoutingLine label="Closed" value={formatDate(account.closedAt)} />
                  )}
                </Stack>

                {account.status !== "ACTIVE" && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      mt: 2,
                      p: 1.25,
                      borderRadius: 1.5,
                      bgcolor: "#FDF3E3",
                      color: "#8A5200",
                    }}
                  >
                    <LockOutlined sx={{ fontSize: 16, mt: 0.25 }} />
                    <Typography variant="caption">
                      This account is {humanize(account.status).toLowerCase()}, so no
                      money can move on it. Contact your branch to restore it.
                    </Typography>
                  </Stack>
                )}

                <Button
                  size="small"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => setSelected(account)}
                >
                  View details
                </Button>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <AccountDetailDialog
        account={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function RoutingLine({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy?: (label: string, value: string) => void;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}
        >
          {value}
        </Typography>
        {onCopy && (
          <Button
            size="small"
            onClick={() => onCopy(label, value)}
            sx={{ minWidth: 0, p: 0.25, color: "text.disabled" }}
            aria-label={`Copy ${label.toLowerCase()}`}
          >
            <ContentCopyRounded sx={{ fontSize: 13 }} />
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

export default MyAccountsPage;
