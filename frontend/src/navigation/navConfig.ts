import type { SvgIconComponent } from "@mui/icons-material";
import DashboardRounded from "@mui/icons-material/DashboardRounded";
import AccountBalanceWalletOutlined from "@mui/icons-material/AccountBalanceWalletOutlined";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";
import SavingsOutlined from "@mui/icons-material/SavingsOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import PolicyOutlined from "@mui/icons-material/PolicyOutlined";
import GppMaybeOutlined from "@mui/icons-material/GppMaybeOutlined";
import GroupsOutlined from "@mui/icons-material/GroupsOutlined";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import ApprovalOutlined from "@mui/icons-material/ApprovalOutlined";

import {
  CAPABILITIES,
  hasPermission,
  type Capability,
  type UserRole,
} from "../rbac";

export interface NavItem {
  label: string;
  /** Sub-heading shown on the dashboard header for the active page. */
  description?: string;
  path: string;
  icon: SvgIconComponent;
  /** Rendered only when the caller's role holds this capability. */
  capability?: Capability;
  /** Match the path exactly rather than as a prefix. */
  end?: boolean;
  /** Resolved by the layout into a live count. */
  badge?: "pendingApprovals";
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

/**
 * The sidebar and the breadcrumb trail are both generated from this, so a page
 * can never appear in one but not the other.
 *
 * Each entry carries the capability that gates it, and that same check drives
 * the nav item, the route guard and the page's own action buttons.
 */
export const NAV_BY_ROLE: Record<UserRole, NavSection[]> = {
  CUSTOMER: [
    {
      heading: "Banking",
      items: [
        {
          label: "Dashboard",
          description: "Total balance, accounts and recent activity",
          path: "/customer",
          icon: DashboardRounded,
          end: true,
        },
        {
          label: "My Accounts",
          description: "Balances, IFSC and account status",
          path: "/customer/accounts",
          icon: AccountBalanceWalletOutlined,
          capability: CAPABILITIES.ACCOUNT_READ,
        },
        {
          label: "Transfer Money",
          description: "Send money between your accounts",
          path: "/customer/transfer",
          icon: SwapHorizRounded,
          capability: CAPABILITIES.TRANSACTION_CREATE,
        },
        {
          label: "Transactions",
          description: "Every movement on your accounts",
          path: "/customer/transactions",
          icon: ReceiptLongOutlined,
          capability: CAPABILITIES.TRANSACTION_READ,
        },
      ],
    },
    {
      heading: "Personal",
      items: [
        {
          label: "My Profile",
          description: "Name, phone and date of birth",
          path: "/customer/profile",
          icon: PersonOutlineRounded,
          capability: CAPABILITIES.USER_UPDATE_OWN,
        },
        {
          label: "Change Password",
          description: "Rotate your credentials",
          path: "/customer/password",
          icon: LockOutlined,
          capability: CAPABILITIES.USER_UPDATE_OWN,
        },
      ],
    },
  ],

  TELLER: [
    {
      heading: "Counter",
      items: [
        {
          label: "Dashboard",
          description: "Today's cash position and queue",
          path: "/teller",
          icon: DashboardRounded,
          end: true,
        },
        {
          label: "Search Customer",
          description: "Look up a customer at the counter",
          path: "/teller/customers",
          icon: PersonSearchOutlined,
          capability: CAPABILITIES.USER_READ,
        },
        {
          label: "Open Account",
          description: "Open an account for a signed-up customer",
          path: "/teller/open-account",
          icon: AccountBalanceOutlined,
          capability: CAPABILITIES.ACCOUNT_CREATE,
        },
        {
          label: "Cash Deposit",
          description: "Accept physical cash",
          path: "/teller/deposit",
          icon: PaymentsOutlined,
          capability: CAPABILITIES.TRANSACTION_CASH,
        },
        {
          label: "Cash Withdrawal",
          description: "Pay out physical cash",
          path: "/teller/withdrawal",
          icon: CreditCardOutlined,
          capability: CAPABILITIES.TRANSACTION_CASH,
        },
        {
          label: "Customer Accounts",
          description: "Accounts for a customer you are serving",
          path: "/teller/accounts",
          icon: SavingsOutlined,
          capability: CAPABILITIES.ACCOUNT_READ_ANY,
        },
      ],
    },
    {
      heading: "Personal",
      items: [
        {
          label: "My Profile",
          path: "/teller/profile",
          icon: PersonOutlineRounded,
          capability: CAPABILITIES.USER_UPDATE_OWN,
        },
        {
          label: "Change Password",
          path: "/teller/password",
          icon: LockOutlined,
          capability: CAPABILITIES.USER_UPDATE_OWN,
        },
      ],
    },
  ],

  AUDITOR: [
    {
      heading: "Oversight",
      items: [
        {
          label: "Dashboard",
          description: "System-wide totals and control posture",
          path: "/auditor",
          icon: DashboardRounded,
          end: true,
        },
        {
          label: "All Accounts",
          description: "Read-only view of every account",
          path: "/auditor/accounts",
          icon: AccountBalanceWalletOutlined,
          capability: CAPABILITIES.ACCOUNT_READ_ANY,
        },
        {
          label: "All Transactions",
          description: "Read-only view of every movement",
          path: "/auditor/transactions",
          icon: ReceiptLongOutlined,
          capability: CAPABILITIES.TRANSACTION_READ_ANY,
        },
        {
          label: "Audit Logs",
          description: "Append-only trail of privileged actions",
          path: "/auditor/audit-logs",
          icon: FactCheckOutlined,
          capability: CAPABILITIES.AUDIT_READ,
        },
      ],
    },
  ],

  ADMIN: [
    {
      heading: "Administration",
      items: [
        {
          label: "Dashboard",
          description: "Platform health and the approval queue",
          path: "/admin",
          icon: DashboardRounded,
          end: true,
        },
        {
          label: "User Management",
          description: "Create users, set roles and status",
          path: "/admin/users",
          icon: GroupsOutlined,
          capability: CAPABILITIES.USER_READ,
        },
        {
          label: "Bank Accounts",
          description: "Freeze, unfreeze and close accounts",
          path: "/admin/accounts",
          icon: ManageAccountsOutlined,
          capability: CAPABILITIES.ACCOUNT_READ_ANY,
        },
        {
          label: "Transactions",
          description: "View and reverse any transaction",
          path: "/admin/transactions",
          icon: ReceiptLongOutlined,
          capability: CAPABILITIES.TRANSACTION_READ_ANY,
        },
        {
          label: "Approval Queue",
          description: "Queued transfers and withdrawals",
          path: "/admin/approvals",
          icon: ApprovalOutlined,
          capability: CAPABILITIES.TRANSACTION_APPROVE,
          badge: "pendingApprovals",
        },
      ],
    },
    {
      heading: "Compliance",
      items: [
        {
          label: "Audit Logs",
          description: "Append-only trail of privileged actions",
          path: "/admin/audit-logs",
          icon: HistoryOutlined,
          capability: CAPABILITIES.AUDIT_READ,
        },
        {
          label: "Roles & Permissions",
          description: "What each role is allowed to do",
          path: "/admin/roles",
          icon: PolicyOutlined,
          capability: CAPABILITIES.USER_UPDATE,
        },
      ],
    },
    {
      heading: "Personal",
      items: [
        {
          label: "My Profile",
          path: "/admin/profile",
          icon: PersonOutlineRounded,
          capability: CAPABILITIES.USER_UPDATE_OWN,
        },
        {
          label: "Change Password",
          path: "/admin/password",
          icon: LockOutlined,
          capability: CAPABILITIES.USER_UPDATE_OWN,
        },
      ],
    },
  ],
};

/** Sections for a role with capability-gated items and empty sections dropped. */
export function sectionsForRole(role: UserRole | null): NavSection[] {
  if (!role) return [];
  return NAV_BY_ROLE[role]
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.capability || hasPermission(role, item.capability)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/** The deepest visible nav item whose path prefixes `pathname`. */
export function findNavTrail(
  role: UserRole | null,
  pathname: string
): Array<{ label: string; path: string }> {
  let best: { label: string; path: string } | undefined;

  for (const section of sectionsForRole(role)) {
    for (const item of section.items) {
      const matches = item.end
        ? pathname === item.path
        : pathname === item.path || pathname.startsWith(`${item.path}/`);
      if (!matches) continue;
      if (!best || item.path.length > best.path.length) {
        best = { label: item.label, path: item.path };
      }
    }
  }

  return best ? [best] : [];
}

export function findNavItem(role: UserRole | null, pathname: string) {
  const [trail] = findNavTrail(role, pathname);
  if (!trail) return undefined;
  for (const section of sectionsForRole(role)) {
    const found = section.items.find((item) => item.path === trail.path);
    if (found) return found;
  }
  return undefined;
}

/**
 * Whether `role` may land on `pathname` at all.
 *
 * Used after sign-in when the user was redirected away from a deep link: if the
 * page they wanted belongs to another role's tree or needs a capability they do
 * not hold, sending them there would just bounce to /403, so the login flow
 * sends them to their own home instead.
 */
export function canVisit(role: UserRole | null, pathname: string): boolean {
  if (!role || !pathname.startsWith("/")) return false;

  const owned = sectionsForRole(role).flatMap((section) => section.items);
  const match = owned.find((item) =>
    item.end ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`)
  );

  if (!match) return false;
  return !match.capability || hasPermission(role, match.capability);
}

export const ROLE_ICONS: Record<UserRole, SvgIconComponent> = {
  CUSTOMER: GppMaybeOutlined,
  TELLER: CreditCardOutlined,
  AUDITOR: FactCheckOutlined,
  ADMIN: AdminPanelSettingsOutlined,
};

export const ROLE_ACCENTS: Record<UserRole, string> = {
  CUSTOMER: "#2E6FB5",
  TELLER: "#0E7C66",
  AUDITOR: "#B26A00",
  ADMIN: "#C0392B",
};
