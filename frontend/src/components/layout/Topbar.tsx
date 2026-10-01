import { useMemo, useState, type ReactNode } from "react";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import ClearRounded from "@mui/icons-material/ClearRounded";
import PersonOutlineRounded from "@mui/icons-material/PersonOutlineRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import MenuRounded from "@mui/icons-material/MenuRounded";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { RoleChip } from "../common/StatusChip";
import { fullName, humanize, initials } from "../../utils/format";
import { sectionsForRole, type NavItem } from "../../navigation/navConfig";
import NotificationsMenu from "./NotificationsMenu";

interface SearchResult {
  item: NavItem;
  section: string;
}

interface TopbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  /** Rendered between the search field and the account controls. */
  children?: ReactNode;
}

export function Topbar({ sidebarCollapsed, onToggleSidebar, children }: TopbarProps) {
  const { user, role, logout, homeFor } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const results = useMemo<SearchResult[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return sectionsForRole(role)
      .flatMap((section) => section.items.map((item) => ({ item, section: section.heading })))
      .filter(
        ({ item }) =>
          item.label.toLowerCase().includes(needle) ||
          item.path.toLowerCase().includes(needle) ||
          (item.description ?? "").toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [query, role]);

  const go = (path: string) => {
    navigate(path);
    setQuery("");
    setSearchAnchor(null);
  };

  const handleLogout = () => {
    setMenuAnchor(null);
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "#FFFFFF",
        borderBottom: "1px solid",
        borderColor: "divider",
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ minHeight: "64px !important", gap: 1.5, px: { xs: 2, lg: 3 } }}>
        <Tooltip title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}>
          <IconButton onClick={onToggleSidebar} aria-label="Toggle navigation" size="small">
            <MenuRounded fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Global search: resolves to any page this role can reach, so it can
            never surface a route that would come back as "Not authorized". */}
        <Box sx={{ position: "relative", flexGrow: 1, maxWidth: 460 }}>
          <Box
            component="input"
            value={query}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            onFocus={(event) => setSearchAnchor(event.currentTarget)}
            onBlur={() => window.setTimeout(() => setSearchAnchor(null), 150)}
            placeholder="Search pages, accounts, transactions…"
            aria-label="Search the application"
            sx={(t) => ({
              width: "100%",
              height: 38,
              pl: "38px",
              pr: query ? "34px" : "12px",
              fontFamily: t.typography.fontFamily,
              fontSize: "0.84rem",
              color: "text.primary",
              background: t.palette.background.default,
              border: `1px solid ${t.palette.divider}`,
              borderRadius: 2,
              outline: "none",
              transition: "border-color 120ms, box-shadow 120ms",
              "&::placeholder": { color: "text.disabled" },
              "&:focus": {
                borderColor: t.palette.primary.main,
                boxShadow: `0 0 0 3px ${t.palette.primary.main}22`,
              },
            })}
          />
          <Box
            sx={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "text.disabled",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            <SearchRounded sx={{ fontSize: 18 }} />
          </Box>
          {query && (
            <IconButton
              size="small"
              onClick={() => setQuery("")}
              sx={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)" }}
            >
              <ClearRounded sx={{ fontSize: 16 }} />
            </IconButton>
          )}

          {searchAnchor && query.trim() && (
            <PaperResults
              results={results}
              query={query}
              onPick={go}
            />
          )}
        </Box>

        {children && <Box sx={{ flexGrow: 1 }}>{children}</Box>}

        <Box sx={{ flexGrow: children ? 0 : 1 }} />

        <NotificationsMenu role={role} />

        <Divider orientation="vertical" flexItem sx={{ my: 1.75 }} />

        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          onClick={(event) => setMenuAnchor(event.currentTarget)}
          sx={{ cursor: "pointer", py: 0.5, pl: 0.5, pr: 1, borderRadius: 2, "&:hover": { bgcolor: "background.default" } }}
        >
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            variant="dot"
            color={user?.status === "ACTIVE" ? "success" : "error"}
          >
            <Avatar sx={{ width: 32, height: 32, fontSize: "0.78rem", fontWeight: 700, bgcolor: "primary.main" }}>
              {user ? initials(user) : "?"}
            </Avatar>
          </Badge>
          <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, lineHeight: 1.2 }} noWrap>
              {user ? fullName(user) : "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
              {role ? humanize(role) : ""}
            </Typography>
          </Box>
        </Stack>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { minWidth: 240, mt: 1, border: "1px solid", borderColor: "divider" } } }}
        >
          <Box sx={{ px: 2, py: 1.25 }}>
            <Typography sx={{ fontSize: "0.84rem", fontWeight: 700 }}>
              {user ? fullName(user) : ""}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
            <Box sx={{ mt: 1 }}>
              <RoleChip value={role ?? ""} />
            </Box>
          </Box>
          <Divider />

          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              navigate(homeFor(role ?? "CUSTOMER"));
            }}
          >
            <ListItemIcon>
              <OpenInNewRounded fontSize="small" />
            </ListItemIcon>
            Role home
          </MenuItem>

          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              const base = role === "TELLER" ? "/teller" : role === "ADMIN" ? "/admin" : "/customer";
              navigate(`${base}/profile`);
            }}
          >
            <ListItemIcon>
              <PersonOutlineRounded fontSize="small" />
            </ListItemIcon>
            My profile
          </MenuItem>

          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              const base = role === "TELLER" ? "/teller" : role === "ADMIN" ? "/admin" : "/customer";
              navigate(`${base}/password`);
            }}
          >
            <ListItemIcon>
              <LockOutlined fontSize="small" />
            </ListItemIcon>
            Change password
          </MenuItem>

          <Divider />

          <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
            <ListItemIcon sx={{ color: "error.main" }}>
              <LogoutOutlined fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

function PaperResults({
  results,
  query,
  onPick,
}: {
  results: SearchResult[];
  query: string;
  onPick: (path: string) => void;
}) {
  return (
    <Box
      sx={(t) => ({
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        right: 0,
        bgcolor: t.palette.background.paper,
        border: `1px solid ${t.palette.divider}`,
        borderRadius: 2,
        boxShadow: 3,
        zIndex: t.zIndex.tooltip,
        maxHeight: 320,
        overflowY: "auto",
        p: 0.5,
      })}
      role="listbox"
    >
      {results.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1.5 }}>
          Nothing matches “{query.trim()}” in this role.
        </Typography>
      ) : (
        results.map(({ item, section }) => {
          const Icon = item.icon;
          return (
            <MenuItem
              key={item.path}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(item.path);
              }}
              sx={{ borderRadius: 1.5, py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 34 }}>
                <Icon sx={{ fontSize: 18 }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.description ?? section}
                primaryTypographyProps={{ fontSize: "0.84rem", fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: "0.72rem" }}
              />
            </MenuItem>
          );
        })
      )}
    </Box>
  );
}

export default Topbar;
