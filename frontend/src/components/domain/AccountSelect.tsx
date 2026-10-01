import { useMemo } from "react";
import {
  Autocomplete,
  Box,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceOutlined from "@mui/icons-material/AccountBalanceOutlined";

import type { AccountType, BankAccount } from "../../graphql/types";
import { formatMoney, humanize } from "../../utils/format";
import { StatusChip } from "../common/StatusChip";

interface AccountSelectProps {
  accounts: BankAccount[];
  value: BankAccount | null;
  onChange: (account: BankAccount | null) => void;
  label?: string;
  disabled?: boolean;
  /** Hide accounts the caller must not be able to transact on. */
  selectableStatuses?: BankAccount["status"][];
  helperText?: string;
}

/**
 * Account dropdown with the balance visible in each option.
 *
 * Frozen, dormant and closed accounts are filtered out by default because the
 * server rejects a transaction against them; leaving them selectable would
 * guarantee a failed mutation and a confusing error.
 */
export function AccountSelect({
  accounts,
  value,
  onChange,
  label = "Account",
  disabled = false,
  selectableStatuses = ["ACTIVE"],
  helperText,
}: AccountSelectProps) {
  const options = useMemo(
    () => accounts.filter((account) => selectableStatuses.includes(account.status)),
    [accounts, selectableStatuses]
  );

  return (
    <Autocomplete
      options={options}
      value={value}
      disabled={disabled}
      onChange={(_event, next) => onChange(next)}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      getOptionLabel={(option) => `${option.accountNumber} · ${humanize(option.accountType)}`}
      noOptionsText={
        accounts.length === 0
          ? "No accounts available"
          : "No accounts in an operable state"
      }
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
            <AccountBalanceOutlined sx={{ fontSize: 18, color: "text.disabled" }} />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>
                {option.accountNumber}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {humanize(option.accountType)} · {option.ifscCode}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>
                {formatMoney(option.balance, option.currency)}
              </Typography>
              <StatusChip value={option.status} sx={{ mt: 0.25 }} />
            </Box>
          </Stack>
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} label={label} helperText={helperText} />
      )}
    />
  );
}

export const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: "SAVINGS", label: "Savings" },
  { value: "CURRENT", label: "Current" },
  { value: "SALARY", label: "Salary" },
  { value: "FIXED_DEPOSIT", label: "Fixed Deposit" },
];

export default AccountSelect;
