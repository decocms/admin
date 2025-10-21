let formatter: Intl.RelativeTimeFormat;

interface TimeAgoOptions {
  /**
   * Format style:
   * - "short": "5m ago", "3h ago", "2d ago"
   * - "medium": "5 min ago", "3 hours ago"
   * - "long": "5 minutes ago", "3 hours ago" (default, uses Intl)
   */
  format?: "short" | "medium" | "long";
  /**
   * Maximum time unit to display before falling back to date.
   * Default: never falls back (always shows relative time)
   */
  maxDays?: number;
  /**
   * Fallback date formatter when maxDays is exceeded
   */
  fallbackFormat?: (date: Date) => string;
}

export function timeAgo(
  date: string | Date | number,
  options: TimeAgoOptions = {},
): string {
  const { format: formatStyle = "long", maxDays, fallbackFormat } = options;

  const now = new Date();
  const past = typeof date === "number" ? new Date(date) : new Date(date);
  const elapsed = now.getTime() - past.getTime();

  // Time units in milliseconds
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  // Check if we should fall back to absolute date
  if (maxDays !== undefined && elapsed > maxDays * DAY) {
    if (fallbackFormat) {
      return fallbackFormat(past);
    }
    return past.toLocaleDateString();
  }

  // Short format: "5m ago", "3h ago"
  if (formatStyle === "short") {
    const seconds = Math.floor(elapsed / SECOND);
    const minutes = Math.floor(elapsed / MINUTE);
    const hours = Math.floor(elapsed / HOUR);
    const days = Math.floor(elapsed / DAY);
    const weeks = Math.floor(elapsed / WEEK);
    const months = Math.floor(elapsed / MONTH);
    const years = Math.floor(elapsed / YEAR);

    if (seconds < 60) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
  }

  // Medium format: "5 min ago", "3 hours ago"
  if (formatStyle === "medium") {
    const seconds = Math.floor(elapsed / SECOND);
    const minutes = Math.floor(elapsed / MINUTE);
    const hours = Math.floor(elapsed / HOUR);
    const days = Math.floor(elapsed / DAY);
    const weeks = Math.floor(elapsed / WEEK);
    const months = Math.floor(elapsed / MONTH);
    const years = Math.floor(elapsed / YEAR);

    if (seconds < 60) {
      return seconds <= 1 ? "1s ago" : `${seconds}s ago`;
    }
    if (minutes < 60) {
      return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
    }
    if (hours < 24) {
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    }
    if (days < 7) {
      return days === 1 ? "1 day ago" : `${days} days ago`;
    }
    if (weeks < 4) {
      return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
    }
    if (months < 12) {
      return months === 1 ? "1 month ago" : `${months} months ago`;
    }
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }

  // Long format: use Intl.RelativeTimeFormat (default)
  formatter ??= new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
    style: "long",
  });

  // Determine the appropriate time unit
  if (Math.abs(elapsed) < MINUTE) {
    return formatter.format(-Math.round(elapsed / SECOND), "second");
  } else if (Math.abs(elapsed) < HOUR) {
    return formatter.format(-Math.round(elapsed / MINUTE), "minute");
  } else if (Math.abs(elapsed) < DAY) {
    return formatter.format(-Math.round(elapsed / HOUR), "hour");
  } else if (Math.abs(elapsed) < WEEK) {
    return formatter.format(-Math.round(elapsed / DAY), "day");
  } else if (Math.abs(elapsed) < MONTH) {
    return formatter.format(-Math.round(elapsed / WEEK), "week");
  } else if (Math.abs(elapsed) < YEAR) {
    return formatter.format(-Math.round(elapsed / MONTH), "month");
  } else {
    return formatter.format(-Math.round(elapsed / YEAR), "year");
  }
}
