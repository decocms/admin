import { JSONSchema7 } from "json-schema";
import { SchemaType } from "../Form.tsx";
import { selectAnyOfSchema } from "./schema.ts";

// Generate a default value for a single property with better anyOf handling
export function generateDefaultValue(
  schema: JSONSchema7, 
  formData?: SchemaType, 
  fieldPath?: string
): SchemaType {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  if (schema.default !== undefined) {
    return schema.default as SchemaType;
  }

  // Handle anyOf schema with improved selection logic
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    // Use the unified schema selection utility from schema.ts
    const representativeSchema = selectAnyOfSchema(schema, formData);
    
    return generateDefaultValue(representativeSchema, formData, fieldPath);
  }

  // Handle arrays of types (e.g. ["string", "null"])
  const type = Array.isArray(schema.type)
    ? schema.type.find((prop) => prop !== "null") ?? "null"
    : schema.type;

  switch (type) {
    case "string":
      return schema.enum && schema.enum.length > 0 ? schema.enum[0] : "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    case "object":
      if (schema.properties) {
        const result: Record<string, SchemaType> = {};
        for (const [name, propSchema] of Object.entries(schema.properties)) {
          const isRequired = schema.required?.includes(name);
          const propPath = fieldPath ? `${fieldPath}.${name}` : name;
          
          // If formData exists and has this property, use it for nested default value generation
          const childFormData = formData && typeof formData === 'object' && !Array.isArray(formData) 
            ? (formData as Record<string, SchemaType>)[name] 
            : undefined;
          
          if (isRequired || childFormData !== undefined) {
            result[name] = generateDefaultValue(propSchema as JSONSchema7, childFormData, propPath);
          }
        }
        return result;
      }
      return {};
    case "array":
      if (schema.items && !Array.isArray(schema.items)) {
        // If formData is an array, use its items to generate default values
        if (Array.isArray(formData) && formData.length > 0) {
          return formData.map((item, index) => {
            const itemPath = fieldPath ? `${fieldPath}[${index}]` : `[${index}]`;
            return generateDefaultValue(schema.items as JSONSchema7, item, itemPath);
          });
        }
        
        // Otherwise, check for minItems and create defaults
        const minItems = schema.minItems || 0;
        if (minItems > 0) {
          return Array(minItems).fill(null).map((_, index) => {
            const itemPath = fieldPath ? `${fieldPath}[${index}]` : `[${index}]`;
            return generateDefaultValue(schema.items as JSONSchema7, undefined, itemPath);
          });
        }
      }
      return [];
    default:
      return null;
  }
}
