/**
 * Models Well-Known Binding
 *
 * Defines the interface for AI model providers.
 * Any MCP that implements this binding can provide AI models and streaming endpoints.
 *
 * This binding uses collection bindings for LIST and GET operations (read-only).
 * Streaming endpoint information is included directly in the model entity schema.
 */

import { z } from "zod";
import type { Binder } from "../core/binder";
import {
  BaseCollectionEntitySchema,
  createCollectionBindings,
} from "./collections";

/**
 * Model entity schema for AI models
 * Extends BaseCollectionEntitySchema with model-specific fields
 * Base schema already includes: id, title, created_at, updated_at, created_by, updated_by
 */
export const ModelSchema = BaseCollectionEntitySchema.extend({
  // Model-specific fields
  logo: z.string().nullable(),
  description: z.string().nullable(),
  capabilities: z.array(z.string()),
  limits: z
    .object({
      contextWindow: z.number(),
      maxOutputTokens: z.number(),
    })
    .nullable(),
  costs: z
    .object({
      input: z.number(),
      output: z.number(),
    })
    .nullable(),
  // Provider information
  provider: z
    .enum([
      "openai",
      "anthropic",
      "google",
      "xai",
      "deepseek",
      "openai-compatible",
      "openrouter",
    ])
    .nullable(),
  // Streaming endpoint information
  endpoint: z
    .object({
      url: z.string().url(),
      method: z.string().default("POST"),
      contentType: z.string().default("application/json"),
      stream: z.boolean().default(true),
    })
    .nullable(),
});

/**
 * MODELS Collection Binding
 *
 * Collection bindings for models (read-only).
 * Provides LIST and GET operations for AI models.
 */
export const MODELS_COLLECTION_BINDING = createCollectionBindings(
  "models",
  ModelSchema,
  { readOnly: true },
);

/**
 * MODELS Binding
 *
 * Defines the interface for AI model providers.
 * Any MCP that implements this binding can provide AI models and streaming endpoints.
 *
 * Required tools:
 * - DECO_COLLECTION_MODELS_LIST: List available AI models with their capabilities
 * - DECO_COLLECTION_MODELS_GET: Get a single model by ID (includes streaming endpoint info)
 */
export const MODELS_BINDING = [
  ...MODELS_COLLECTION_BINDING,
] as const satisfies Binder;
