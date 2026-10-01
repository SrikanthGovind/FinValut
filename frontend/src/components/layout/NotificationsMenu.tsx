import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import BoltRounded from "@mui/icons-material/BoltRounded";
import { useNavigate } from "react-router-dom";

import {
  GET_FAILED_AUDIT_LOGS,
  GET_PENDING_APPROVALS,
  MY_TRANSACTIONS,
} from "../../graphql/operations";
import type {
  AuditLog,
  Transaction,
  UserRole,
} from "../../graphql/types";
import { formatDateTime, formatMoney, humanize } from "../../utils/format";
import { readableError } from "../common/ToastProvider";
import { EMPTY } from "../../utils/empty";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "danger";
  timestamp?: string;
  to?: string;
}

const TONE_STYLES = {
  info: { fg: "#0A4C92", bg: "#EAF1FA", Icon: InfoOutlinedIcon },
  success: { fg: "#0E7C66", bg: "#E6F5F0", Icon: CheckCircleOutlineIcon },
  warning: { fg: "#B26A00", bg: "#FDF3E3", Icon: WarningAmberRounded },
  danger: { fg: "#C0392B", bg: "#FCEBE9", Icon: ErrorOutlineIcon },
} as const;

/** Advisories that are the same for every teller, so they need no query. */
const TELLER_NOTICES: AppNotification[] = [
  {
    id: "notice-threshold",
    title: "Withdrawal approval threshold",
    body: "Cash withdrawals above ₹50,000 are queued for admin approval and the balance is debited only once approved.",
    tone: "info",
    to: "/teller/withdrawal",
  },
  {
    id: "notice-open",
    title: "Counter accounts start at zero",
    body: "Accounts opened at the counter open with a zero balance and are funded by a cash deposit, which is what makes the funding traceable.",
    tone: "info",
    to: "/teller/open-account",
  },
];

function auditNotifications(logs: AuditLog[], limit: number): AppNotification[] {
  return logs.slice(0, limit).map((log) => ({
    id: log.id,
    title: `${humanize(log.action)} · ${log.outcome.toLowerCase()}`,
    body:
      log.reason ??
      `${humanize(log.entityType ?? "record")}${log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}`,
    tone: log.outcome === "FAILURE" ? "danger" : "info",
    timestamp: log.createdAt,
  }));
}

/**
 * The bell is role-aware: it surfaces whatever that role can actually act on.
 *
 * Each source is only queried once the menu is opened, because on the admin
 * account two of these are unbounded lists and the badge only needs a count.
 */
export function NotificationsMenu({ role }: { role: UserRole | null }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const open = Boolean(anchor);

  const { data: pendingData, loading: pendingLoading } = useQuery<{
    getPendingApprovals: Transaction[];
  }>(GET_PENDING_APPROVALS, {
    skip: !open || role !== "ADMIN",
    fetchPolicy: "network-only",
    errorPolicy: "all",
  });

  const { data: failedData, loading: failedLoading, error: failedError } =
    useQuery<{ getFailedAuditLogs: AuditLog[] }>(GET_FAILED_AUDIT_LOGS, {
      skip: !open || (role !== "ADMIN" && role !== "AUDITOR"),
      variables: { limit: 6, offset: 0 },
      fetchPolicy: "network-only",
      errorPolicy: "all",
    });

  const { data: myData, loading: myLoading } = useQuery<{
    myTransactions: Transaction[];
  }>(MY_TRANSACTIONS, {
    skip: !open || role !== "CUSTOMER",
    fetchPolicy: "network-only",
    errorPolicy: "all",
  });

  const pending = pendingData?.getPendingApprovals ?? EMPTY;
  const failed = failedData?.getFailedAuditLogs ?? EMPTY;
  const mine = myData?.myTransactions ?? EMPTY;

  const items = useMemo<AppNotification[]>(() => {
    if (role === "ADMIN") {
      return [
        ...pending.slice(0, 5).map((txn) => ({
          id: `pending-${txn.id}`,
          title: `${humanize(txn.transactionType)} awaiting approval`,
          body: `${formatMoney(txn.amount, txn.currency)} · ${txn.referenceNumber}`,
          tone: "warning" as const,
          timestamp: txn.transactionDate,
          to: "/admin/approvals",
        })),
        ...auditNotifications(failed, 4),
      ];
    }
    if (role === "AUDITOR") {
      return auditNotifications(failed, 6);
    }
    if (role === "TELLER") {
      return TELLER_NOTICES;
    }
    if (role === "CUSTOMER") {
      const queued = mine.filter((txn) => txn.status === "PENDING").slice(0, 5);
      if (queued.length === 0) {
        return [
          {
            id: "nothing-queued",
            title: "Nothing waiting on you",
            body: "Transfers above ₹1,00,000 and counter withdrawals are parked here until an administrator approves them.",
            tone: "success" as const,
            to: "/customer/transactions",
          },
        ];
      }
      return queued.map((txn) => ({
        id: `mine-${txn.id}`,
        title: `${humanize(txn.transactionType)} pending approval`,
        body: `${formatMoney(txn.amount, txn.currency)} · ${txn.referenceNumber}`,
        tone: "warning" as const,
        timestamp: txn.transactionDate,
        to: "/customer/transactions",
      }));
    }
    return [];
  }, [role, pending, failed, mine]);

  const loading =
    (role === "ADMIN" && pendingLoading) ||
    ((role === "ADMIN" || role === "AUDITOR") && failedLoading) ||
    (role === "CUSTOMER" && myLoading);

  const unread = items.filter((item) => item.tone === "warning" || item.tone === "danger").length;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label={`Notifications${unread ? `, ${unread} needing attention` : ""}`}
          sx={{ color: "text.secondary" }}
        >
          <Badge
            badgeContent={unread}
            color="error"
            max={99}
            sx={{ "& .MuiBadge-badge": { fontSize: "0.62rem", height: 16, minWidth: 16 } }}
          >
            <NotificationsNoneOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: { width: 380, maxWidth: "calc(100vw - 32px)", border: "1px solid", borderColor: "divider" },
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle1">Notifications</Typography>
          <Button size="small" onClick={() => setAnchor(null)}>
            Close
          </Button>
        </Stack>
        <Divider />

        {failedError && (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="caption" color="error">
              {readableError(failedError, "Could not load notifications.")}
            </Typography>
          </Box>
        )}

        {loading && items.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              You are all caught up.
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 400, overflowY: "auto" }}>
            {items.map((item) => {
              const style = TONE_STYLES[item.tone];
              const Icon = style.Icon;
              return (
                <ListItemButton
                  key={item.id}
                  onClick={() => {
                    setAnchor(null);
                    if (item.to) navigate(item.to);
                  }}
                  sx={{ py: 1.25, px: 2, alignItems: "flex-start", gap: 1.25 }}
                >
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: 2,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: style.bg,
                      color: style.fg,
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    <Icon sx={{ fontSize: 17 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {item.body}
                    </Typography>
                    {item.timestamp && (
                      <Typography
                        variant="caption"
                        sx={{ display: "block", color: "text.disabled", mt: 0.25 }}
                      >
                        {formatDateTime(item.timestamp)}
                      </Typography>
                    )}
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Popover>
    </>
  );
}

/** Small inline counter used by dashboards, e.g. the admin approval queue. */
export function CountBadge({ count, tone = "warning" }: { count: number; tone?: "warning" | "danger" | "info" }) {
  const style = TONE_STYLES[tone];
  if (count <= 0) return null;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: style.fg }}>
      <BoltRounded sx={{ fontSize: 15 }} />
      <Typography variant="caption" fontWeight={700}>
        {count}
      </Typography>
    </Stack>
  );
}

export default NotificationsMenu;
