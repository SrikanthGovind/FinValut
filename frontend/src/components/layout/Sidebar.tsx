import {
  Avatar,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  Badge,
  alpha,
} from "@mui/material";
import MenuRounded from "@mui/icons-material/MenuRounded";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import AccountBalance from "@mui/icons-material/AccountBalance";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { sectionsForRole, type NavItem } from "../../navigation/navConfig";
import { palette } from "../../theme";
import { useAuth } from "../../auth/AuthContext";
import { fullName, humanize, initials } from "../../utils/format";

export const SIDEBAR_WIDTH = 264;
export const SIDEBAR_COLLAPSED = 76;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  pendingApprovals: number;
}

export function Sidebar({ collapsed, onToggle, pendingApprovals }: SidebarProps) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sections = sectionsForRole(role);

  const isActive = (item: NavItem) =>
    item.end
      ? location.pathname === item.path
      : location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box
      component="nav"
      sx={{
        width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH,
        flexShrink: 0,
        transition: "width 160ms ease",
        background: `linear-gradient(180deg, ${palette.navy[800]} 0%, ${palette.navy[900]} 100%)`,
        color: "#E7EEF7",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
      }}
    >

      <Box sx={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
      {/* Brand */}
      {!collapsed && (
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{ height: 64, px: collapsed ? 0 : 2.25, justifyContent: collapsed ? "center" : "flex-start", flexShrink: 0 }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: "rgba(255,255,255,0.12)",
            color: "#FFFFFF",
            flexShrink: 0,
          }}
        >
          <AccountBalance sx={{ fontSize: 20 }} />
        </Box>
  
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              FinVault
            </Typography>
            <Typography sx={{ fontSize: "0.64rem", color: "rgba(231,238,247,0.6)", letterSpacing: "0.12em" }}>
              CORE BANKING
            </Typography>
          </Box>
        </Stack>
          )}

            {/* Collapse toggle pinned top */}
            <Box sx={{ display: "grid", placeItems: "flex-end", px: 1.5, py: 1 }}>
        <Tooltip title={collapsed ? "Expand" : "Collapse"} placement="right">
          <IconButton
            size="small"
            onClick={onToggle}
            sx={{
              color: "rgba(231,238,247,0.7)",
              transform: collapsed ? "rotate(180deg)" : "none",
              "&:hover": { color: "#FFFFFF", bgcolor: "rgba(255,255,255,0.08)" },
            }}
          >
            <MenuRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      </Box>


      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />



      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflowY: "auto", py: 1.5, px: collapsed ? 1 : 1.25 }}>
        {sections.map((section) => (
          <Box key={section.heading} sx={{ mb: 1.5 }}>
            {!collapsed && (
              <Typography
                sx={{
                  px: 1.25,
                  mb: 0.5,
                  fontSize: "0.63rem",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(231,238,247,0.42)",
                }}
              >
                {section.heading}
              </Typography>
            )}
            <List disablePadding>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                const badgeCount = item.badge === "pendingApprovals" ? pendingApprovals : 0;

                const button = (
                  <ListItemButton
                    selected={active}
                    onClick={() => navigate(item.path)}
                    sx={{
                      borderRadius: 2,
                      py: 0.85,
                      px: collapsed ? 0 : 1.25,
                      justifyContent: collapsed ? "center" : "flex-start",
                      color: active ? "#FFFFFF" : "rgba(231,238,247,0.78)",
                      "&.Mui-selected": {
                        bgcolor: alpha(palette.brand.light, 0.28),
                        color: "#FFFFFF",
                        boxShadow: `inset 3px 0 0 ${palette.brand.light}`,
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: alpha(palette.brand.light, 0.34),
                      },
                      "&:hover": { bgcolor: "rgba(255,255,255,0.07)", color: "#FFFFFF" },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 38,
                        color: "inherit",
                        justifyContent: "center",
                      }}
                    >
                      {badgeCount > 0 ? (
                        <Badge badgeContent={badgeCount} color="error" max={99}>
                          <Icon fontSize="small" />
                        </Badge>
                      ) : (
                        <Icon fontSize="small" />
                      )}
                    </ListItemIcon>
                    {!collapsed && (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: "0.84rem",
                          fontWeight: active ? 700 : 500,
                          noWrap: true,
                        }}
                      />
                    )}
                  </ListItemButton>
                );

                return collapsed ? (
                  <Tooltip key={item.path} title={item.label} placement="right">
                    {button}
                  </Tooltip>
                ) : (
                  <NavLink key={item.path} to={item.path} style={{ textDecoration: "none" }}>
                    {button}
                  </NavLink>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Signed-in identity */}
      <Box sx={{ borderTop: `1px solid rgba(255,255,255,0.08)`, p: collapsed ? 1 : 1.5, flexShrink: 0 }}>
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              fontSize: "0.8rem",
              fontWeight: 700,
              bgcolor: alpha(palette.brand.light, 0.35),
              color: "#FFFFFF",
            }}
          >
            {user ? initials(user) : "?"}
          </Avatar>
          {!collapsed && (
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                noWrap
                sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#FFFFFF" }}
              >
                {user ? fullName(user) : "—"}
              </Typography>
              <Typography sx={{ fontSize: "0.68rem", color: "rgba(231,238,247,0.6)" }}>
                {role ? humanize(role) : ""}
              </Typography>
            </Box>
          )}
          <Tooltip title="Sign out" placement={collapsed ? "right" : "top"}>
            <IconButton
              size="small"
              onClick={handleLogout}
              aria-label="Sign out"
              sx={{
                color: "rgba(231,238,247,0.7)",
                "&:hover": { color: "#FFFFFF", bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              <LogoutOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

export default Sidebar;
