import process from "node:process";

/**
 * Detects which runtime is currently executing the CLI
 */
export function detectRuntime(): "node" | "bun" | "deno" | "unknown" {
  // oxlint-disable-next-line no-explicit-any
  if (typeof (globalThis as any).Deno !== "undefined") return "deno";

  if (process.versions.bun) return "bun";
  if (process.versions.node) return "node";

  return "unknown";
}
