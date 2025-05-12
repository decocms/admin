import { JSONSchema7 } from "json-schema";
import { SchemaType } from "../Form.tsx";
import { generateDefaultValue } from "./generateDefaultValue.ts";
import { selectAnyOfSchema } from "./schema.ts";

// Generate default values based on schema
export function generateDefaultValues(
  schema: JSONSchema7,
  formData?: Record<string, SchemaType>,
  fieldPath?: string
): Record<string, SchemaType> {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  if (schema.default !== undefined) {
    return schema.default as Record<string, SchemaType>;
  }

  // Handle anyOf schema using the schema utility
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const representativeSchema = selectAnyOfSchema(schema, formData);
    return generateDefaultValues(representativeSchema, formData, fieldPath);
  }

  if (schema.type === "object" && schema.properties) {
    const result: Record<string, SchemaType> = {};
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      const isRequired = schema.required?.includes(name);
      const propPath = fieldPath ? `${fieldPath}.${name}` : name;
      const fieldFormData = formData?.[name];
      
      if (isRequired || fieldFormData !== undefined) {
        // Use generateDefaultValue which now handles type checking
        result[name] = generateDefaultValue(propSchema as JSONSchema7, fieldFormData, propPath);
      }
    }
    return result;
  }

  return {};
}
