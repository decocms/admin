import { z } from "zod";
import { createToolGroup } from "../context.ts";

// Create a custom tool group for HTTP
const createHTTPTool = createToolGroup("HTTP", {
  name: "HTTP",
  description:
    "Make HTTP requests to any URL with support for multiple methods, headers, and response parsing.",
  icon: "https://assets.webdraw.app/uploads/utils.png",
  workspace: false,
});

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
    .enum(["text", "json"] as const)
    .default("text")
    .describe(
      "How to parse the response body: 'text' returns the raw text, 'json' parses and returns JSON",
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
    .describe("The response body (string for text, parsed object for JSON)"),
  status: z.number().describe("The HTTP status code of the response"),
  statusText: z.string().describe("The HTTP status text of the response"),
  headers: z.record(z.string(), z.string()).describe("The response headers"),
  ok: z
    .boolean()
    .describe("Whether the request was successful (status in 200-299 range)"),
});

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
    "or make HTTP calls that don't have a specific integration available. Supports both text and JSON response parsing.",
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
      } else {
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
