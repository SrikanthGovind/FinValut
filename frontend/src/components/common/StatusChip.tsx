import { Chip, type ChipProps } from "@mui/material";

import { humanize } from "../../utils/format";

type Tone = "success" | "error" | "warning" | "info" | "neutral" | "primary";

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  success: { bg: "#E6F5F0", fg: "#0B6151", border: "#BFE3D8" },
  error: { bg: "#FCEBE9", fg: "#9C2A1D", border: "#F4C7C1" },
  warning: { bg: "#FDF3E3", fg: "#8A5200", border: "#F2DDB8" },
  info: { bg: "#EAF1FA", fg: "#0A4C92", border: "#C7DCF3" },
  primary: { bg: "#EAF1FA", fg: "#0A4C92", border: "#C7DCF3" },
  neutral: { bg: "#F1F4F8", fg: "#5A6B7F", border: "#DCE3EC" },
};

/**
 * Single mapping from a backend enum to a colour, so a FROZEN account looks
 * the same on the customer's page, the teller's page and the auditor's page.
 */
const STATUS_TONES: Record<string, Tone> = {
  // BankAccount.status
  ACTIVE: "success",
  DORMANT: "warning",
  FROZEN: "info",
  CLOSED: "neutral",
  // Transaction.status
  PENDING: "warning",
  COMPLETED: "success",
  FAILED: "error",
  REVERSED: "neutral",
  // User.status
  INACTIVE: "warning",
  BLOCKED: "error",
  // AuditOutcome
  SUCCESS: "success",
  FAILURE: "error",
  // User.role
  CUSTOMER: "info",
  TELLER: "primary",
  AUDITOR: "warning",
  ADMIN: "error",
};

const FAILURE_ACTIONS = new Set(["LOGIN_FAILED", "ACCESS_DENIED"]);

export function statusTone(value: string, outcome?: string): Tone {
  if (outcome && outcome.toUpperCase() === "FAILURE") return "error";
  if (outcome && outcome.toUpperCase() === "SUCCESS") return "success";
  if (FAILURE_ACTIONS.has(value)) return "error";
  return STATUS_TONES[value] ?? "neutral";
}

export function StatusChip({
  value,
  tone,
  label,
  outcome,
  ...rest
}: {
  value: string;
  tone?: Tone;
  label?: string;
  /** Audit entries carry an outcome; a FAILURE always wins over the action's tone. */
  outcome?: string;
} & Omit<ChipProps, "label" | "color">) {
  const resolved = tone ?? statusTone(value, outcome);
  const palette = TONES[resolved];
  return (
    <Chip
      size="small"
      label={label ?? humanize(value)}
      {...rest}
      sx={{
        bgcolor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        fontWeight: 700,
        ...rest.sx,
      }}
    />
  );
}

/** Roles are shown with a coloured dot rather than a filled chip. */
export function RoleChip({ value }: { value: string }) {
  const palette = TONES[statusTone(value)];
  return (
    <Chip
      size="small"
      variant="outlined"
      label={humanize(value)}
      icon={
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: palette.fg,
            display: "inline-block",
          }}
        />
      }
      sx={{
        bgcolor: palette.bg,
        color: palette.fg,
        borderColor: palette.border,
        fontWeight: 700,
        "& .MuiChip-icon": { marginLeft: 1, marginRight: -2 },
      }}
    />
  );
}

export { TONES };
export type { Tone };
