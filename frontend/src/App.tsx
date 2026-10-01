import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import {
  PublicOnly,
  RequireAuth,
  RequireCapability,
  RequireRole,
} from "./auth/guards";
import { useAuth } from "./auth/AuthContext";
import { CAPABILITIES, ROLE_HOME } from "./rbac";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import MyAccountsPage from "./pages/customer/MyAccountsPage";
import TransferMoneyPage from "./pages/customer/TransferMoneyPage";
import TransactionHistoryPage from "./pages/customer/TransactionHistoryPage";
import TellerDashboard from "./pages/teller/TellerDashboard";
import SearchCustomerPage from "./pages/teller/SearchCustomerPage";
import OpenAccountPage from "./pages/teller/OpenAccountPage";
import CustomerAccountsPage from "./pages/teller/CustomerAccountsPage";
import { CashDepositPage, CashWithdrawalPage } from "./pages/teller/CashCounterPage";
import AuditorDashboard from "./pages/auditor/AuditorDashboard";
import AuditorAccountsPage from "./pages/auditor/AuditorAccountsPage";
import AuditorTransactionsPage from "./pages/auditor/AuditorTransactionsPage";
import AuditorAuditLogsPage from "./pages/auditor/AuditorAuditLogsPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminAccountsPage from "./pages/admin/AdminAccountsPage";
import AdminTransactionsPage from "./pages/admin/AdminTransactionsPage";
import AdminApprovalsPage from "./pages/admin/AdminApprovalsPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminRolesPage from "./pages/admin/AdminRolesPage";
import ProfilePage from "./pages/shared/ProfilePage";
import ChangePasswordPage from "./pages/shared/ChangePasswordPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFoundPage from "./pages/NotFoundPage";

/** Sends `/` to the signer's own dashboard, or to login when signed out. */
function RootRedirect() {
  const { user, role, bootstrapping } = useAuth();

  if (bootstrapping) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={role ? ROLE_HOME[role] : "/login"} replace />;
}

/**
 * Route table.
 *
 * Three layers of guard, each for a different job:
 *
 *   - `RequireAuth` validates the stored token before any page paints, so a
 *     deep link cannot flash a screen the caller is about to be bounced off.
 *   - `RequireRole` owns the four role home routes, which is what keeps a
 *     customer out of /admin even by typing the URL.
 *   - `RequireCapability` repeats the check that the route's own query would be
 *     refused for anyway, turning a 403 into a plain redirect to /403.
 *
 * The capability on each route is the same one the sidebar item carries in
 * `navConfig.ts`, which is what keeps the menu and the router from disagreeing.
 */
export function App() {
  return (
    <Routes>
      {/* `RequireAuth` redirects here with the attempted path in router state,
          and `LoginPage` returns the user to it if their role allows. */}
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<RootRedirect />} />
        <Route path="/403" element={<ForbiddenPage />} />

        {/* Customer */}
        <Route
          path="/customer"
          element={
            <RequireRole roles={["CUSTOMER"]}>
              <CustomerDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/customer/accounts"
          element={
            <RequireCapability capability={CAPABILITIES.ACCOUNT_READ}>
              <MyAccountsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/customer/transfer"
          element={
            <RequireCapability capability={CAPABILITIES.TRANSACTION_CREATE}>
              <TransferMoneyPage />
            </RequireCapability>
          }
        />
        <Route
          path="/customer/transactions"
          element={
            <RequireCapability capability={CAPABILITIES.TRANSACTION_READ}>
              <TransactionHistoryPage />
            </RequireCapability>
          }
        />
        <Route path="/customer/profile" element={<ProfilePage />} />
        <Route path="/customer/password" element={<ChangePasswordPage />} />

        {/* Teller */}
        <Route
          path="/teller"
          element={
            <RequireRole roles={["TELLER"]}>
              <TellerDashboard />
            </RequireRole>
          }
        />
        <Route path="/teller/customers" element={<SearchCustomerPage />} />
        <Route
          path="/teller/open-account"
          element={
            <RequireCapability capability={CAPABILITIES.ACCOUNT_CREATE}>
              <OpenAccountPage />
            </RequireCapability>
          }
        />
        <Route
          path="/teller/deposit"
          element={
            <RequireCapability capability={CAPABILITIES.TRANSACTION_CASH}>
              <CashDepositPage />
            </RequireCapability>
          }
        />
        <Route
          path="/teller/withdrawal"
          element={
            <RequireCapability capability={CAPABILITIES.TRANSACTION_CASH}>
              <CashWithdrawalPage />
            </RequireCapability>
          }
        />
        {/* Reachable on purpose even though the page renders a capability
            explanation: the nav item is gated, but a teller who bookmarked it
            should get the explanation rather than a bare redirect. */}
        <Route path="/teller/accounts" element={<CustomerAccountsPage />} />
        <Route path="/teller/profile" element={<ProfilePage />} />
        <Route path="/teller/password" element={<ChangePasswordPage />} />

        {/* Auditor */}
        <Route
          path="/auditor"
          element={
            <RequireRole roles={["AUDITOR"]}>
              <AuditorDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/auditor/accounts"
          element={
            <RequireCapability capability={CAPABILITIES.ACCOUNT_READ_ANY}>
              <AuditorAccountsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/auditor/transactions"
          element={
            <RequireCapability capability={CAPABILITIES.TRANSACTION_READ_ANY}>
              <AuditorTransactionsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/auditor/audit-logs"
          element={
            <RequireCapability capability={CAPABILITIES.AUDIT_READ}>
              <AuditorAuditLogsPage />
            </RequireCapability>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <RequireRole roles={["ADMIN"]}>
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireCapability capability={CAPABILITIES.USER_READ}>
              <AdminUsersPage />
            </RequireCapability>
          }
        />
        <Route
          path="/admin/accounts"
          element={
            <RequireCapability capability={CAPABILITIES.ACCOUNT_READ_ANY}>
              <AdminAccountsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <RequireCapability capability={CAPABILITIES.TRANSACTION_READ_ANY}>
              <AdminTransactionsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/admin/approvals"
          element={
            <RequireCapability capability={CAPABILITIES.TRANSACTION_APPROVE}>
              <AdminApprovalsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <RequireCapability capability={CAPABILITIES.AUDIT_READ}>
              <AdminAuditLogsPage />
            </RequireCapability>
          }
        />
        <Route
          path="/admin/roles"
          element={
            <RequireCapability capability={CAPABILITIES.USER_UPDATE}>
              <AdminRolesPage />
            </RequireCapability>
          }
        />
        <Route path="/admin/profile" element={<ProfilePage />} />
        <Route path="/admin/password" element={<ChangePasswordPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
