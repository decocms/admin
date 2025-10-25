import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  captureScreenshot,
  deleteScreenshot,
  fetchHtml,
  generatePdf,
  listScreenshots,
  scrapeWebsite,
  type CaptureScreenshotInput,
  type DeleteScreenshotInput,
  type FetchHtmlInput,
  type GeneratePdfInput,
  type ListScreenshotsInput,
  type ScrapeWebsiteInput,
} from "../crud/browser-rendering.ts";
import { useSDK } from "./store.tsx";

// Query Keys
export const BROWSER_RENDERING_KEYS = {
  screenshots: (locator?: string, prefix?: string) =>
    ["browser-rendering", "screenshots", locator, prefix] as const,
};

// Hooks
export function useScreenshots(options?: { prefix?: string; limit?: number }) {
  const { locator } = useSDK();

  return useQuery({
    queryKey: BROWSER_RENDERING_KEYS.screenshots(locator, options?.prefix),
    queryFn: async () => {
      if (!locator) throw new Error("No locator available");
      try {
        return await listScreenshots({
          locator,
          prefix: options?.prefix,
          limit: options?.limit,
        });
      } catch (error) {
        console.error("Failed to list screenshots:", error);
        // Return empty array on error instead of throwing
        return [];
      }
    },
    enabled: !!locator,
    retry: false,
    staleTime: 30000, // 30 seconds
  });
}

export function useCaptureScreenshot() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: Omit<CaptureScreenshotInput, "locator">) => {
      if (!locator) throw new Error("No locator available");
      return captureScreenshot({ ...input, locator });
    },
    onSuccess: () => {
      // Invalidate all screenshot queries
      client.invalidateQueries({
        queryKey: ["browser-rendering", "screenshots", locator],
      });
    },
  });
}

export function useGeneratePdf() {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: Omit<GeneratePdfInput, "locator">) => {
      if (!locator) throw new Error("No locator available");
      return generatePdf({ ...input, locator });
    },
  });
}

export function useFetchHtml() {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: Omit<FetchHtmlInput, "locator">) => {
      if (!locator) throw new Error("No locator available");
      return fetchHtml({ ...input, locator });
    },
  });
}

export function useScrapeWebsite() {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: Omit<ScrapeWebsiteInput, "locator">) => {
      if (!locator) throw new Error("No locator available");
      return scrapeWebsite({ ...input, locator });
    },
  });
}

export function useDeleteScreenshot() {
  const client = useQueryClient();
  const { locator } = useSDK();

  return useMutation({
    mutationFn: (input: Omit<DeleteScreenshotInput, "locator">) => {
      if (!locator) throw new Error("No locator available");
      return deleteScreenshot({ ...input, locator });
    },
    onSuccess: () => {
      // Invalidate all screenshot queries
      client.invalidateQueries({
        queryKey: ["browser-rendering", "screenshots", locator],
      });
    },
  });
}
