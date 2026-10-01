import { useMemo } from "react";
import {
  Autocomplete,
  Box,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { User } from "../../graphql/types";
import { fullName, initials } from "../../utils/format";
import { RoleChip } from "../common/StatusChip";

interface CustomerSelectProps {
  users: User[];
  value: User | null;
  onChange: (user: User | null) => void;
  label?: string;
  disabled?: boolean;
  /** Restrict the list, e.g. only customers when opening an account. */
  restrictToRole?: User["role"];
  helperText?: string;
}

/**
 * Counter customer lookup. Blocked customers are excluded by default: the
 * server refuses transactions for them anyway, and offering one only produces
 * a rejection at the worst possible moment.
 */
export function CustomerSelect({
  users,
  value,
  onChange,
  label = "Customer",
  disabled = false,
  restrictToRole,
  helperText,
}: CustomerSelectProps) {
  const options = useMemo(
    () =>
      users
        .filter((user) => (restrictToRole ? user.role === restrictToRole : true))
        .filter((user) => user.status === "ACTIVE"),
    [users, restrictToRole]
  );

  return (
    <Autocomplete
      options={options}
      value={value}
      disabled={disabled}
      onChange={(_event, next) => onChange(next)}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      getOptionLabel={(option) => fullName(option)}
      filterOptions={(candidate, state) =>
        candidate.filter((option) => {
          const needle = state.inputValue.trim().toLowerCase();
          if (!needle) return true;
          return (
            fullName(option).toLowerCase().includes(needle) ||
            option.email.toLowerCase().includes(needle) ||
            option.phone?.includes(needle)
          );
        })
      }
      noOptionsText="No active customer matches that search"
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: "primary.main",
                color: "#FFF",
                fontSize: "0.72rem",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials(option)}
            </Box>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography sx={{ fontSize: "0.82rem", fontWeight: 700 }}>
                {fullName(option)}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {option.email}
              </Typography>
            </Box>
            <RoleChip value={option.role} />
          </Stack>
        </Box>
      )}
      renderInput={(params) => (
        <TextField {...params} label={label} helperText={helperText} />
      )}
    />
  );
}

export default CustomerSelect;
