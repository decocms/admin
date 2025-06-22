/**
 * Helper for making another windows refetch the integrations when needed.
 * Persisting tanstack query data to local storage was kinda buggy, while
 * this one is simple and worked well.
 */
export const INTEGRATION_CHANNEL = new BroadcastChannel("integration-updates");

export type IntegrationMessage = {
  type: "INTEGRATION_UPDATED";
};

export const notifyIntegrationUpdate = () => {
  INTEGRATION_CHANNEL.postMessage(
    { type: "INTEGRATION_UPDATED" } as IntegrationMessage,
  );
};

/**
 * Channel for streaming tool notifications
 */
export const STREAMING_TOOL_CHANNEL = new BroadcastChannel(
  "streaming-tool-updates",
);

export type StreamingToolMessage = {
  type: "STREAMING_TOOL_NOTIFICATION";
  toolName: string;
  connectionId: string;
  notification: unknown;
};

export const notifyStreamingToolUpdate = (
  toolName: string,
  connectionId: string,
  notification: unknown,
) => {
  console.log("Broadcasting streaming tool notification:", {
    toolName,
    connectionId,
    notification,
  });
  STREAMING_TOOL_CHANNEL.postMessage({
    type: "STREAMING_TOOL_NOTIFICATION",
    toolName,
    connectionId,
    notification,
  } as StreamingToolMessage);
};
