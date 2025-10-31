/**
 * Typed custom event creators for cross-component communication
 */

export interface ScreenshotEventDetail {
  blob: Blob;
  filename: string;
  url: string;
}

export interface LogsEventDetail {
  logs: string;
}

export const CustomEvents = {
  /**
   * Dispatches an event to add a screenshot to the chat input
   */
  addScreenshot: (detail: ScreenshotEventDetail) => {
    window.dispatchEvent(
      new CustomEvent("decopilot:addScreenshot", { detail }),
    );
  },

  /**
   * Dispatches an event to add console logs to the chat input
   */
  addLogs: (detail: LogsEventDetail) => {
    window.dispatchEvent(new CustomEvent("decopilot:addLogs", { detail }));
  },
} as const;

/**
 * Type-safe event listener for screenshot events
 */
export function onScreenshotAdded(
  handler: (detail: ScreenshotEventDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ScreenshotEventDetail>;
    handler(customEvent.detail);
  };
  window.addEventListener("decopilot:addScreenshot", listener);
  return () => window.removeEventListener("decopilot:addScreenshot", listener);
}

/**
 * Type-safe event listener for logs events
 */
export function onLogsAdded(
  handler: (detail: LogsEventDetail) => void,
): () => void {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<LogsEventDetail>;
    handler(customEvent.detail);
  };
  window.addEventListener("decopilot:addLogs", listener);
  return () => window.removeEventListener("decopilot:addLogs", listener);
}
