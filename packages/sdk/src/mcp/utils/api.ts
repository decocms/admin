import { z } from "zod/v3";
import { createToolGroup } from "../context.ts";

// Create a custom tool group for HTTP
const createHTTPTool = createToolGroup("HTTP", {
  name: "HTTP",
  description:
    "Make HTTP requests to any URL with support for multiple methods, headers, and response parsing.",
  icon: "https://assets.webdraw.app/uploads/utils.png",
  workspace: false,
});

// Create a custom tool group for DateTime utilities
const createDateTimeTool = createToolGroup("Time", {
  name: "Time",
  description:
    "Date and time utility functions for getting current time information.",
  icon: "https://assets.webdraw.app/uploads/utils.png",
  workspace: false,
});

// Maximum size for binary responses (10MB)
const MAX_BINARY_SIZE = 10 * 1024 * 1024;

// Fetch tool schema
const FetchInputSchema = z.object({
  url: z.string().describe("The URL to fetch content from"),
  method: z
    .enum(["GET", "PUT", "POST", "DELETE", "PATCH", "HEAD"] as const)
    .default("GET")
    .describe("The HTTP method to use for the request"),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("Optional headers to include with the request"),
  body: z.any().optional().describe("Optional body to send with the request"),
  responseType: z
    .enum(["text", "json", "binary"] as const)
    .default("text")
    .describe(
      "How to parse the response body: 'text' returns raw text, 'json' parses and returns JSON, 'binary' returns base64-encoded data",
    ),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(10000)
    .describe("Request timeout in milliseconds (1000-30000)"),
});

const FetchOutputSchema = z.object({
  body: z
    .union([z.string(), z.any()])
    .describe(
      "The response body (string for text, parsed object for JSON, base64-encoded string for binary)",
    ),
  status: z.number().describe("The HTTP status code of the response"),
  statusText: z.string().describe("The HTTP status text of the response"),
  headers: z.record(z.string(), z.string()).describe("The response headers"),
  ok: z
    .boolean()
    .describe("Whether the request was successful (status in 200-299 range)"),
  contentType: z
    .string()
    .optional()
    .describe("The Content-Type header value (included for binary responses)"),
  size: z
    .number()
    .optional()
    .describe(
      "The size of the binary response in bytes (included for binary responses)",
    ),
});

/**
 * Helper function to convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * HTTP_FETCH
 *
 * A tool that exposes the fetch API to users, allowing them to make HTTP requests
 * to any URL with custom headers, body, and other options.
 */
export const httpFetch = createHTTPTool({
  name: "HTTP_FETCH",
  description:
    "Make HTTP requests to any URL. Supports multiple HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD), " +
    "custom headers, request body, and response parsing. Use this when you need to fetch data from external APIs " +
    "or make HTTP calls that don't have a specific integration available. Supports text, JSON, and binary (base64-encoded) response parsing.",
  inputSchema: FetchInputSchema,
  outputSchema: FetchOutputSchema,
  handler: async (
    { url: targetUrl, method, headers = {}, body, responseType, timeout },
    c,
  ) => {
    c.resourceAccess.grant();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const requestHeaders = new Headers(headers);
      if (body && typeof body === "object") {
        requestHeaders.set("Content-Type", "application/json");
      }

      const requestInit: RequestInit = {
        method,
        headers: requestHeaders,
        signal: controller.signal,
        body: body && typeof body === "object" ? JSON.stringify(body) : body,
      };

      const response = await fetch(targetUrl, requestInit);

      // Parse response body based on responseType
      let responseBody: string | unknown;
      let contentType: string | undefined;
      let size: number | undefined;

      // Get content type to help with auto-detection
      const responseContentType = response.headers.get("content-type") || "";

      // Helper function to check if content is binary
      const isBinaryContent = () =>
        responseContentType.startsWith("video/") ||
        responseContentType.startsWith("audio/") ||
        responseContentType.startsWith("image/") ||
        responseContentType === "application/octet-stream" ||
        responseContentType.startsWith("application/pdf") ||
        responseContentType.startsWith("application/zip");

      if (responseType === "json") {
        try {
          responseBody = await response.json();
        } catch (parseError) {
          // If JSON parsing fails, fall back to text
          const text = await response.text();
          throw new Error(
            `Failed to parse response as JSON: ${
              parseError instanceof Error ? parseError.message : "Unknown error"
            }. Response text: ${text.substring(0, 200)}${
              text.length > 200 ? "..." : ""
            }`,
          );
        }
      } else if (
        responseType === "binary" ||
        (responseType === "text" && isBinaryContent())
      ) {
        // Handle as binary when explicitly requested OR when content-type indicates binary data (and user hasn't explicitly chosen json)
        // Get content length from headers for validation
        const contentLength = response.headers.get("content-length");
        if (contentLength) {
          const expectedSize = Number.parseInt(contentLength, 10);
          if (expectedSize > MAX_BINARY_SIZE) {
            throw new Error(
              `Binary response size (${expectedSize} bytes) exceeds maximum allowed size (${MAX_BINARY_SIZE} bytes)`,
            );
          }
        }

        const arrayBuffer = await response.arrayBuffer();
        size = arrayBuffer.byteLength;

        // Validate actual size
        if (size > MAX_BINARY_SIZE) {
          throw new Error(
            `Binary response size (${size} bytes) exceeds maximum allowed size (${MAX_BINARY_SIZE} bytes)`,
          );
        }

        responseBody = arrayBufferToBase64(arrayBuffer);
        contentType = responseContentType || undefined;
      } else {
        // Default to text for text-based content
        responseBody = await response.text();
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        body: responseBody,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        ok: response.ok,
        ...(contentType && { contentType }),
        ...(size !== undefined && { size }),
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },
});

/**
 * NOW_DATETIME
 *
 * A tool that provides current date and time information in multiple formats.
 */
export const nowDateTime = createDateTimeTool({
  name: "NOW_DATETIME",
  description:
    "Get current date and time in human-readable format, ISO 8601, and Unix timestamp",
  inputSchema: z.object({}),
  outputSchema: z.object({
    formatted: z.string().describe("Human-readable date and time"),
    iso: z.string().describe("ISO 8601 format"),
    timestamp: z.number().describe("Unix timestamp in milliseconds"),
  }),
  handler: async (_, c) => {
    c.resourceAccess.grant();

    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    };

    // Use en-US for consistent formatting across all environments
    const formatted = new Intl.DateTimeFormat("en-US", options).format(now);

    return {
      formatted,
      iso: now.toISOString(),
      timestamp: now.getTime(),
    };
  },
});
