import { Box, Stack, Typography } from "@mui/material";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";

import { RoleChip, StatusChip } from "../common/StatusChip";
import { DetailRow } from "./DetailDialog";
import type { User } from "../../graphql/types";
import { formatDate, formatDateTime, fullName, humanize } from "../../utils/format";
import { useAuth } from "../../auth/AuthContext";
import { CAPABILITIES } from "../../rbac";

/**
 * Compact identity card for a customer being served.
 *
 * Aadhaar and PAN are resolved through field resolvers that mask them unless
 * the caller's role holds USER_IDENTITY_READ_FULL, so this shows whatever the
 * server actually returned and never guesses at the full value.
 */
export function CustomerSummary({ user }: { user: User }) {
  const { can } = useAuth();
  const fullIdentity = can(CAPABILITIES.USER_IDENTITY_READ_FULL);

  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle2">{fullName(user)}</Typography>
        <RoleChip value={user.role} />
        <StatusChip value={user.status} />
      </Stack>

      <DetailRow label="Email">{user.email}</DetailRow>
      <DetailRow label="Phone">{user.phone ?? "—"}</DetailRow>
      <DetailRow label="Date of birth">
        {user.dateOfBirth ? formatDate(user.dateOfBirth) : "—"}
      </DetailRow>
      <DetailRow label="Registered">{formatDate(user.createdAt)}</DetailRow>
      <DetailRow label="Last updated">{formatDateTime(user.updatedAt)}</DetailRow>
      <DetailRow label="Aadhaar" mono>
        {user.aadharNumber ?? "Not recorded"}
      </DetailRow>
      <DetailRow label="PAN" mono>
        {user.panNumber ?? "Not recorded"}
      </DetailRow>

      <Box
        sx={{
          display: "flex",
          gap: 1,
          p: 1.25,
          borderRadius: 1.5,
          bgcolor: fullIdentity ? "#E6F5F0" : "#F1F4F8",
          color: fullIdentity ? "#0B6151" : "text.secondary",
        }}
      >
        <VerifiedUserOutlinedIcon sx={{ fontSize: 16, mt: 0.25 }} />
        <Typography variant="caption">
          {fullIdentity
            ? `Your role holds ${CAPABILITIES.USER_IDENTITY_READ_FULL}, so identity documents are shown in full and the access is logged.`
            : `Your role does not hold ${CAPABILITIES.USER_IDENTITY_READ_FULL}. The server masked both documents, so only the last four characters came back.`}
        </Typography>
      </Box>

      {user.status !== "ACTIVE" && (
        <Typography variant="caption" sx={{ color: "error.main" }}>
          This customer is {humanize(user.status).toLowerCase()}. The server will refuse
          transactions and new accounts for them.
        </Typography>
      )}
    </Stack>
  );
}

export default CustomerSummary;
