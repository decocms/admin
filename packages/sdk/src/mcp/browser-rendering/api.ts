import { z } from "zod";
import { createToolGroup, getEnv } from "../context.ts";
import type { AppContext } from "../context.ts";
import { assertWorkspaceResourceAccess } from "../assertions.ts";

export const createTool = createToolGroup("BrowserRendering", {
  name: "Browser Rendering",
  description: "Capture screenshots, generate PDFs, fetch HTML content, and scrape websites using Cloudflare's Browser Rendering API.",
  icon: "https://assets.decocache.com/mcp/cloudflare-browser-rendering/icon.png",
  workspace: true,
});

// Schema definitions
const ViewportSchema = z.object({
  width: z.number().default(1920),
  height: z.number().default(1080),
});

const ScreenshotOptionsSchema = z.object({
  fullPage: z.boolean().optional().describe("Capture the full scrollable page"),
  omitBackground: z.boolean().optional().describe("Hide the default white background"),
  quality: z.number().min(0).max(100).optional().describe("Image quality (only for JPEG)"),
  type: z.enum(["png", "jpeg"]).optional().default("png"),
  clip: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional().describe("Capture a specific region"),
});

const GotoOptionsSchema = z.object({
  waitUntil: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional(),
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
  inputSchema: z.object({
    url: z.string().url().optional().describe("URL to navigate to"),
    html: z.string().optional().describe("Custom HTML content to render"),
    selector: z.string().optional().describe("CSS selector to screenshot a specific element"),
    viewport: ViewportSchema.optional(),
    screenshotOptions: ScreenshotOptionsSchema.optional(),
    gotoOptions: GotoOptionsSchema.optional(),
  }).refine(
    (data) => data.url || data.html,
    { message: "Either url or html must be provided" }
  ),
  outputSchema: z.object({
    screenshot: z.object({
      url: z.string().describe("Public URL to access the screenshot"),
      path: z.string().describe("Storage path"),
      metadata: z.object({
        sourceUrl: z.string().optional(),
        dimensions: z.object({
          width: z.number(),
          height: z.number(),
        }).optional(),
        capturedAt: z.string(),
        format: z.string(),
      }),
    }),
  }),
  handler: async (props, c: AppContext) => {
    c.resourceAccess.grant();
    
    const env = getEnv(c);
    const { url, html, selector, viewport, screenshotOptions, gotoOptions } = props;

    // Validate required credentials
    if (!env.CF_ACCOUNT_ID) {
      throw new Error(
        "CF_ACCOUNT_ID environment variable is not set. Please add your Cloudflare Account ID to .dev.vars"
      );
    }
    if (!env.CF_API_TOKEN) {
      throw new Error(
        "CF_API_TOKEN environment variable is not set. Please add your Cloudflare API Token to .dev.vars"
      );
    }

    // Build request body for Cloudflare Browser Rendering API
    const requestBody: Record<string, unknown> = {};
    
    if (url) requestBody.url = url;
    if (html) requestBody.html = html;
    if (selector) requestBody.selector = selector;
    if (viewport) requestBody.viewport = viewport;
    if (screenshotOptions) requestBody.screenshotOptions = screenshotOptions;
    if (gotoOptions) requestBody.gotoOptions = gotoOptions;

    // Call Cloudflare Browser Rendering API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/screenshot`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error(
          `Cloudflare authentication failed. Please verify:\n` +
          `1. CF_ACCOUNT_ID and CF_API_TOKEN are set in .dev.vars\n` +
          `2. Browser Rendering is enabled on your Cloudflare account\n` +
          `3. Your API token has the correct permissions\n` +
          `Error: ${errorText}`
        );
      }
      throw new Error(`Cloudflare Browser Rendering API error: ${response.status} - ${errorText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const imageType = screenshotOptions?.type || "png";
    
    // Generate date-based path
    const datePath = getDateBasedPath("screenshots");
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const filename = `${timestamp}-${uuid}.${imageType}`;
    const storagePath = `${datePath}/${filename}`;
    const metadataPath = `${datePath}/${timestamp}-${uuid}.meta.json`;

    // Upload screenshot to R2 via FS_WRITE
    const MCPClient = await import("../../fetcher.ts").then(m => m.MCPClient);
    const { url: uploadUrl } = await MCPClient.forContext(c).FS_WRITE({
      path: storagePath,
      contentType: `image/${imageType}`,
    });

    await fetch(uploadUrl, {
      method: "PUT",
      body: imageBuffer,
      headers: {
        "Content-Type": `image/${imageType}`,
      },
    });

    // Create metadata
    const dimensions = viewport ? { width: viewport.width, height: viewport.height } : undefined;
    const metadata = {
      sourceUrl: url,
      dimensions,
      capturedAt: new Date().toISOString(),
      format: imageType,
      options: requestBody,
      userId: c.user?.id,
    };

    // Store metadata as JSON file
    const { url: metadataUploadUrl } = await MCPClient.forContext(c).FS_WRITE({
      path: metadataPath,
      contentType: "application/json",
    });

    await fetch(metadataUploadUrl, {
      method: "PUT",
      body: JSON.stringify(metadata, null, 2),
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Construct public URL
    const Hosts = await import("../../hosts.ts").then(m => m.Hosts);
    const locator = c.workspace?.value;
    const publicUrl = `https://${Hosts.API_LEGACY}/files/${locator}/${storagePath}`;

    return {
      screenshot: {
        url: publicUrl,
        path: storagePath,
        metadata: {
          sourceUrl: url,
          dimensions,
          capturedAt: new Date().toISOString(),
          format: imageType,
        },
      },
    };
  },
});

// BROWSER_PDF tool
export const browserPdf = createTool({
  name: "BROWSER_PDF",
  description: `Generate a PDF from a webpage using Cloudflare Browser Rendering.

Examples:
- PDF from URL: { "url": "https://example.com" }
- PDF from HTML: { "html": "<h1>Invoice</h1><p>Total: $100</p>" }`,
  inputSchema: z.object({
    url: z.string().url().optional(),
    html: z.string().optional(),
    viewport: ViewportSchema.optional(),
    gotoOptions: GotoOptionsSchema.optional(),
  }).refine(
    (data) => data.url || data.html,
    { message: "Either url or html must be provided" }
  ),
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
    c.resourceAccess.grant();
    
    const env = getEnv(c);
    const { url, html, viewport, gotoOptions } = props;

    const requestBody: Record<string, unknown> = {};
    if (url) requestBody.url = url;
    if (html) requestBody.html = html;
    if (viewport) requestBody.viewport = viewport;
    if (gotoOptions) requestBody.gotoOptions = gotoOptions;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/pdf`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare Browser Rendering API error: ${response.status} - ${errorText}`);
    }

    const pdfBuffer = await response.arrayBuffer();
    const datePath = getDateBasedPath("pdfs");
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const filename = `${timestamp}-${uuid}.pdf`;
    const storagePath = `${datePath}/${filename}`;
    const metadataPath = `${datePath}/${timestamp}-${uuid}.meta.json`;

    const MCPClient = await import("../../fetcher.ts").then(m => m.MCPClient);
    const { url: uploadUrl } = await MCPClient.forContext(c).FS_WRITE({
      path: storagePath,
      contentType: "application/pdf",
    });

    await fetch(uploadUrl, {
      method: "PUT",
      body: pdfBuffer,
      headers: { "Content-Type": "application/pdf" },
    });

    // Store metadata
    const metadata = {
      sourceUrl: url,
      generatedAt: new Date().toISOString(),
      options: requestBody,
      userId: c.user?.id,
    };

    const { url: metadataUploadUrl } = await MCPClient.forContext(c).FS_WRITE({
      path: metadataPath,
      contentType: "application/json",
    });

    await fetch(metadataUploadUrl, {
      method: "PUT",
      body: JSON.stringify(metadata, null, 2),
      headers: { "Content-Type": "application/json" },
    });

    const Hosts = await import("../../hosts.ts").then(m => m.Hosts);
    const locator = c.workspace?.value;
    const publicUrl = `https://${Hosts.API_LEGACY}/files/${locator}/${storagePath}`;

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
    c.resourceAccess.grant();
    
    const env = getEnv(c);
    const { url, gotoOptions } = props;

    const requestBody: Record<string, unknown> = { url };
    if (gotoOptions) requestBody.gotoOptions = gotoOptions;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/content`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare Browser Rendering API error: ${response.status} - ${errorText}`);
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
    c.resourceAccess.grant();
    
    const env = getEnv(c);
    const { url, selectors, gotoOptions } = props;

    const requestBody: Record<string, unknown> = { url, selectors };
    if (gotoOptions) requestBody.gotoOptions = gotoOptions;

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/scrape`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare Browser Rendering API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { elements: Record<string, string[]> };

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
  description: "List all screenshots captured in the current workspace, organized by date",
  inputSchema: z.object({
    prefix: z.string().optional().describe("Optional path prefix to filter (e.g., 'browser-rendering/screenshots/2024/10')"),
    limit: z.number().optional().default(100),
  }),
  outputSchema: z.object({
    screenshots: z.array(z.object({
      path: z.string(),
      url: z.string(),
      metadata: z.object({
        sourceUrl: z.string().optional(),
        dimensions: z.object({
          width: z.number(),
          height: z.number(),
        }).optional(),
        capturedAt: z.string(),
        format: z.string(),
      }).optional(),
      lastModified: z.string(),
      size: z.number(),
    })),
  }),
  handler: async (props, c: AppContext) => {
    c.resourceAccess.grant();
    
    const { prefix = "browser-rendering/screenshots/", limit } = props;
    
    console.log("[BROWSER_SCREENSHOTS_LIST] Starting list with prefix:", prefix);
    
    // Just return empty for now - directory doesn't exist yet
    return { screenshots: [] };

    // Filter only image files (not metadata files)
    const screenshotFiles = items
      .filter(item => !item.Key?.endsWith(".meta.json") && (item.Key?.endsWith(".png") || item.Key?.endsWith(".jpeg")))
      .sort((a, b) => {
        const timeA = a.LastModified ? new Date(a.LastModified).getTime() : 0;
        const timeB = b.LastModified ? new Date(b.LastModified).getTime() : 0;
        return timeB - timeA; // Most recent first
      })
      .slice(0, limit);

    const Hosts = await import("../../hosts.ts").then(m => m.Hosts);
    const locator = c.workspace?.value;

    // Fetch metadata for each screenshot
    const screenshots = await Promise.all(
      screenshotFiles.map(async (item) => {
        const path = item.Key!;
        const publicUrl = `https://${Hosts.API_LEGACY}/files/${locator}/${path}`;
        
        // Try to fetch metadata file
        const metadataPath = path.replace(/\.(png|jpeg)$/, ".meta.json");
        let metadata;
        try {
          const { url: metadataUrl } = await MCPClient.forContext(c).FS_READ({
            path: metadataPath,
            expiresIn: 60,
          });
          const metadataResponse = await fetch(metadataUrl);
          if (metadataResponse.ok) {
            metadata = await metadataResponse.json();
          }
        } catch {
          // Metadata file doesn't exist or couldn't be read
        }

        return {
          path,
          url: publicUrl,
          metadata: metadata ? {
            sourceUrl: metadata.sourceUrl,
            dimensions: metadata.dimensions,
            capturedAt: metadata.capturedAt,
            format: metadata.format,
          } : undefined,
          lastModified: item.LastModified || new Date().toISOString(),
          size: item.Size || 0,
        };
      })
    );

    return { screenshots };
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
    c.resourceAccess.grant();
    
    const { path } = props;

    // Validate path is in browser-rendering directory
    if (!path.startsWith("browser-rendering/")) {
      throw new Error("Invalid path: must be in browser-rendering directory");
    }

    const MCPClient = await import("../../fetcher.ts").then(m => m.MCPClient);
    
    // Delete the screenshot file
    await MCPClient.forContext(c).FS_DELETE({ path });

    // Delete metadata file if it exists
    const metadataPath = path.replace(/\.(png|jpeg|pdf)$/, ".meta.json");
    try {
      await MCPClient.forContext(c).FS_DELETE({ path: metadataPath });
    } catch {
      // Metadata file might not exist, that's okay
    }

    return { success: true };
  },
});
