/**
 * This file re-exports broadcast utilities from the SDK for backwards compatibility.
 * New code should import directly from @deco/sdk instead.
 */
export {
  addIntegrationUpdateListener, addResourceUpdateListener, notifyIntegrationUpdate, notifyResourceUpdate, type IntegrationMessage,
  type ResourceMessage
} from "@deco/sdk";

