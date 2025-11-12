/**
 * Test Utilities
 *
 * Shared mock types and utilities for test files
 */

import type { Tracer, Meter } from "@opentelemetry/api";
import type { BetterAuthInstance } from "./core/mesh-context";

/**
 * Mock OpenTelemetry Tracer for testing
 */
export type MockTracer = Partial<Tracer>;

/**
 * Mock OpenTelemetry Meter for testing
 */
export type MockMeter = Partial<Meter>;

/**
 * Mock Better Auth Instance for testing
 */
export type MockAuth = Partial<BetterAuthInstance>;

/**
 * Mock Access Control for testing
 */
export interface MockAccessControl {
  check: () => Promise<void>;
  grant: () => void;
  granted: () => boolean;
  setToolName: (name: string) => void;
}
