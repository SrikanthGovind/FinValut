import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import SavingsOutlined from "@mui/icons-material/SavingsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import CapabilityGate from "../../components/common/CapabilityGate";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { AccountDetailDialog } from "../../components/domain/TransactionDetailDialog";
import { ErrorState, LoadingState } from "../../components/common/States";
import { GET_BANK_ACCOUNTS_BY_USER, GET_USERS } from "../../graphql/operations";
import type { BankAccount, User } from "../../graphql/types";
import { CAPABILITIES } from "../../rbac";
import { formatDate, formatMoney, humanize } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";
import { CustomerSelect } from "../../components/domain/CustomerSelect";

/**
 * Accounts belonging to one customer.
 *
 * `getBankAccountsByUser` is gated on ACCOUNT_READ_ANY. A TELLER does not hold
 * it, so for that role the page explains the restriction and hands off to the
 * counter operations instead. For a role that does hold it, this is the normal
 * read-only account list scoped to the selected customer.
 */
export function CustomerAccountsPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<User | null>(null);
  const [selected, setSelected] = useState<BankAccount | null>(null);

  const canReadAny = can(CAPABILITIES.ACCOUNT_READ_ANY);
  const canReadUsers = can(CAPABILITIES.USER_READ);

  const usersQuery = useQuery<{ getUsers: User[] }>(GET_USERS, {
    skip: !canReadUsers,
    fetchPolicy: "cache-and-network",
  });

  const accountsQuery = useQuery<{ getBankAccountsByUser: BankAccount[] }>(
    GET_BANK_ACCOUNTS_BY_USER,
    {
      skip: !canReadAny || !customer,
      variables: { userId: customer?.id ?? "" },
      fetchPolicy: "cache-and-network",
    }
  );

  const accounts = accountsQuery.data?.getBankAccountsByUser ?? [];

  const columns = useMemo<DataTableColumn<BankAccount>[]>(
    () => [
      {
        key: "accountNumber",
        header: "Account number",
        sortable: true,
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 }}
          >
            {row.accountNumber}
          </Typography>
        ),
      },
      {
        key: "accountType",
        header: "Type",
        sortable: true,
        render: (row) => humanize(row.accountType),
      },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        sortable: true,
        value: (row) => row.balance,
        render: (row) => (
          <Typography variant="body2" fontWeight={700}>
            {formatMoney(row.balance, row.currency)}
          </Typography>
        ),
      },
      { key: "status", header: "Status", sortable: true, render: (row) => <StatusChip value={row.status} /> },
      {
        key: "ifscCode",
        header: "IFSC",
        hideBelow: "sm",
        render: (row) => (
          <Typography variant="caption" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
            {row.ifscCode}
          </Typography>
        ),
      },
      {
        key: "openedAt",
        header: "Opened",
        align: "right",
        sortable: true,
        hideBelow: "md",
        value: (row) => new Date(row.openedAt).getTime(),
        render: (row) => (
          <Typography variant="caption" color="text.secondary">
            {formatDate(row.openedAt)}
          </Typography>
        ),
      },
    ],
    []
  );

  if (!canReadAny) {
    return (
      <>
        <PageHeader
          title="Customer accounts"
          description="Accounts held by a customer you are serving."
        />
        <CapabilityGate
          capability={CAPABILITIES.ACCOUNT_READ_ANY}
          title="This role cannot list a customer's accounts"
          explanation="Reading another person's accounts is gated on ACCOUNT_READ_ANY, which is held by Auditor and Admin only. A TELLER may transact on an account it is handed, but may not page through the account base — that is what separates serving a customer from browsing everyone."
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
            <Button variant="outlined" onClick={() => navigate("/teller/deposit")}>
              Take a cash deposit instead
            </Button>
            <Button variant="outlined" onClick={() => navigate("/teller/withdrawal")}>
              Pay out a cash withdrawal instead
            </Button>
          </Stack>
        </CapabilityGate>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Customer accounts"
        description="Every account held by the selected customer, with live balances."
      />

      <Stack spacing={2.5}>
        <Card>
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-start" }}>
              <Box sx={{ flexGrow: 1, width: { md: "100%" } }}>
                <CustomerSelect
                  users={usersQuery.data?.getUsers ?? []}
                  value={customer}
                  onChange={setCustomer}
                  label="Select a customer"
                  helperText={
                    canReadUsers
                      ? "Search by name or email."
                      : undefined
                  }
                />
              </Box>
              {customer && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: { md: 0.5 } }}>
                  <Chip size="small" label={`${accounts.length} account(s)`} />
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        {!canReadUsers && (
          <Alert severity="info" icon={<InfoOutlinedIcon />}>
            Your role cannot list customers either. Reach this screen from the customer
            record you are already serving, or grant <code>USER_READ</code> to see the
            directory.
          </Alert>
        )}

        {!customer ? (
          <Card>
            <CardContent sx={{ py: 5 }}>
              <Stack spacing={1} alignItems="center">
                <SavingsOutlined sx={{ fontSize: 34, color: "text.disabled" }} />
                <Typography variant="subtitle1">Pick a customer to begin</Typography>
                <Typography variant="body2" color="text.secondary">
                  Accounts are fetched per customer, so nothing is loaded until one is
                  chosen.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ) : accountsQuery.error ? (
          <ErrorState
            error={accountsQuery.error}
            onRetry={() => void accountsQuery.refetch()}
          />
        ) : accountsQuery.loading && accounts.length === 0 ? (
          <LoadingState label="Loading accounts…" />
        ) : (
          <DataTable
            rows={accounts}
            columns={columns}
            getRowId={(row) => row.id}
            searchKeys={["accountNumber", "accountType", "status", "ifscCode", "branchCode"]}
            searchPlaceholder="Search this customer's accounts…"
            onRowClick={setSelected}
            emptyTitle="No accounts held"
            emptyMessage={`${customer.email} does not hold a bank account yet. You can open one from the counter.`}
            toolbarExtra={
              <Button variant="outlined" onClick={() => navigate("/teller/open-account")}>
                Open an account
              </Button>
            }
          />
        )}
      </Stack>

      <AccountDetailDialog
        account={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        holderName={
          customer
            ? `${customer.firstName} ${customer.lastName ?? ""}`.trim()
            : undefined
        }
      />
    </>
  );
}

export default CustomerAccountsPage;
