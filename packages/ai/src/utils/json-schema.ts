import type { JSONSchema7 } from "ai";
import { jsonSchema } from "ai";
import { FlexibleSchema } from "@ai-sdk/provider-utils";

/**
 * Zod schemas with z.array(z.any()) can generate invalid JSON Schema
 * for some providers. (without items property)
 *
 * This function fixes the schema by adding the items property if it's missing.
 */
export const fixJsonSchemaArrayItems = (schema: JSONSchema7): JSONSchema7 => {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  // Fix arrays without items
  if (schema.type === "array" && !("items" in schema)) {
    schema.items = {};
  }

  // Recursively fix array items
  if (schema.items && typeof schema.items === "object") {
    schema.items = fixJsonSchemaArrayItems(schema.items as JSONSchema7);
  }

  // Recursively fix properties
  if (schema.properties && typeof schema.properties === "object") {
    for (const key of Object.keys(schema.properties)) {
      if (typeof schema.properties[key] === "object") {
        schema.properties[key] = fixJsonSchemaArrayItems(
          schema.properties[key] as JSONSchema7,
        );
      }
    }
  }

  // Recursively fix additionalProperties
  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties === "object"
  ) {
    schema.additionalProperties = fixJsonSchemaArrayItems(
      schema.additionalProperties as JSONSchema7,
    );
  }

  // Recursively fix anyOf, oneOf, allOf
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(schema[key])) {
      schema[key] = schema[key]!.map((s) =>
        typeof s === "object" ? fixJsonSchemaArrayItems(s as JSONSchema7) : s,
      );
    }
  }

  return schema;
};

/**
 * Wraps jsonSchema and applies fixJsonSchemaArrayItems to the result.
 */
export const patchedJsonSchema = (input: Parameters<typeof jsonSchema>[0]) => {
  const schema = jsonSchema(input);
  return {
    ...schema,
    jsonSchema: fixJsonSchemaArrayItems(schema.jsonSchema),
    // oxlint-disable-next-line no-explicit-any
  } as FlexibleSchema<any>;
};
