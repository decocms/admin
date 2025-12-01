import { z } from "zod";

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  format?: string;
  description?: string;
  enum?: string[];
  [key: string]: unknown;
};

/**
 * Converts a JSON Schema object to a Zod schema.
 * Optimized for Collection UI requirements (columns, format detection).
 */
export function jsonSchemaToZod(schema: JsonSchema | undefined): z.ZodTypeAny {
  if (!schema) return z.any();

  if (schema.type === "object" && schema.properties) {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      let fieldSchema = jsonSchemaToZod(prop);

      // Handle optional fields
      if (!schema.required?.includes(key)) {
        fieldSchema = fieldSchema.optional();
      }

      shape[key] = fieldSchema;
    }
    return z.object(shape);
  }

  if (schema.type === "array" && schema.items) {
    return z.array(jsonSchemaToZod(schema.items));
  }

  if (schema.type === "string") {
    let stringSchema = z.string();

    if (schema.format === "date-time") {
      stringSchema = stringSchema.datetime();
    } else if (schema.format === "email") {
      stringSchema = stringSchema.email();
    } else if (schema.format === "uri" || schema.format === "url") {
      stringSchema = stringSchema.url();
    }

    if (schema.enum) {
      // @ts-ignore - enum implementation matches string expectation
      return z.enum(schema.enum as [string, ...string[]]);
    }

    return stringSchema;
  }

  if (schema.type === "number") {
    return z.number();
  }

  if (schema.type === "integer") {
    return z.number().int();
  }

  if (schema.type === "boolean") {
    return z.boolean();
  }

  return z.any();
}
