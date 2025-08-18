let formatter: Intl.RelativeTimeFormat;
export function timeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const elapsed = now.getTime() - past.getTime();

  // Create formatter with English locale
  formatter ??= new Intl.RelativeTimeFormat('en', {
    numeric: 'auto',
    style: 'long',
  });

  // Time units in milliseconds
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  // Determine the appropriate time unit
  if (Math.abs(elapsed) < MINUTE) {
    return formatter.format(-Math.round(elapsed / SECOND), 'second');
  } else if (Math.abs(elapsed) < HOUR) {
    return formatter.format(-Math.round(elapsed / MINUTE), 'minute');
  } else if (Math.abs(elapsed) < DAY) {
    return formatter.format(-Math.round(elapsed / HOUR), 'hour');
  } else if (Math.abs(elapsed) < WEEK) {
    return formatter.format(-Math.round(elapsed / DAY), 'day');
  } else if (Math.abs(elapsed) < MONTH) {
    return formatter.format(-Math.round(elapsed / WEEK), 'week');
  } else if (Math.abs(elapsed) < YEAR) {
    return formatter.format(-Math.round(elapsed / MONTH), 'month');
  } else {
    return formatter.format(-Math.round(elapsed / YEAR), 'year');
  }
}
