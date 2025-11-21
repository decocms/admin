import { z } from "zod";
import jsonSchema from "zod-to-json-schema";

const ModelsBinding: z.ZodTypeAny = z.object({
  MODELS_LIST: z.object({
    input: z.object({}).passthrough(),
    output: z.object({
      models: z.array(
        z.object({
          id: z.string(),
          model: z.string(),
          name: z.string(),
          logo: z.string().nullable(), // URL to provider logo (e.g., Anthropic, OpenAI, Google)
          capabilities: z.array(z.string()), // Visual capabilities: "reasoning", "image-upload", "file-upload", "web-search"
          contextWindow: z.number().nullable(),
          inputCost: z.number().nullable(), // Cost per token (e.g., 0.000003 = $3.00 per 1M tokens)
          outputCost: z.number().nullable(), // Cost per token (e.g., 0.000015 = $15.00 per 1M tokens)
          outputLimit: z.number().nullable(),
          description: z.string().nullable(),
        }),
      ),
    }),
  }),
  GET_STREAM_ENDPOINT: z.object({
    input: z.object({}).passthrough(),
    output: z
      .object({
        url: z.url(),
      })
      .partial(),
  }),
});

export const jsonschema = jsonSchema(ModelsBinding);

export const MODELS_BINDING_SCHEMA = {
  $id: "https://mesh.deco.cx/bindings/models",
  type: "object",
  required: ["MODELS_LIST", "GET_STREAM_ENDPOINT"],
  properties: {
    MODELS_LIST: {
      type: "object",
      required: ["input", "output"],
      properties: {
        input: {
          type: "object",
          properties: {},
          additionalProperties: true,
        },
        output: {
          type: "object",
          properties: {
            models: {
              type: "array",
              items: {
                type: "object",
                required: ["id", "model", "name"],
                properties: {
                  id: { type: "string" },
                  model: { type: "string" },
                  name: { type: "string" },
                  logo: { type: ["string", "null"] },
                  capabilities: {
                    type: "array",
                    items: { type: "string" },
                  },
                  contextWindow: { type: ["number", "null"] },
                  inputCost: { type: ["number", "null"] },
                  outputCost: { type: ["number", "null"] },
                  outputLimit: { type: ["number", "null"] },
                  description: { type: ["string", "null"] },
                },
                additionalProperties: true,
              },
            },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
    GET_STREAM_ENDPOINT: {
      type: "object",
      required: ["input", "output"],
      properties: {
        input: {
          type: "object",
          properties: {},
          additionalProperties: true,
        },
        output: {
          type: "object",
          properties: {
            url: { type: "string", format: "uri" },
          },
          additionalProperties: true,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: true,
} as const;
