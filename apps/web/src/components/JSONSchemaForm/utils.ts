import { JSONSchema7 } from "json-schema";
import { SchemaType } from "./Form.tsx";

// Format property name for display
export function formatPropertyName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str: string) => str.toUpperCase())
    .trim();
}

// Generate default values based on schema
export function generateDefaultValues(
  schema: JSONSchema7,
): Record<string, SchemaType> {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  if (schema.default !== undefined) {
    return schema.default as Record<string, SchemaType>;
  }

  if (schema.type === "object" && schema.properties) {
    const result: Record<string, SchemaType> = {};
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      result[name] = generateDefaultValue(propSchema as JSONSchema7);
    }
    return result;
  }

  return {};
}

// Generate a default value for a single property
export function generateDefaultValue(schema: JSONSchema7): SchemaType {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  if (schema.default !== undefined) {
    return schema.default as SchemaType;
  }

  switch (schema.type) {
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "object":
      if (schema.properties) {
        const result: Record<string, SchemaType> = {};
        for (const [name, propSchema] of Object.entries(schema.properties)) {
          result[name] = generateDefaultValue(propSchema as JSONSchema7);
        }
        return result;
      }
      return {};
    case "array":
      return [];
    default:
      return "";
  }
}
