/**
 * Re-export DECONFIG DurableObjects from the SDK package.
 *
 * This approach keeps the actual DurableObject implementations in the SDK
 * where they can be properly typed and shared, while still allowing the
 * API server to export them for Cloudflare Workers.
 */

// Re-export the Blobs DurableObject
export { Blobs, Branch } from "@deco/sdk/mcp";
