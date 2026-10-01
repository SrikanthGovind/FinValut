import {
  Box,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Close";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { useMemo, useState, type ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: number | string;
  sortable?: boolean;
  /** Cell renderer. Falls back to the raw field when omitted. */
  render?: (row: T) => ReactNode;
  /**
   * Sort/search key. Needed when `render` outputs something that is not
   * directly comparable, e.g. a formatted currency string.
   */
  value?: (row: T) => string | number;
  /** Hide below this breakpoint when the table gets crowded. */
  hideBelow?: "sm" | "md" | "lg";
}

export interface DataTableFilterConfig {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface SortState {
  key: string;
  direction: "asc" | "desc";
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  /** Fields the free-text search scans. */
  searchKeys?: string[];
  searchPlaceholder?: string;
  filters?: DataTableFilterConfig[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  initialRowsPerPage?: number;
  initialSort?: SortState;
  /** Rendered on the right of the toolbar, e.g. an "Add" or "Export" button. */
  toolbarExtra?: ReactNode;
  footerNote?: ReactNode;
}

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

function rawField(row: unknown, key: string): string {
  const value = (row as Record<string, unknown>)[key];
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const HIDE_BELOW = {
  sm: { display: { xs: "none", sm: "table-cell" } },
  md: { display: { xs: "none", md: "table-cell" } },
  lg: { display: { xs: "none", lg: "table-cell" } },
} as const;

/**
 * One table for the whole application.
 *
 * The backend exposes unbounded lists with no pagination arguments, so
 * filtering, sorting and paging all happen here against the fetched set. That
 * is the honest trade: the alternative was paging arguments on queries the
 * server does not have.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  searchKeys = [],
  searchPlaceholder = "Search…",
  filters = [],
  onRowClick,
  loading = false,
  emptyTitle = "Nothing to show",
  emptyMessage = "No records match the current filters.",
  initialRowsPerPage = 10,
  initialSort,
  toolbarExtra,
  footerNote,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState | undefined>(initialSort);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  const activeFilters = useMemo(
    () => filters.filter((f) => filterValues[f.key]),
    [filters, filterValues]
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (needle) {
        const haystack = searchKeys
          .map((key) => rawField(row, key))
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return activeFilters.every((f) => rawField(row, f.key) === filterValues[f.key]);
    });

    if (!sort) return filtered;

    const column = columns.find((c) => c.key === sort.key);
    const read = (row: T): string | number =>
      column?.value
        ? column.value(row)
        : rawField(row, sort.key);

    return [...filtered].sort((a, b) => {
      const left = read(a);
      const right = read(b);
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), undefined, {
              numeric: true,
              sensitivity: "base",
            });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [rows, search, searchKeys, activeFilters, filterValues, sort, columns]);

  // Guard against the current page outliving a filter change that shrank the
  // result set, which otherwise renders a blank page with a valid page number.
  const safePage = Math.min(page, Math.max(Math.ceil(visible.length / rowsPerPage) - 1, 0));
  const pageRows = visible.slice(
    safePage * rowsPerPage,
    safePage * rowsPerPage + rowsPerPage
  );

  const toggleSort = (key: string) => {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return undefined;
    });
    setPage(0);
  };

  const clearAll = () => {
    setSearch("");
    setFilterValues({});
    setPage(0);
  };

  const hasControls = searchKeys.length > 0 || filters.length > 0;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {hasControls && (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ p: 2, pb: filters.length ? 1.5 : 2 }}
        >
          {searchKeys.length > 0 && (
            <TextField
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              sx={{ minWidth: { md: 280 }, flex: "0 1 320px" }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearch("")}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
              }}
            />
          )}

          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ flexWrap: "wrap", rowGap: 1 }}
          >
            {activeFilters.length > 0 && (
              <FilterAltOutlinedIcon fontSize="small" color="action" />
            )}
            {filters.map((filter) => (
              <Select
                key={filter.key}
                displayEmpty
                value={filterValues[filter.key] ?? ""}
                onChange={(event) => {
                  setFilterValues((current) => ({
                    ...current,
                    [filter.key]: event.target.value,
                  }));
                  setPage(0);
                }}
                renderValue={(value) =>
                  value ? String(value) : `All ${filter.label.toLowerCase()}`
                }
                sx={{ minWidth: 168 }}
              >
                <MenuItem value="">
                  <em>All {filter.label.toLowerCase()}</em>
                </MenuItem>
                {filter.options.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            ))}
            {hasControls && (search || activeFilters.length > 0) && (
              <Typography
                variant="caption"
                onClick={clearAll}
                sx={{
                  cursor: "pointer",
                  color: "primary.main",
                  fontWeight: 700,
                }}
              >
                Clear
              </Typography>
            )}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />
          {toolbarExtra}
        </Stack>
      )}

      {hasControls && filters.length > 0 && (
        <Divider sx={{ borderColor: "transparent" }} />
      )}

      <TableContainer sx={{ opacity: loading ? 0.5 : 1, transition: "opacity 120ms" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align ?? "left"}
                  sx={{
                    width: column.width,
                    ...(column.hideBelow ? HIDE_BELOW[column.hideBelow] : {}),
                  }}
                  sortDirection={
                    sort?.key === column.key ? sort.direction : false
                  }
                >
                  {column.sortable && column.key !== "actions" ? (
                    <TableSortLabel
                      active={sort?.key === column.key}
                      direction={sort?.key === column.key ? sort.direction : "asc"}
                      onClick={() => toggleSort(column.key)}
                      IconComponent={UnfoldMoreIcon}
                    >
                      {column.header}
                    </TableSortLabel>
                  ) : (
                    column.header
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ py: 6, border: 0 }}>
                  <Stack spacing={1} alignItems="center">
                    <Typography variant="subtitle1">{emptyTitle}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {emptyMessage}
                    </Typography>
                    {hasControls && (search || activeFilters.length > 0) && (
                      <ButtonLink onClick={clearAll}>Reset filters</ButtonLink>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {pageRows.map((row) => (
              <TableRow
                key={getRowId(row)}
                hover={Boolean(onRowClick)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align ?? "left"}
                    sx={
                      column.hideBelow ? HIDE_BELOW[column.hideBelow] : undefined
                    }
                  >
                    {column.render
                      ? column.render(row)
                      : rawField(row, column.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={visible.length}
        page={safePage}
        onPageChange={(_event, next) => setPage(next)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        labelRowsPerPage="Rows"
      />

      {footerNote && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {footerNote}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function ButtonLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip title="Clear search and filters">
      <Typography
        variant="body2"
        component="button"
        onClick={onClick}
        sx={{
          border: 0,
          background: "none",
          p: 0,
          cursor: "pointer",
          color: "primary.main",
          fontWeight: 700,
          fontFamily: "inherit",
        }}
      >
        {children}
      </Typography>
    </Tooltip>
  );
}
