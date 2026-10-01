/** Presentation helpers. The server returns raw enums and float rupees. */

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let existing = currencyFormatters.get(currency);
  if (!existing) {
    existing = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, existing);
  }
  return existing;
}

/** `1234567.5, "INR"` -> `₹12,34,567.50`, matching Indian digit grouping. */
export function formatMoney(amount: number, currency = "INR"): string {
  try {
    return formatter(currency).format(amount ?? 0);
  } catch {
    return `${currency} ${(amount ?? 0).toFixed(2)}`;
  }
}

/** Compact form for dashboard tiles: `₹12.35L`, `₹4.2Cr`. */
export function formatCompactMoney(amount: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  const value = Math.abs(amount ?? 0);
  if (value >= 1_00_00_000) return `${symbol}${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (value >= 1_00_000) return `${symbol}${(value / 1_00_000).toFixed(2)}L`;
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return `${symbol}${value.toFixed(0)}`;
}

/**
 * Splits a bare `YYYY-MM-DD` into local-calendar parts.
 *
 * The API returns a date of birth as `"1990-05-04"`, and `new Date("1990-05-04")`
 * is specified to parse as UTC midnight — but `getDate()` and friends read the
 * *local* calendar. West of UTC that is the previous day, so the profile form
 * would load a date of birth as the day before and then save the wrong date on
 * the next unrelated edit. Constructing the date from its parts in local time
 * keeps the calendar day exactly as the server stated it.
 */
const BARE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A `Date` on the same calendar day the input names, in local time. */
function parseCalendarDate(value: string): Date | null {
  const bare = BARE_DATE.exec(value);
  if (bare) {
    const [, year, month, day] = bare;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = parseCalendarDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** `YYYY-MM-DD` for `<input type="date">`, guarding against timezone drift. */
export function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const date = parseCalendarDate(value);
  if (!date) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `FIXED_DEPOSIT` -> `Fixed Deposit`. */
export function humanize(value?: string | null): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function fullName(person: {
  firstName: string;
  lastName?: string | null;
}): string {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

export function initials(person: {
  firstName: string;
  lastName?: string | null;
}): string {
  const first = person.firstName?.charAt(0) ?? "";
  const last = person.lastName?.charAt(0) ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}

export function sameDay(a: string | Date, b: string | Date): boolean {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/** Group account numbers into readable blocks: `123456789012` -> `1234 5678 9012`. */
export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  const tail = accountNumber.slice(-4);
  return `•••• ${tail}`;
}
