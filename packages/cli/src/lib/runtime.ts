import process from "node:process";

/**
 * Detects which runtime is currently executing the CLI
 */
export function detectRuntime(): "node" | "bun" | "deno" | "unknown" {
  // deno-lint-ignore no-explicit-any
  if (typeof (globalThis as any).Deno !== "undefined") return "deno";

  if (process.versions.bun) return "bun";
  if (process.env.npm_command || process.env.npm_execpath) return "node";

  return "unknown";
}
