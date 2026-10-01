import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { Box, Button, Stack, Typography } from "@mui/material";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";

import PageHeader from "../../components/common/PageHeader";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { ErrorState, LoadingState } from "../../components/common/States";
import { ReadOnlyBanner } from "../../components/common/ConfirmDialog";
import { AccountDetailDialog } from "../../components/domain/TransactionDetailDialog";
import { GET_BANK_ACCOUNTS, GET_USERS } from "../../graphql/operations";
import type { BankAccount, User } from "../../graphql/types";
import { formatDate, formatMoney, fullName, humanize } from "../../utils/format";
import { useSnackbar } from "../../components/common/ToastProvider";
import { EMPTY } from "../../utils/empty";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "DORMANT", label: "Dormant" },
  { value: "FROZEN", label: "Frozen" },
  { value: "CLOSED", label: "Closed" },
];

const TYPE_OPTIONS = [
  { value: "SAVINGS", label: "Savings" },
  { value: "CURRENT", label: "Current" },
  { value: "SALARY", label: "Salary" },
  { value: "FIXED_DEPOSIT", label: "Fixed Deposit" },
];

/**
 * Every account in the system, read-only.
 *
 * The account number is the join key a human actually uses, so the holder's
 * name is resolved from the user list client-side rather than leaving a UUID in
 * the cell — `getBankAccounts` returns only `userId`.
 */
export function AuditorAccountsPage() {
  const { notify } = useSnackbar();
  const [selected, setSelected] = useState<BankAccount | null>(null);

  const accountsQuery = useQuery<{ getBankAccounts: BankAccount[] }>(GET_BANK_ACCOUNTS, {
    fetchPolicy: "cache-and-network",
  });
  const usersQuery = useQuery<{ getUsers: User[] }>(GET_USERS, {
    fetchPolicy: "cache-and-network",
  });

  const accounts = accountsQuery.data?.getBankAccounts ?? EMPTY;
  const users = usersQuery.data?.getUsers ?? EMPTY;

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) map.set(user.id, fullName(user));
    return map;
  }, [users]);

  const columns = useMemo<DataTableColumn<BankAccount>[]>(
    () => [
      {
        key: "accountNumber",
        header: "Account number",
        sortable: true,
        width: 160,
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700 }}
          >
            {row.accountNumber}
          </Typography>
        ),
      },
      {
        key: "holder",
        header: "Holder",
        sortable: true,
        value: (row) => (names.get(row.userId) ?? row.userId).toLowerCase(),
        render: (row) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {names.get(row.userId) ?? "Unknown user"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {row.userId}
            </Typography>
          </Box>
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
      {
        key: "status",
        header: "Status",
        sortable: true,
        render: (row) => <StatusChip value={row.status} />,
      },
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
        key: "branchCode",
        header: "Branch",
        hideBelow: "md",
        sortable: true,
        render: (row) => (
          <Typography variant="caption" color="text.secondary">
            {row.branchCode}
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
    [names]
  );

  const exportCsv = () => {
    const header = [
      "Account number",
      "Account type",
      "Status",
      "Balance",
      "Currency",
      "Holder",
      "Holder ID",
      "IFSC",
      "Branch",
      "Opened at",
      "Closed at",
    ];
    const body = accounts.map((row) =>
      [
        row.accountNumber,
        row.accountType,
        row.status,
        row.balance.toFixed(2),
        row.currency,
        names.get(row.userId) ?? "",
        row.userId,
        row.ifscCode,
        row.branchCode,
        row.openedAt,
        row.closedAt ?? "",
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
    anchor.download = `finvault-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", `Exported ${accounts.length} accounts to CSV`);
  };

  if (accountsQuery.error) {
    return <ErrorState error={accountsQuery.error} onRetry={() => void accountsQuery.refetch()} />;
  }

  return (
    <>
      <PageHeader
        title="All accounts"
        description="Every bank account in the platform, with its holder and live balance."
        note={`${accounts.length} account(s) · totals are not comparable across currencies`}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlined />}
              onClick={exportCsv}
              disabled={accounts.length === 0}
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
        Auditor holds no ACCOUNT_UPDATE or ACCOUNT_DELETE capability, so no status control
        appears on any row. Freezing, unfreezing and closing are Administrator actions and are
        recorded in the audit trail.
      </ReadOnlyBanner>

      {accountsQuery.loading && accounts.length === 0 ? (
        <LoadingState label="Loading every account…" />
      ) : (
        <DataTable
          rows={accounts}
          columns={columns}
          getRowId={(row) => row.id}
          searchKeys={["accountNumber", "accountType", "status", "ifscCode", "branchCode", "userId"]}
          searchPlaceholder="Search by account number, IFSC, branch or holder ID…"
          filters={[
            { key: "status", label: "Status", options: STATUS_OPTIONS },
            { key: "accountType", label: "Type", options: TYPE_OPTIONS },
          ]}
          onRowClick={setSelected}
          initialRowsPerPage={25}
          initialSort={{ key: "balance", direction: "desc" }}
          footerNote={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>
                Click any row to open the full account record. Balances are point-in-time
                reads, not ledger positions.
              </span>
            </Stack>
          }
        />
      )}

      <AccountDetailDialog
        account={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        holderName={selected ? names.get(selected.userId) : undefined}
      />
    </>
  );
}

export default AuditorAccountsPage;