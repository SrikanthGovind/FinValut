import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import AcUnitRounded from "@mui/icons-material/AcUnitRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import MoreVertRounded from "@mui/icons-material/MoreVertRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { StatusChip } from "../../components/common/StatusChip";
import { ErrorState, LoadingState } from "../../components/common/States";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { AccountDetailDialog } from "../../components/domain/TransactionDetailDialog";
import { readableError, useSnackbar } from "../../components/common/ToastProvider";
import {
  CLOSE_BANK_ACCOUNT,
  FREEZE_ACCOUNT,
  GET_BANK_ACCOUNTS,
  GET_USERS,
  UNFREEZE_ACCOUNT,
  UPDATE_ACCOUNT_STATUS,
} from "../../graphql/operations";
import type { BankAccount, BankAccountStatus, User } from "../../graphql/types";
import { CAPABILITIES } from "../../rbac";
import { formatDate, formatMoney, fullName, humanize } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";
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

interface PendingAction {
  kind: "freeze" | "unfreeze" | "close" | "status";
  account: BankAccount;
  status?: BankAccountStatus;
}

/**
 * Account administration.
 *
 * Four server operations live here, and they are not interchangeable:
 * `freezeAccount` / `unfreezeAccount` / `closeBankAccount` are dedicated
 * mutations with their own audit actions, while `updateBankAccountStatus` is a
 * generic setter used for the two states that have no dedicated mutation
 * (DORMANT and back to ACTIVE). The UI picks the dedicated mutation whenever one
 * exists so the audit trail stays legible.
 *
 * The server enforces the ordering rules — a closed account cannot be reopened,
 * and closing requires a zero balance — so the buttons are still gated here to
 * avoid offering an action that is guaranteed to fail, but the refusal is the
 * server's to make.
 */
export function AdminAccountsPage() {
  const { user: me } = useAuth();
  const { notify } = useSnackbar();

  const [selected, setSelected] = useState<BankAccount | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; account: BankAccount } | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

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

  const [freeze, freezeState] = useMutation<{ freezeAccount: BankAccount }, { id: string }>(
    FREEZE_ACCOUNT
  );
  const [unfreeze, unfreezeState] = useMutation<{ unfreezeAccount: BankAccount }, { id: string }>(
    UNFREEZE_ACCOUNT
  );
  const [closeAccount, closeState] = useMutation<{ closeBankAccount: BankAccount }, { id: string }>(
    CLOSE_BANK_ACCOUNT
  );
  // The input field is `accountId`, not `id`. Type-graphql declares
  // UpdateBankAccountStatusInput with a required accountId, so sending `id`
  // here is rejected as "Field accountId of required type String! was not
  // provided" before the resolver ever runs.
  const [setStatus, statusState] = useMutation<
    { updateBankAccountStatus: BankAccount },
    { data: { accountId: string; status: BankAccountStatus } }
  >(UPDATE_ACCOUNT_STATUS);

  const actionPending =
    freezeState.loading || unfreezeState.loading || closeState.loading || statusState.loading;

  const stats = useMemo(
    () => ({
      total: accounts.length,
      frozen: accounts.filter((a) => a.status === "FROZEN").length,
      dormant: accounts.filter((a) => a.status === "DORMANT").length,
      closed: accounts.filter((a) => a.status === "CLOSED").length,
      deposits: accounts
        .filter((a) => a.status !== "CLOSED")
        .reduce((sum, a) => sum + a.balance, 0),
    }),
    [accounts]
  );

  const runAction = async () => {
    if (!pending) return;
    setActionError(null);
    try {
      let updated: BankAccount | undefined;

      if (pending.kind === "freeze") {
        updated = (
          await freeze({ variables: { id: pending.account.id } })
        ).data?.freezeAccount;
      } else if (pending.kind === "unfreeze") {
        updated = (
          await unfreeze({ variables: { id: pending.account.id } })
        ).data?.unfreezeAccount;
      } else if (pending.kind === "close") {
        updated = (
          await closeAccount({ variables: { id: pending.account.id } })
        ).data?.closeBankAccount;
      } else if (pending.status) {
        updated = (
          await setStatus({
            variables: { data: { accountId: pending.account.id, status: pending.status } },
          })
        ).data?.updateBankAccountStatus;
      }

      const verb =
        pending.kind === "freeze"
          ? "frozen"
          : pending.kind === "unfreeze"
            ? "unfrozen"
            : pending.kind === "close"
              ? "closed"
              : `set to ${pending.status?.toLowerCase()}`;

      notify(
        pending.kind === "freeze" || pending.kind === "close" ? "warning" : "success",
        `Account ${pending.account.accountNumber} ${verb}. Recorded in the audit trail.`
      );
      setPending(null);
      setMenu(null);
      if (selected && updated) setSelected(updated);
      await accountsQuery.refetch();
    } catch (caught) {
      setActionError(caught);
      notify("error", readableError(caught, "The server refused the change."));
    }
  };

  const openMenuActions = (account: BankAccount, anchor: HTMLElement) =>
    setMenu({ anchor, account });

  const columns: DataTableColumn<BankAccount>[] = [
    {
      key: "accountNumber",
      header: "Account number",
      sortable: true,
      width: 155,
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
    {
      key: "actions",
      header: "",
      align: "right",
      width: 56,
      render: (row) => (
        <IconButton
          size="small"
          aria-label={`Actions for ${row.accountNumber}`}
          onClick={(event) => {
            event.stopPropagation();
            openMenuActions(row, event.currentTarget);
          }}
        >
          <MoreVertRounded fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const exportCsv = () => {
    const header = ["Account number", "Type", "Status", "Balance", "Currency", "Holder ID", "IFSC", "Branch", "Opened"];
    const body = accounts.map((row) =>
      [
        row.accountNumber,
        row.accountType,
        row.status,
        row.balance.toFixed(2),
        row.currency,
        row.userId,
        row.ifscCode,
        row.branchCode,
        row.openedAt,
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
    anchor.download = `finvault-admin-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("success", `Exported ${accounts.length} accounts to CSV`);
  };

  if (accountsQuery.error) {
    return <ErrorState error={accountsQuery.error} onRetry={() => void accountsQuery.refetch()} />;
  }

  const target = pending?.account;
  const closeBlocked = Boolean(target && target.balance !== 0);

  return (
    <>
      <PageHeader
        title="Bank account management"
        description="Freeze, unfreeze, dormancy and closure across every account in the platform."
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

      <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2.5 }}>
        A freeze blocks every transaction on the account without touching its balance, and the
        holder keeps access to their own view. Closure is permanent: the server refuses it
        while any money remains, and no mutation reopens a closed account.
      </Alert>

      {actionError ? (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setActionError(null)}>
          {readableError(actionError, "The change was refused.")}
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
          label="Accounts"
          value={stats.total}
          caption={`${formatMoney(stats.deposits)} in open accounts`}
          loading={accountsQuery.loading}
        />
        <StatCard
          label="Frozen"
          value={stats.frozen}
          caption="Movement blocked"
          icon={AcUnitRounded}
          tone={stats.frozen > 0 ? "warning" : "success"}
          loading={accountsQuery.loading}
        />
        <StatCard
          label="Dormant"
          value={stats.dormant}
          caption="No customer activity"
          tone={stats.dormant > 0 ? "warning" : "neutral"}
          loading={accountsQuery.loading}
        />
        <StatCard
          label="Closed"
          value={stats.closed}
          caption="Permanent"
          tone={stats.closed > 0 ? "danger" : "neutral"}
          loading={accountsQuery.loading}
        />
      </Box>

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
          initialRowsPerPage={10}
          initialSort={{ key: "accountNumber", direction: "asc" }}
          footerNote="Use the row menu for status changes. Every one of them asks for confirmation and writes an audit entry."
        />
      )}

      {/* Row action menu */}
      <Menu
        anchorEl={menu?.anchor}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {menu && (
          <>
            <MenuItem
              onClick={() => {
                setSelected(menu.account);
                setMenu(null);
              }}
            >
              View details
            </MenuItem>
            <Divider />
            {menu.account.status === "ACTIVE" && (
              <MenuItem
                onClick={() => {
                  setPending({ kind: "freeze", account: menu.account });
                  setMenu(null);
                }}
              >
                <AcUnitRounded sx={{ fontSize: 17, mr: 1 }} /> Freeze account
              </MenuItem>
            )}
            {menu.account.status === "FROZEN" && (
              <>
                <MenuItem
                  onClick={() => {
                    setPending({ kind: "unfreeze", account: menu.account });
                    setMenu(null);
                  }}
                >
                  <LockOpenOutlined sx={{ fontSize: 17, mr: 1 }} /> Unfreeze account
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setPending({
                      kind: "status",
                      account: menu.account,
                      status: "DORMANT",
                    });
                    setMenu(null);
                  }}
                >
                  Mark dormant
                </MenuItem>
              </>
            )}
            {menu.account.status === "DORMANT" && (
              <MenuItem
                onClick={() => {
                  setPending({ kind: "status", account: menu.account, status: "ACTIVE" });
                  setMenu(null);
                }}
              >
                <LockOpenOutlined sx={{ fontSize: 17, mr: 1 }} /> Reactivate
              </MenuItem>
            )}
            {menu.account.status !== "CLOSED" && (
              <MenuItem
                disabled={menu.account.balance !== 0}
                onClick={() => {
                  setPending({ kind: "close", account: menu.account });
                  setMenu(null);
                }}
              >
                <LockOutlined sx={{ fontSize: 17, mr: 1 }} /> Close account
              </MenuItem>
            )}
            {menu.account.status === "CLOSED" && (
              <MenuItem disabled>
                <Typography variant="caption" color="text.secondary">
                  A closed account cannot be reopened
                </Typography>
              </MenuItem>
            )}
          </>
        )}
      </Menu>

      <AccountDetailDialog
        account={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        holderName={selected ? names.get(selected.userId) : undefined}
      />

      {/* Single confirmation for every status change. */}
      <ConfirmDialog
        open={Boolean(pending)}
        pending={actionPending}
        tone={pending?.kind === "freeze" || pending?.kind === "close" ? "error" : "primary"}
        title={
          pending?.kind === "freeze"
            ? "Freeze this account?"
            : pending?.kind === "unfreeze"
              ? "Unfreeze this account?"
              : pending?.kind === "close"
                ? "Close this account permanently?"
                : `Set status to ${pending?.status ?? ""}?`
        }
        confirmLabel={
          pending?.kind === "freeze"
            ? "Freeze"
            : pending?.kind === "unfreeze"
              ? "Unfreeze"
              : pending?.kind === "close"
                ? "Close permanently"
                : "Apply"
        }
        message={
          <Stack spacing={1.25}>
            <Typography variant="body2">
              Account <strong>{target?.accountNumber}</strong> held by{" "}
              <strong>{target ? names.get(target.userId) ?? "unknown user" : ""}</strong>, balance{" "}
              <strong>{target ? formatMoney(target.balance, target.currency) : ""}</strong>.
            </Typography>

            {pending?.kind === "freeze" && (
              <Typography variant="caption" color="text.secondary">
                Every transaction on this account is refused until it is unfrozen. The balance
                is untouched and the holder can still see it. Recorded as
                ACCOUNT_STATUS_CHANGED.
              </Typography>
            )}

            {pending?.kind === "unfreeze" && (
              <Typography variant="caption" color="text.secondary">
                Movement resumes immediately. Confirm the reason for the freeze has been
                resolved first.
              </Typography>
            )}

            {pending?.kind === "status" && (
              <Typography variant="caption" color="text.secondary">
                Dormant accounts are blocked by the server from receiving money. Reactivating
                restores the account to ACTIVE.
              </Typography>
            )}

            {pending?.kind === "close" && (
              <>
                {closeBlocked ? (
                  <Typography variant="caption" sx={{ color: "error.main" }}>
                    This account still holds {target ? formatMoney(target.balance, target.currency) : ""}.
                    The server will refuse to close it until the balance reaches zero — drain
                    it by transferring the money to another account the holder controls.
                  </Typography>
                ) : (
                  <Typography variant="caption" sx={{ color: "error.main" }}>
                    This is irreversible. The account cannot be reopened and no mutation on the
                    server will reverse it. Recorded as ACCOUNT_CLOSED.
                  </Typography>
                )}
              </>
            )}

            {target && target.userId === me?.id && (
              <Typography variant="caption" color="error.main">
                This is your own account. Freezing or closing it will stop you using the
                console's own cash operations.
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary">
              Capability used:{" "}
              <code>
                {pending?.kind === "freeze" || pending?.kind === "unfreeze"
                  ? CAPABILITIES.ACCOUNT_UPDATE
                  : pending?.kind === "close"
                    ? CAPABILITIES.ACCOUNT_DELETE
                    : CAPABILITIES.ACCOUNT_UPDATE}
              </code>
              .
            </Typography>
          </Stack>
        }
        onConfirm={() => void runAction()}
        onClose={() => setPending(null)}
      />

      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", rowGap: 1 }}>
        <Chip
          size="small"
          variant="outlined"
          label="Freeze and unfreeze: ACCOUNT_UPDATE"
        />
        <Chip size="small" variant="outlined" label="Closure: ACCOUNT_DELETE" />
        <Chip size="small" variant="outlined" label="Every change: audit-logged" />
      </Stack>
    </>
  );
}

export default AdminAccountsPage;