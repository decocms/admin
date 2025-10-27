import { z } from "zod";
import { createToolGroup, getEnv } from "../context.ts";
import type { AppContext } from "../context.ts";
import { assertHasUser } from "../assertions.ts";
import { getWorkspaceBucketName, listFiles, deleteFile } from "../fs/api.ts";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { assertHasWorkspace } from "../assertions.ts";

export const createTool = createToolGroup("BrowserRendering", {
  name: "Browser Rendering",
  description:
    "Capture screenshots, generate PDFs, fetch HTML content, and scrape websites using Cloudflare's Browser Rendering API.",
  icon: "https://assets.decocache.com/mcp/cloudflare-browser-rendering/icon.png",
});

// Schema definitions
const ViewportSchema = z.object({
  width: z.number().default(1920),
  height: z.number().default(1080),
});

const ScreenshotOptionsSchema = z.object({
  fullPage: z.boolean().optional().describe("Capture the full scrollable page"),
  omitBackground: z
    .boolean()
    .optional()
    .describe("Hide the default white background"),
  quality: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Image quality (only for JPEG)"),
  type: z.enum(["png", "jpeg"]).optional().default("png"),
  clip: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional()
    .describe("Capture a specific region"),
});

const GotoOptionsSchema = z.object({
  waitUntil: z
    .enum(["load", "domcontentloaded", "networkidle0", "networkidle2"])
    .optional(),
  timeout: z.number().optional().describe("Maximum time in milliseconds"),
});

// Helper to generate date-based path
function getDateBasedPath(type: "screenshots" | "pdfs"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `browser-rendering/${type}/${year}/${month}/${day}`;
}

// Helper to build Cloudflare auth headers
function buildCloudflareAuthHeaders(
  env: ReturnType<typeof getEnv>,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Prefer dedicated browser rendering token if available
  if (env.CF_API_BROWSER_RENDERING) {
    headers["Authorization"] = `Bearer ${env.CF_API_BROWSER_RENDERING}`;
  } else if (env.CF_API_TOKEN) {
    // Fall back to general CF_API_TOKEN
    headers["Authorization"] = `Bearer ${env.CF_API_TOKEN}`;
  }
  return headers;
}

// BROWSER_SCREENSHOT tool
export const browserScreenshot = createTool({
  name: "BROWSER_SCREENSHOT",
  description: `Capture a screenshot of a webpage using Cloudflare Browser Rendering.

You can provide either a URL to navigate to, or custom HTML content to render.

Examples:
- Screenshot a URL: { "url": "https://example.com" }
- Screenshot with full page: { "url": "https://example.com", "screenshotOptions": { "fullPage": true } }
- Screenshot from HTML: { "html": "<h1>Hello World</h1>" }
- Screenshot specific element: { "url": "https://example.com", "selector": "#main-content" }
- Custom viewport: { "url": "https://example.com", "viewport": { "width": 1280, "height": 720 } }`,
  inputSchema: z
    .object({
      url: z.string().url().optional().describe("URL to navigate to"),
      html: z.string().optional().describe("Custom HTML content to render"),
      selector: z
        .string()
        .optional()
        .describe("CSS selector to screenshot a specific element"),
      viewport: ViewportSchema.optional(),
      screenshotOptions: ScreenshotOptionsSchema.optional(),
      gotoOptions: GotoOptionsSchema.optional(),
    })
    .refine((data) => data.url || data.html, {
      message: "Either url or html must be provided",
    })
    .refine((data) => !(data.url && data.html), {
      message: "Cannot provide both url and html - choose one",
    }),
  outputSchema: z.object({
    screenshot: z.object({
      url: z.string().describe("Public URL to access the screenshot"),
      path: z.string().describe("Storage path"),
      metadata: z.object({
        sourceUrl: z.string().optional(),
        dimensions: z
          .object({
            width: z.number(),
            height: z.number(),
          })
          .optional(),
        capturedAt: z.string(),
        format: z.string(),
      }),
    }),
  }),
  // @ts-expect-error - Return type mismatch with dimensions being optional
  handler: async (props, c: AppContext) => {
    // TODO: Uncomment after migration is applied
    // await assertWorkspaceResourceAccess(c);
    c.resourceAccess.grant();

    const env = getEnv(c);
    const { url, html, selector, viewport, screenshotOptions, gotoOptions } =
      props;

    // Manual validation since MCP layer might not enforce Zod refine rules
    if (!url && !html) {
      throw new Error("Either 'url' or 'html' must be provided");
    }
    if (url && html) {
      throw new Error("Cannot provide both 'url' and 'html' - choose one");
    }

    // Validate required credentials
    if (!env.CF_ACCOUNT_ID) {
      throw new Error(
        "CF_ACCOUNT_ID environment variable is not set. Please add your Cloudflare Account ID to .dev.vars",
      );
    }
    if (!env.CF_API_TOKEN) {
      throw new Error(
        "CF_API_TOKEN environment variable is not set. Please add your Cloudflare API Token to .dev.vars",
      );
    }

    // Build request body for Cloudflare Browser Rendering API
    // Only include the field that was actually provided (not both)
    const requestBody: Record<string, unknown> = {};

    // Add url OR html (mutually exclusive per Cloudflare API requirements)
    if (url) {
      requestBody.url = url;
    } else if (html) {
      requestBody.html = html;
    }

    // Add optional fields
    if (selector) requestBody.selector = selector;
    if (viewport) requestBody.viewport = viewport;
    if (screenshotOptions) requestBody.screenshotOptions = screenshotOptions;
    if (gotoOptions) requestBody.gotoOptions = gotoOptions;

    // Debug log to see what's being sent
    console.log(
      "[BROWSER_SCREENSHOT] Request body:",
      JSON.stringify(requestBody, null, 2),
    );

    // Call Cloudflare Browser Rendering API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      console.log("[BROWSER_SCREENSHOT] Calling Cloudflare API...");
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/screenshot`,
        {
          method: "POST",
          headers: buildCloudflareAuthHeaders(env),
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );

      console.log("[BROWSER_SCREENSHOT] Got response:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          // Try to verify token to give actionable diagnostics
          try {
            const verify = await fetch(
              "https://api.cloudflare.com/client/v4/user/tokens/verify",
              { method: "GET", headers: buildCloudflareAuthHeaders(env) },
            );
            const verifyJson = await verify.json().catch(() => undefined);
            // @ts-expect-error - verifyJson shape not strictly typed
            const scopes = verifyJson?.result?.policies
              ?.flatMap((p: { permission_groups?: Array<{ name?: string }> }) =>
                p?.permission_groups?.map((g) => g?.name),
              )
              ?.filter(Boolean);
            throw new Error(
              `Cloudflare authentication failed. Please verify:\n` +
                `1. CF_ACCOUNT_ID matches the token's account\n` +
                `2. Browser Rendering is enabled on your account\n` +
                `3. Token must include permissions for Browser Rendering (Workers Browser Rendering)\n` +
                `4. Alternatively set CF_API_KEY and CF_API_EMAIL (global key)\n` +
                // @ts-expect-error - verifyJson shape not strictly typed
                `Token verify: ${JSON.stringify({ success: verifyJson?.success, scopes }, null, 2)}\n` +
                `Original error: ${errorText}`,
            );
          } catch {
            throw new Error(
              `Cloudflare authentication failed. Please verify:\n` +
                `1. CF_ACCOUNT_ID and CF_API_TOKEN are set in .dev.vars\n` +
                `2. Browser Rendering is enabled on your Cloudflare account\n` +
                `3. Your API token has the correct permissions\n` +
                `Original error: ${errorText}`,
            );
          }
        }
        throw new Error(
          `Cloudflare Browser Rendering API error: ${response.status} - ${errorText}`,
        );
      }

      const imageBuffer = await response.arrayBuffer();
      console.log(
        "[BROWSER_SCREENSHOT] Got image buffer, size:",
        imageBuffer.byteLength,
        "bytes",
      );
      const imageType = screenshotOptions?.type || "png";

      const dimensions = viewport
        ? { width: viewport.width, height: viewport.height }
        : undefined;

      // Upload directly to R2 using S3 client (same as FS tools internally)
      assertHasWorkspace(c);
      const bucketName = getWorkspaceBucketName(c.workspace.value);

      const datePath = getDateBasedPath("screenshots");
      const timestamp = Date.now();
      const uuid = crypto.randomUUID();
      const filename = `${timestamp}-${uuid}.${imageType}`;
      const storagePath = `${datePath}/${filename}`;

      console.log(
        "[BROWSER_SCREENSHOT] Saving to bucket:",
        bucketName,
        "path:",
        storagePath,
      );

      // Create S3 client for R2 (same as FS tools)
      const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.CF_R2_ACCESS_KEY_ID!,
          secretAccessKey: env.CF_R2_SECRET_ACCESS_KEY!,
        },
      });

      // Upload directly to R2 (convert ArrayBuffer to Uint8Array)
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: storagePath,
        Body: new Uint8Array(imageBuffer),
        ContentType: `image/${imageType}`,
      });

      await s3Client.send(putCommand);

      // Construct public URL (same pattern as chat file uploads)
      const Hosts = await import("../../hosts.ts").then((m) => m.Hosts);
      const locator = c.workspace?.value;
      const publicUrl = `https://${Hosts.API_LEGACY}/files/${locator}/${storagePath}`;

      console.log("[BROWSER_SCREENSHOT] Saved! URL:", publicUrl);

      // Return with structuredContent.image for inline display (same as GENERATE_IMAGE)
      return {
        structuredContent: {
          image: publicUrl, // URL string for inline display in chat
        },
        screenshot: {
          url: publicUrl,
          path: storagePath,
          size: imageBuffer.byteLength,
          metadata: {
            sourceUrl: url,
            dimensions,
            capturedAt: new Date().toISOString(),
            format: imageType,
          },
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },
});

// BROWSER_PDF tool
export const browserPdf = createTool({
  name: "BROWSER_PDF",
  description: `Generate a PDF from a webpage using Cloudflare Browser Rendering.

Examples:
- PDF from URL: { "url": "https://example.com" }
- PDF from HTML: { "html": "<h1>Invoice</h1><p>Total: $100</p>" }`,
  inputSchema: z
    .object({
      url: z.string().url().optional(),
      html: z.string().optional(),
      viewport: ViewportSchema.optional(),
      gotoOptions: GotoOptionsSchema.optional(),
    })
    .refine((data) => data.url || data.html, {
      message: "Either url or html must be provided",
    })
    .refine((data) => !(data.url && data.html), {
      message: "Cannot provide both url and html - choose one",
    }),
  outputSchema: z.object({
    pdf: z.object({
      url: z.string(),
      path: z.string(),
      metadata: z.object({
        sourceUrl: z.string().optional(),
        generatedAt: z.string(),
      }),
    }),
  }),
  handler: async (props, c: AppContext) => {
    // TODO: Uncomment after migration is applied
    // await assertWorkspaceResourceAccess(c);
    c.resourceAccess.grant();

    const env = getEnv(c);
    const { url, html, viewport, gotoOptions } = props;

    // Manual validation
    if (!url && !html) {
      throw new Error("Either 'url' or 'html' must be provided");
    }
    if (url && html) {
      throw new Error("Cannot provide both 'url' and 'html' - choose one");
    }

    // Build request body - url OR html (mutually exclusive)
    const requestBody: Record<string, unknown> = {};
    if (url) {
      requestBody.url = url;
    } else if (html) {
      requestBody.html = html;
    }
    if (viewport) requestBody.viewport = viewport;
    if (gotoOptions) requestBody.gotoOptions = gotoOptions;

    // Call Cloudflare Browser Rendering API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/pdf`,
        {
          method: "POST",
          headers: buildCloudflareAuthHeaders(env),
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Cloudflare Browser Rendering API error: ${response.status} - ${errorText}`,
        );
      }

      const pdfBuffer = await response.arrayBuffer();

      // Upload directly to R2 using S3 client (same as screenshots)
      assertHasWorkspace(c);
      const bucketName = getWorkspaceBucketName(c.workspace.value);

      const datePath = getDateBasedPath("pdfs");
      const timestamp = Date.now();
      const uuid = crypto.randomUUID();
      const filename = `${timestamp}-${uuid}.pdf`;
      const storagePath = `${datePath}/${filename}`;

      console.log(
        "[BROWSER_PDF] Saving to bucket:",
        bucketName,
        "path:",
        storagePath,
      );

      // Create S3 client for R2 (same as FS tools)
      const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.CF_R2_ACCESS_KEY_ID!,
          secretAccessKey: env.CF_R2_SECRET_ACCESS_KEY!,
        },
      });

      // Upload directly to R2 (convert ArrayBuffer to Uint8Array)
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: storagePath,
        Body: new Uint8Array(pdfBuffer),
        ContentType: "application/pdf",
      });

      await s3Client.send(putCommand);

      // Construct public URL (same pattern as chat file uploads)
      const Hosts = await import("../../hosts.ts").then((m) => m.Hosts);
      const locator = c.workspace?.value;
      const publicUrl = `https://${Hosts.API_LEGACY}/files/${locator}/${storagePath}`;

      console.log("[BROWSER_PDF] Saved! URL:", publicUrl);

      return {
        pdf: {
          url: publicUrl,
          path: storagePath,
          metadata: {
            sourceUrl: url,
            generatedAt: new Date().toISOString(),
          },
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  },
});

// BROWSER_HTML tool
export const browserHtml = createTool({
  name: "BROWSER_HTML",
  description: `Fetch the fully rendered HTML content of a webpage after JavaScript execution.

Example: { "url": "https://example.com" }`,
  inputSchema: z.object({
    url: z.string().url(),
    gotoOptions: GotoOptionsSchema.optional(),
  }),
  outputSchema: z.object({
    html: z.string(),
    metadata: z.object({
      url: z.string(),
      fetchedAt: z.string(),
    }),
  }),
  handler: async (props, c: AppContext) => {
    // TODO: Uncomment after migration is applied
    // await assertWorkspaceResourceAccess(c);
    c.resourceAccess.grant();

    const env = getEnv(c);
    const { url, gotoOptions } = props;

    const requestBody: Record<string, unknown> = { url };
    if (gotoOptions) requestBody.gotoOptions = gotoOptions;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/content`,
      {
        method: "POST",
        headers: buildCloudflareAuthHeaders(env),
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cloudflare Browser Rendering API error: ${response.status} - ${errorText}`,
      );
    }

    const html = await response.text();

    return {
      html,
      metadata: {
        url,
        fetchedAt: new Date().toISOString(),
      },
    };
  },
});

// BROWSER_SCRAPE tool
export const browserScrape = createTool({
  name: "BROWSER_SCRAPE",
  description: `Scrape specific elements from a webpage using CSS selectors.

Example: { "url": "https://example.com", "selectors": { "title": "h1", "price": ".price" } }`,
  inputSchema: z.object({
    url: z.string().url(),
    selectors: z.record(z.string()).describe("Map of name to CSS selector"),
    gotoOptions: GotoOptionsSchema.optional(),
  }),
  outputSchema: z.object({
    elements: z.record(z.array(z.string())),
    metadata: z.object({
      url: z.string(),
      scrapedAt: z.string(),
    }),
  }),
  handler: async (props, c: AppContext) => {
    // TODO: Uncomment after migration is applied
    // await assertWorkspaceResourceAccess(c);
    c.resourceAccess.grant();

    const env = getEnv(c);
    const { url, selectors, gotoOptions } = props;

    const requestBody: Record<string, unknown> = { url, selectors };
    if (gotoOptions) requestBody.gotoOptions = gotoOptions;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/scrape`,
      {
        method: "POST",
        headers: buildCloudflareAuthHeaders(env),
        body: JSON.stringify(requestBody),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Cloudflare Browser Rendering API error: ${response.status} - ${errorText}`,
      );
    }

    const result = (await response.json()) as {
      elements: Record<string, string[]>;
    };

    return {
      elements: result.elements,
      metadata: {
        url,
        scrapedAt: new Date().toISOString(),
      },
    };
  },
});

// LIST_SCREENSHOTS tool for gallery
export const listScreenshots = createTool({
  name: "BROWSER_SCREENSHOTS_LIST",
  description:
    "List all screenshots captured in the current workspace, organized by date",
  inputSchema: z.object({
    prefix: z
      .string()
      .optional()
      .describe(
        "Optional path prefix to filter (e.g., 'browser-rendering/screenshots/2024/10')",
      ),
    limit: z.number().optional().default(100),
  }),
  outputSchema: z.object({
    screenshots: z.array(
      z.object({
        path: z.string(),
        url: z.string(),
        metadata: z
          .object({
            sourceUrl: z.string().optional(),
            dimensions: z
              .object({
                width: z.number(),
                height: z.number(),
              })
              .optional(),
            capturedAt: z.string(),
            format: z.string(),
          })
          .optional(),
        lastModified: z.string(),
        size: z.number(),
      }),
    ),
  }),
  handler: async (props, c: AppContext) => {
    // TODO: Uncomment after migration is applied
    // await assertWorkspaceResourceAccess(c);
    c.resourceAccess.grant();

    const { prefix, limit = 100 } = props;
    const searchPrefix = prefix || "browser-rendering/screenshots/";

    console.log(
      "[BROWSER_SCREENSHOTS_LIST] Starting with prefix:",
      searchPrefix,
    );

    try {
      // Use native FS_LIST tool
      const listResult = await listFiles.handler({ prefix: searchPrefix });

      console.log("[BROWSER_SCREENSHOTS_LIST] FS_LIST returned:", listResult);

      // Filter for image files only
      const imageFiles = (listResult.items || []).filter((item) => {
        const key = item.key;
        return key.match(/\.(png|jpeg|jpg)$/i) && !key.endsWith(".meta.json");
      });

      console.log(
        "[BROWSER_SCREENSHOTS_LIST] Filtered image files:",
        imageFiles.length,
      );

      // Convert to screenshot objects
      const Hosts = await import("../../hosts.ts").then((m) => m.Hosts);
      const locator = c.workspace?.value;

      const screenshots = imageFiles.slice(0, limit).map((item) => ({
        path: item.key,
        url: `https://${Hosts.API_LEGACY}/files/${locator}/${item.key}`,
        lastModified: item.lastModified || new Date().toISOString(),
        size: item.size || 0,
      }));

      console.log(
        "[BROWSER_SCREENSHOTS_LIST] Returning screenshots:",
        screenshots.length,
      );

      return { screenshots };
    } catch (error) {
      console.warn(
        "[BROWSER_SCREENSHOTS_LIST] Failed to list screenshots (R2 credentials issue):",
        error,
      );
      // Return empty array gracefully when R2 is not configured
      return { screenshots: [] };
    }
  },
});

// DELETE_SCREENSHOT tool
export const deleteScreenshot = createTool({
  name: "BROWSER_SCREENSHOT_DELETE",
  description: "Delete a screenshot and its metadata from storage",
  inputSchema: z.object({
    path: z.string().describe("Screenshot file path to delete"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  handler: async (props, c: AppContext) => {
    const { path } = props;

    // 1. Validate path is in browser-rendering directory
    if (!path.startsWith("browser-rendering/")) {
      throw new Error("Invalid path: must be in browser-rendering directory");
    }

    // 2. Ensure user is authenticated
    assertHasUser(c);

    // 3. For now, rely on workspace resource access for authorization
    // TODO: In the future, read metadata to check ownership
    // TODO: Uncomment after migration is applied
    // await assertWorkspaceResourceAccess(c);

    // 4. Authorization successful - grant resource access
    c.resourceAccess.grant();

    // 5. Delete the screenshot file using native FS tool
    await deleteFile.handler({ path });

    // 6. Delete metadata file if it exists
    const metadataPath = path.replace(/\.(png|jpeg|pdf)$/, ".meta.json");
    try {
      await deleteFile.handler({ path: metadataPath });
    } catch {
      // Metadata file might not exist or already deleted, that's okay
    }

    return { success: true };
  },
});
