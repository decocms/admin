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

  // Shallow clone the root schema
  const cloned = { ...schema };

  // Fix arrays without items
  if (cloned.type === "array" && !("items" in cloned)) {
    cloned.items = {};
  }

  // Recursively fix array items
  if (cloned.items && typeof cloned.items === "object") {
    cloned.items = fixJsonSchemaArrayItems(cloned.items as JSONSchema7);
  }

  // Recursively fix properties
  if (cloned.properties && typeof cloned.properties === "object") {
    const newProperties = { ...cloned.properties };
    for (const key of Object.keys(newProperties)) {
      if (typeof newProperties[key] === "object") {
        newProperties[key] = fixJsonSchemaArrayItems(
          newProperties[key] as JSONSchema7,
        );
      }
    }
    cloned.properties = newProperties;
  }

  // Recursively fix additionalProperties
  if (
    cloned.additionalProperties &&
    typeof cloned.additionalProperties === "object"
  ) {
    cloned.additionalProperties = fixJsonSchemaArrayItems(
      cloned.additionalProperties as JSONSchema7,
    );
  }

  // Recursively fix anyOf, oneOf, allOf
  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(cloned[key])) {
      cloned[key] = cloned[key]!.map((s) =>
        typeof s === "object" ? fixJsonSchemaArrayItems(s as JSONSchema7) : s,
      );
    }
  }

  return cloned;
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
  } as unknown as FlexibleSchema<any>;
};
