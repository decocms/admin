/**
 * Event-based communication for data updates
 * Used to notify various parts of the app about data changes
 * Uses EventTarget API which is supported in Cloudflare Workers
 */

// ============================================================================
// Integration Updates
// ============================================================================

// EventTarget for integration update notifications
const integrationEventTarget = new EventTarget();

export interface IntegrationMessage {
  type: "INTEGRATION_UPDATED";
}

export function notifyIntegrationUpdate() {
  const message: IntegrationMessage = {
    type: "INTEGRATION_UPDATED",
  };

  // Dispatch custom event
  const event = new CustomEvent("integration-update", { detail: message });
  integrationEventTarget.dispatchEvent(event);
}

export function addIntegrationUpdateListener(
  callback: (message: IntegrationMessage) => void,
) {
  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<IntegrationMessage>;
    callback(customEvent.detail);
  };

  integrationEventTarget.addEventListener(
    "integration-update",
    handleCustomEvent,
  );

  return () => {
    integrationEventTarget.removeEventListener(
      "integration-update",
      handleCustomEvent,
    );
  };
}

// ============================================================================
// Resource Updates
// ============================================================================

// EventTarget for resource update notifications
const resourceEventTarget = new EventTarget();

export interface ResourceMessage {
  type: "RESOURCE_UPDATED";
  resourceUri: string;
}

export function notifyResourceUpdate(resourceUri: string) {
  const message: ResourceMessage = {
    type: "RESOURCE_UPDATED",
    resourceUri,
  };

  // Dispatch custom event
  const event = new CustomEvent("resource-update", { detail: message });
  resourceEventTarget.dispatchEvent(event);
}

export function addResourceUpdateListener(
  callback: (message: ResourceMessage) => void,
) {
  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<ResourceMessage>;
    callback(customEvent.detail);
  };

  resourceEventTarget.addEventListener("resource-update", handleCustomEvent);

  // Return cleanup function
  return () => {
    resourceEventTarget.removeEventListener(
      "resource-update",
      handleCustomEvent,
    );
  };
}
