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
  INTEGRATION_CHANNEL.postMessage({
    type: "INTEGRATION_UPDATED",
  } as IntegrationMessage);
};

/**
 * Helper for notifying resource updates across the app
 * This allows resource detail views to auto-refresh when the agent updates content
 *
 * Note: BroadcastChannel only works across tabs, not within the same page.
 * We use a custom EventTarget for same-page communication.
 */
export const RESOURCE_CHANNEL = new BroadcastChannel("resource-updates");

// Custom event target for same-page communication
const resourceEventTarget = new EventTarget();

export type ResourceMessage = {
  type: "RESOURCE_UPDATED";
  resourceUri: string;
};

export const notifyResourceUpdate = (resourceUri: string) => {
  const message = {
    type: "RESOURCE_UPDATED",
    resourceUri,
  } as ResourceMessage;

  // Broadcast to other tabs
  RESOURCE_CHANNEL.postMessage(message);

  // Dispatch custom event for same-page listeners
  const event = new CustomEvent("resource-update", { detail: message });
  resourceEventTarget.dispatchEvent(event);
};

export const addResourceUpdateListener = (
  callback: (message: ResourceMessage) => void,
) => {
  // Listen to BroadcastChannel (other tabs)
  const handleBroadcast = (event: MessageEvent<ResourceMessage>) => {
    callback(event.data);
  };

  // Listen to custom event (same page)
  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<ResourceMessage>;
    callback(customEvent.detail);
  };

  RESOURCE_CHANNEL.addEventListener("message", handleBroadcast);
  resourceEventTarget.addEventListener("resource-update", handleCustomEvent);

  // Return cleanup function
  return () => {
    RESOURCE_CHANNEL.removeEventListener("message", handleBroadcast);
    resourceEventTarget.removeEventListener(
      "resource-update",
      handleCustomEvent,
    );
  };
};
