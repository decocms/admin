/**
 * DECONFIG Tools
 *
 * This file exports all tools for the DECONFIG system.
 * DECONFIG is a git-like, versioned configuration manager filesystem
 * built on top of Cloudflare Durable Objects.
 */

import { deconfigTools } from "./deconfig.ts";

export const tools = [...deconfigTools];

// Re-export for direct access
export { deconfigTools } from "./deconfig.ts";
