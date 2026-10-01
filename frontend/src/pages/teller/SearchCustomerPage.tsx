import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import PaymentsOutlined from "@mui/icons-material/PaymentsOutlined";
import CreditCardOutlined from "@mui/icons-material/CreditCardOutlined";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import CapabilityGate from "../../components/common/CapabilityGate";
import { DataTable, type DataTableColumn } from "../../components/common/DataTable";
import { RoleChip, StatusChip } from "../../components/common/StatusChip";
import { ErrorState, LoadingState } from "../../components/common/States";
import { GET_USERS } from "../../graphql/operations";
import type { User } from "../../graphql/types";
import { CAPABILITIES } from "../../rbac";
import { formatDate, fullName } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";

/**
 * Customer directory.
 *
 * The query behind this screen is `getUsers`, which the server gates on
 * USER_READ. A TELLER does not hold it, so for that role the page says so and
 * points at the counter operations that still work, rather than showing an
 * empty table that looks like a data outage.
 */
export function SearchCustomerPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState<"" | User["role"]>("");

  const allowed = can(CAPABILITIES.USER_READ);
  const { data, loading, error, refetch } = useQuery<{ getUsers: User[] }>(GET_USERS, {
    skip: !allowed,
    fetchPolicy: "cache-and-network",
  });

  const users = useMemo(() => {
    const all = data?.getUsers ?? [];
    return roleFilter ? all.filter((user) => user.role === roleFilter) : all;
  }, [data, roleFilter]);

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      value: (row) => fullName(row).toLowerCase(),
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={700}>
            {fullName(row)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.email}
          </Typography>
        </Box>
      ),
    },
    { key: "phone", header: "Phone", hideBelow: "sm", render: (row) => row.phone ?? "—" },
    { key: "role", header: "Role", sortable: true, render: (row) => <RoleChip value={row.role} /> },
    { key: "status", header: "Status", sortable: true, render: (row) => <StatusChip value={row.status} /> },
    {
      key: "createdAt",
      header: "Registered",
      sortable: true,
      align: "right",
      hideBelow: "md",
      value: (row) => new Date(row.createdAt).getTime(),
      render: (row) => (
        <Typography variant="caption" color="text.secondary">
          {formatDate(row.createdAt)}
        </Typography>
      ),
    },
    {
      key: "id",
      header: "User ID",
      hideBelow: "lg",
      render: (row) => (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}
        >
          {row.id}
        </Typography>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Search customer"
        description="Look up a customer at the counter before opening an account or handling cash."
      />

      {!allowed ? (
        <CapabilityGate
          capability={CAPABILITIES.USER_READ}
          title="This role cannot read the customer directory"
          explanation="The customer list is returned by getUsers, which the server restricts to roles holding USER_READ. A TELLER deliberately does not: it may act on an account it is told about, but not browse who holds one. That separation is what stops a counter operator from enumerating the customer base."
        >
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              What you can still do at the counter, without a directory:
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                startIcon={<PaymentsOutlined />}
                onClick={() => navigate("/teller/deposit")}
              >
                Cash deposit by account ID
              </Button>
              <Button
                variant="outlined"
                startIcon={<CreditCardOutlined />}
                onClick={() => navigate("/teller/withdrawal")}
              >
                Cash withdrawal by account ID
              </Button>
              <Button
                variant="text"
                startIcon={<PersonSearchOutlined />}
                onClick={() => navigate("/teller/open-account")}
              >
                Open an account by customer ID
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
              If the branch needs tellers to browse customers, the fix is to add
              USER_READ to the TELLER role in <code>backend/src/permissions.ts</code> —
              a one-line change with a real security trade-off, so it is not made
              here unilaterally.
            </Typography>
          </Box>
        </CapabilityGate>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <Stack spacing={2.5}>
          <Box>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
              {(["", "CUSTOMER", "TELLER", "AUDITOR", "ADMIN"] as const).map((value) => (
                <Button
                  key={value || "all"}
                  size="small"
                  variant={roleFilter === value ? "contained" : "outlined"}
                  onClick={() => setRoleFilter(value)}
                >
                  {value ? value.charAt(0) + value.slice(1).toLowerCase() : "All roles"}
                </Button>
              ))}
            </Stack>
          </Box>

          {loading && users.length === 0 ? (
            <LoadingState label="Loading customers…" />
          ) : (
            <DataTable
              rows={users}
              columns={columns}
              getRowId={(row) => row.id}
              searchKeys={["firstName", "lastName", "email", "phone", "id", "role", "status"]}
              searchPlaceholder="Search by name, email, phone or user ID…"
              filters={[
                {
                  key: "status",
                  label: "Status",
                  options: [
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                    { value: "BLOCKED", label: "Blocked" },
                  ],
                },
                {
                  key: "role",
                  label: "Role",
                  options: [
                    { value: "CUSTOMER", label: "Customer" },
                    { value: "TELLER", label: "Teller" },
                    { value: "AUDITOR", label: "Auditor" },
                    { value: "ADMIN", label: "Admin" },
                  ],
                },
              ]}
              initialRowsPerPage={10}
              initialSort={{ key: "name", direction: "asc" }}
            />
          )}

          <Card>
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Typography variant="caption" color="text.secondary">
                Aadhaar and PAN are shown masked on this screen. Only a role holding
                USER_IDENTITY_READ_FULL receives them in full, so the column is omitted
                here rather than shown as asterisks that imply a value.
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      )}
    </>
  );
}

export default SearchCustomerPage;
