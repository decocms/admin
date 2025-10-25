import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";

export interface CaptureScreenshotInput {
  locator: ProjectLocator;
  url?: string;
  html?: string;
  selector?: string;
  viewport?: {
    width: number;
    height: number;
  };
  screenshotOptions?: {
    fullPage?: boolean;
    omitBackground?: boolean;
    quality?: number;
    type?: "png" | "jpeg";
    clip?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  gotoOptions?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
  };
}

export interface Screenshot {
  url: string;
  path: string;
  metadata: {
    sourceUrl?: string;
    dimensions?: {
      width: number;
      height: number;
    };
    capturedAt: string;
    format: string;
  };
}

export interface ScreenshotListItem {
  path: string;
  url: string;
  metadata?: {
    sourceUrl?: string;
    dimensions?: {
      width: number;
      height: number;
    };
    capturedAt: string;
    format: string;
  };
  lastModified: string;
  size: number;
}

export const captureScreenshot = async (
  input: CaptureScreenshotInput,
  init?: RequestInit,
): Promise<Screenshot> => {
  const { locator, ...props } = input;
  const result = await MCPClient.forLocator(locator).BROWSER_SCREENSHOT(
    props,
    init,
  );
  return result.screenshot;
};

export interface GeneratePdfInput {
  locator: ProjectLocator;
  url?: string;
  html?: string;
  viewport?: {
    width: number;
    height: number;
  };
  gotoOptions?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
  };
}

export interface Pdf {
  url: string;
  path: string;
  metadata: {
    sourceUrl?: string;
    generatedAt: string;
  };
}

export const generatePdf = async (
  input: GeneratePdfInput,
  init?: RequestInit,
): Promise<Pdf> => {
  const { locator, ...props } = input;
  const result = await MCPClient.forLocator(locator).BROWSER_PDF(props, init);
  return result.pdf;
};

export interface FetchHtmlInput {
  locator: ProjectLocator;
  url: string;
  gotoOptions?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
  };
}

export interface HtmlContent {
  html: string;
  metadata: {
    url: string;
    fetchedAt: string;
  };
}

export const fetchHtml = async (
  input: FetchHtmlInput,
  init?: RequestInit,
): Promise<HtmlContent> => {
  const { locator, ...props } = input;
  return await MCPClient.forLocator(locator).BROWSER_HTML(props, init);
};

export interface ScrapeWebsiteInput {
  locator: ProjectLocator;
  url: string;
  selectors: Record<string, string>;
  gotoOptions?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    timeout?: number;
  };
}

export interface ScrapedContent {
  elements: Record<string, string[]>;
  metadata: {
    url: string;
    scrapedAt: string;
  };
}

export const scrapeWebsite = async (
  input: ScrapeWebsiteInput,
  init?: RequestInit,
): Promise<ScrapedContent> => {
  const { locator, ...props } = input;
  return await MCPClient.forLocator(locator).BROWSER_SCRAPE(props, init);
};

export interface ListScreenshotsInput {
  locator: ProjectLocator;
  prefix?: string;
  limit?: number;
}

export const listScreenshots = async (
  input: ListScreenshotsInput,
  init?: RequestInit,
): Promise<ScreenshotListItem[]> => {
  const { locator, ...props } = input;
  const result = await MCPClient.forLocator(locator).BROWSER_SCREENSHOTS_LIST(
    props,
    init,
  );
  return result.screenshots;
};

export interface DeleteScreenshotInput {
  locator: ProjectLocator;
  path: string;
}

export const deleteScreenshot = async (
  input: DeleteScreenshotInput,
  init?: RequestInit,
): Promise<boolean> => {
  const { locator, path } = input;
  const result = await MCPClient.forLocator(locator).BROWSER_SCREENSHOT_DELETE(
    { path },
    init,
  );
  return result.success;
};

