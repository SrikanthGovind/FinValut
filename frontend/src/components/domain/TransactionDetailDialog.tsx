import { Box, Stack, Typography } from "@mui/material";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import HorizontalRuleRounded from "@mui/icons-material/HorizontalRuleRounded";

import { DetailDialog, DetailRow, DetailSection } from "./DetailDialog";
import { StatusChip } from "../common/StatusChip";
import type { AuditLog, BankAccount, Transaction } from "../../graphql/types";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  humanize,
} from "../../utils/format";

/**
 * Direction of the money from one party's point of view.
 *
 * `direction` decides colouring, and it is passed in by the caller rather than
 * derived here: "is this money coming or going" depends on which account the
 * viewer cares about, which the transaction itself does not know.
 */
export type MoneyDirection = "in" | "out" | "neutral";

export function AmountText({
  amount,
  currency,
  direction,
  bold = true,
}: {
  amount: number;
  currency: string;
  direction: MoneyDirection;
  bold?: boolean;
}) {
  const color =
    direction === "in" ? "#0E7C66" : direction === "out" ? "#C0392B" : "text.primary";
  const prefix = direction === "in" ? "+" : direction === "out" ? "−" : "";

  return (
    <Typography
      component="span"
      sx={{ color, fontWeight: bold ? 700 : 500, whiteSpace: "nowrap" }}
    >
      {prefix}
      {formatMoney(amount, currency)}
    </Typography>
  );
}

export function DirectionIcon({ direction }: { direction: MoneyDirection }) {
  if (direction === "in") return <ArrowDownwardRounded fontSize="inherit" color="success" />;
  if (direction === "out") return <ArrowUpwardRounded fontSize="inherit" color="error" />;
  return <HorizontalRuleRounded fontSize="inherit" color="disabled" />;
}

interface TransactionDetailDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  /** Which side of the movement the viewer is on, for the coloured amount. */
  direction?: MoneyDirection;
}

export function TransactionDetailDialog({
  transaction,
  open,
  onClose,
  direction = "neutral",
}: TransactionDetailDialogProps) {
  if (!transaction) return null;

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={transaction.referenceNumber}
      subtitle={
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip value={transaction.status} />
          <Typography variant="body2" color="text.secondary">
            {humanize(transaction.transactionType)}
          </Typography>
        </Stack>
      }
    >
      <Box
        sx={{
          mb: 2.5,
          p: 2,
          borderRadius: 2,
          bgcolor: "background.default",
          textAlign: "center",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: "0.06em" }}>
          AMOUNT
        </Typography>
        <Typography sx={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          <AmountText
            amount={transaction.amount}
            currency={transaction.currency}
            direction={direction}
          />
        </Typography>
      </Box>

      <DetailSection title="Movement">
        <DetailRow label="From account" mono>
          {transaction.fromAccount?.accountNumber ?? transaction.fromAccountId ?? "External source"}
        </DetailRow>
        <DetailRow label="To account" mono>
          {transaction.toAccount?.accountNumber ?? transaction.toAccountId ?? "External destination"}
        </DetailRow>
        <DetailRow label="Channel">{humanize(transaction.channel ?? "SELF_SERVICE")}</DetailRow>
        <DetailRow label="Description">{transaction.description ?? "—"}</DetailRow>
      </DetailSection>

      <DetailSection title="Record">
        <DetailRow label="Reference" mono>
          {transaction.referenceNumber}
        </DetailRow>
        <DetailRow label="Transaction date">{formatDateTime(transaction.transactionDate)}</DetailRow>
        <DetailRow label="Recorded at">{formatDateTime(transaction.createdAt)}</DetailRow>
        {transaction.approvedAt && (
          <DetailRow label="Approved at">{formatDateTime(transaction.approvedAt)}</DetailRow>
        )}
        {transaction.approvedById && (
          <DetailRow label="Approved by" mono>
            {transaction.approvedById}
          </DetailRow>
        )}
        {transaction.tellerId && (
          <DetailRow label="Handled by teller" mono>
            {transaction.tellerId}
          </DetailRow>
        )}
      </DetailSection>
    </DetailDialog>
  );
}

interface AccountDetailDialogProps {
  account: BankAccount | null;
  open: boolean;
  onClose: () => void;
  /** Name of the holder, resolved by the caller from the user list. */
  holderName?: string;
}

export function AccountDetailDialog({
  account,
  open,
  onClose,
  holderName,
}: AccountDetailDialogProps) {
  if (!account) return null;

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={account.accountNumber}
      subtitle={
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip value={account.status} />
          <Typography variant="body2" color="text.secondary">
            {humanize(account.accountType)}
          </Typography>
        </Stack>
      }
    >
      <Box
        sx={{
          mb: 2.5,
          p: 2.25,
          borderRadius: 2,
          color: "#FFFFFF",
          background: "linear-gradient(135deg, #0B2545 0%, #123A63 100%)",
        }}
      >
        <Typography
          sx={{ fontSize: "0.66rem", letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)" }}
        >
          AVAILABLE BALANCE
        </Typography>
        <Typography sx={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          {formatMoney(account.balance, account.currency)}
        </Typography>
        <Typography
          sx={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.6)", mt: 1 }}
        >
          {account.ifscCode} · Branch {account.branchCode}
        </Typography>
      </Box>

      <DetailSection title="Account">
        <DetailRow label="Account number" mono>
          {account.accountNumber}
        </DetailRow>
        <DetailRow label="Account type">{humanize(account.accountType)}</DetailRow>
        <DetailRow label="Status">{humanize(account.status)}</DetailRow>
        <DetailRow label="Currency">{account.currency}</DetailRow>
      </DetailSection>

      <DetailSection title="Ownership">
        <DetailRow label="Holder">{holderName ?? "—"}</DetailRow>
        <DetailRow label="Holder ID" mono>
          {account.userId}
        </DetailRow>
      </DetailSection>

      <DetailSection title="Timeline">
        <DetailRow label="Opened">{formatDate(account.openedAt)}</DetailRow>
        <DetailRow label="Closed">{account.closedAt ? formatDate(account.closedAt) : "—"}</DetailRow>
        <DetailRow label="Branch code" mono>
          {account.branchCode}
        </DetailRow>
      </DetailSection>
    </DetailDialog>
  );
}

interface AuditLogDetailDialogProps {
  entry: AuditLog | null;
  open: boolean;
  onClose: () => void;
  actorName?: string;
}

export function AuditLogDetailDialog({
  entry,
  open,
  onClose,
  actorName,
}: AuditLogDetailDialogProps) {
  if (!entry) return null;

  const changes = entry.changes ?? {};
  const changeKeys = Object.keys(changes);

  return (
    <DetailDialog
      open={open}
      onClose={onClose}
      title={humanize(entry.action)}
      subtitle={
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip value={entry.action} outcome={entry.outcome} />
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(entry.createdAt)}
          </Typography>
        </Stack>
      }
    >
      <DetailSection title="Event">
        <DetailRow label="Action">{humanize(entry.action)}</DetailRow>
        <DetailRow label="Outcome">{humanize(entry.outcome)}</DetailRow>
        <DetailRow label="Actor">
          {actorName ?? (entry.actorId ? entry.actorId : "Anonymous")}
        </DetailRow>
        <DetailRow label="Role at the time">
          {entry.actorRole ? humanize(entry.actorRole) : "—"}
        </DetailRow>
      </DetailSection>

      <DetailSection title="Subject">
        <DetailRow label="Entity type">{entry.entityType ? humanize(entry.entityType) : "—"}</DetailRow>
        <DetailRow label="Entity ID" mono>
          {entry.entityId ?? "—"}
        </DetailRow>
        <DetailRow label="Reason">{entry.reason ?? "—"}</DetailRow>
      </DetailSection>

      <DetailSection title="Field changes">
        {changeKeys.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            This action recorded no field-level changes.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {changeKeys.map((key) => {
              const change = changes[key] ?? {};
              return (
                <Box
                  key={key}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    bgcolor: "background.default",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ textTransform: "uppercase" }}>
                    {key}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: "wrap" }}>
                    <Typography
                      variant="body2"
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: "#FCEBE9",
                        color: "#9C2A1D",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: "0.74rem",
                      }}
                    >
                      {change.from === undefined || change.from === null
                        ? "∅"
                        : String(change.from)}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      →
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: "#E6F5F0",
                        color: "#0B6151",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: "0.74rem",
                      }}
                    >
                      {change.to === undefined || change.to === null
                        ? "∅"
                        : String(change.to)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </DetailSection>

      <DetailSection title="Origin">
        <DetailRow label="IP address" mono>
          {entry.ipAddress ?? "—"}
        </DetailRow>
      </DetailSection>
    </DetailDialog>
  );
}
