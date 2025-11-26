/**
 * Type declarations for Bun global
 * This file provides minimal type definitions to avoid TypeScript errors
 * when the code is type-checked in non-Bun environments.
 */

declare global {
  const Bun:
    | {
        version: string;
      }
    | undefined;
}

export {};
