import type { Context } from "hono";
import type { AppEnv } from "../utils/context.ts";

/**
 * Simple logger middleware with tool information highlighted
 */
export async function loggerMiddleware(
  c: Context<AppEnv>,
  next: () => Promise<void>,
) {
  const { method } = c.req;
  const url = new URL(c.req.url);
  const pathname = url.pathname;

  const start = Date.now();
  await next();
  const ms = Date.now() - start;

  // Color codes for status
  const status = c.res.status;
  let statusColor = "\x1b[0m"; // default
  let statusSuffix = "";
  if (status >= 200 && status < 300) {
    statusColor = "\x1b[32m"; // green
    statusSuffix = " OK";
  } else if (status >= 300 && status < 400) {
    statusColor = "\x1b[36m"; // cyan
  } else if (status >= 400 && status < 500) {
    statusColor = "\x1b[33m"; // yellow
  } else if (status >= 500) {
    statusColor = "\x1b[31m"; // red
  }

  // Simple formatting with fixed widths - no complex alignment
  // Format: [api] METHOD /path 200 OK (123ms)
  // Special highlighting for /tool/ paths
  const toolMatch = pathname.match(/\/tool\/([^/]+)$/);
  let formattedPath = pathname;
  if (toolMatch) {
    const basePath = pathname.replace(/\/tool\/[^/]+$/, "");
    const toolName = toolMatch[1];
    formattedPath = `${basePath}\x1b[96m/tool/\x1b[1m${toolName}\x1b[0m`;
  }

  // Log immediately with consistent formatting
  console.log(
    `\x1b[32m[api]\x1b[0m \x1b[1m${method}\x1b[0m ${formattedPath} ${statusColor}\x1b[1m${status}\x1b[0m${statusColor}${statusSuffix}\x1b[0m \x1b[90m(${ms}ms)\x1b[0m`,
  );
}
