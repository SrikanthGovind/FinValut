import { Box, Card, CardContent, Skeleton, Stack, Typography } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import ArrowUpwardRounded from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRounded from "@mui/icons-material/ArrowDownwardRounded";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: SvgIconComponent;
  /** Tints the icon tile and the trend chip. */
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  caption?: ReactNode;
  trend?: { value: string; direction: "up" | "down" };
  loading?: boolean;
}

const TONES = {
  primary: { bg: "#EAF1FA", fg: "#0A4C92" },
  success: { bg: "#E6F5F0", fg: "#0E7C66" },
  warning: { bg: "#FDF3E3", fg: "#B26A00" },
  danger: { bg: "#FCEBE9", fg: "#C0392B" },
  neutral: { bg: "#F1F4F8", fg: "#5A6B7F" },
} as const;

/** One dashboard metric. `trend` is optional because most metrics have no baseline. */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  caption,
  trend,
  loading = false,
}: StatCardProps) {
  const palette = TONES[tone];

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}
            >
              {label}
            </Typography>

            {loading ? (
              <Skeleton variant="text" width="60%" height={44} />
            ) : (
              <Typography
                sx={{
                  mt: 0.75,
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                  wordBreak: "break-word",
                }}
              >
                {value}
              </Typography>
            )}

            {(caption || trend) && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                {trend && (
                  <Stack
                    direction="row"
                    spacing={0.25}
                    alignItems="center"
                    sx={{
                      color: trend.direction === "up" ? "#0E7C66" : "#C0392B",
                    }}
                  >
                    {trend.direction === "up" ? (
                      <ArrowUpwardRounded sx={{ fontSize: 14 }} />
                    ) : (
                      <ArrowDownwardRounded sx={{ fontSize: 14 }} />
                    )}
                    <Typography variant="caption" fontWeight={700}>
                      {trend.value}
                    </Typography>
                  </Stack>
                )}
                {caption && (
                  <Typography variant="caption" color="text.secondary">
                    {caption}
                  </Typography>
                )}
              </Stack>
            )}
          </Box>

          {Icon && (
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                bgcolor: palette.bg,
                color: palette.fg,
                flexShrink: 0,
              }}
            >
              <Icon fontSize="small" />
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default StatCard;
