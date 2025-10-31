export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function formatLogEntry(log: {
  timestamp: string;
  type: string;
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
}): string {
  const time = formatTime(log.timestamp);
  const source = log.source ? ` [${log.source}:${log.line}:${log.column}]` : "";
  const stack = log.stack ? `\n${log.stack}` : "";
  return `[${time}] ${log.type.toUpperCase()}: ${log.message}${source}${stack}`;
}
