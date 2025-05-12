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
  formData?: Record<string, SchemaType>,
  fieldPath?: string
): Record<string, SchemaType> {
  if (!schema || typeof schema !== "object") {
    return {};
  }

  if (schema.default !== undefined) {
    return schema.default as Record<string, SchemaType>;
  }

  // Handle anyOf schema
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    // If we have form data, try to find a schema that matches its structure
    if (formData && Object.keys(formData).length > 0) {
      // Look for a schema with properties that match the form data
      const matchingSchema = schema.anyOf.find(subSchema => {
        const schemaObj = subSchema as JSONSchema7;
        
        if (schemaObj.type !== 'object' || !schemaObj.properties) {
          return false;
        }
        
        // Check if the schema's properties match the form data
        const schemaKeys = Object.keys(schemaObj.properties);
        const formDataKeys = Object.keys(formData);
        
        // If the schema requires properties that don't exist in the form data, it's not a match
        if (schemaObj.required) {
          const missingRequired = schemaObj.required.some(
            req => !formDataKeys.includes(req as string)
          );
          if (missingRequired) {
            return false;
          }
        }
        
        // If the majority of properties don't match, it's probably not the right schema
        const commonKeys = formDataKeys.filter(key => schemaKeys.includes(key));
        return commonKeys.length > 0;
      });
      
      if (matchingSchema) {
        return generateDefaultValues(matchingSchema as JSONSchema7, formData, fieldPath);
      }
    }
    
    // First try to find a schema with a default value
    const schemaWithDefault = schema.anyOf.find(
      (s) => (s as JSONSchema7).default !== undefined
    );
    
    // Then try to find a non-null schema
    const nonNullSchema = !schemaWithDefault ? 
      schema.anyOf.find(s => {
        const schemaType = (s as JSONSchema7).type;
        if (Array.isArray(schemaType)) {
          return !schemaType.includes('null');
        }
        return schemaType !== 'null';
      }) : 
      null;
    
    // Choose the best schema based on priority: default value > non-null > first item
    const representativeSchema = schemaWithDefault || nonNullSchema || schema.anyOf[0];
    
    return generateDefaultValues(representativeSchema as JSONSchema7, formData, fieldPath);
  }

  if (schema.type === "object" && schema.properties) {
    const result: Record<string, SchemaType> = {};
    for (const [name, propSchema] of Object.entries(schema.properties)) {
      const isRequired = schema.required?.includes(name);
      const propPath = fieldPath ? `${fieldPath}.${name}` : name;
      const fieldFormData = formData?.[name];
      
      if (isRequired || fieldFormData !== undefined) {
        result[name] = generateDefaultValue(propSchema as JSONSchema7, fieldFormData, propPath);
      }
    }
    return result;
  }

  return {};
}

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
    // If we have form data, try to find a schema that matches its type and structure
    if (formData !== undefined && formData !== null) {
      const valueType = typeof formData;
      
      // Enhanced type detection for special cases
      const detectedType = 
        valueType === 'object' && formData === null ? 'null' :
        valueType === 'object' && Array.isArray(formData) ? 'array' :
        valueType;
      
      // First try: Find schema with matching type
      const matchingTypeSchema = schema.anyOf.find(subSchema => {
        const schemaObj = subSchema as JSONSchema7;
        const schemaType = schemaObj.type;
        
        // If no type specified, it's a match
        if (schemaType === undefined) {
          return true;
        }
        
        // Handle array of types
        if (Array.isArray(schemaType)) {
          return schemaType.some(t => {
            if (t === 'integer' && detectedType === 'number') return true;
            if (t === detectedType) return true;
            return false;
          });
        }
        
        // Handle single type
        if (schemaType === 'integer' && detectedType === 'number') {
          return true;
        }
        
        return schemaType === detectedType;
      });
      
      // Second try: If we have an object, find schema with matching properties
      if (detectedType === 'object' && !Array.isArray(formData)) {
        const formDataObj = formData as Record<string, SchemaType>;
        const formDataKeys = Object.keys(formDataObj);
        
        if (formDataKeys.length > 0) {
          const matchingPropsSchema = schema.anyOf.find(subSchema => {
            const schemaObj = subSchema as JSONSchema7;
            
            if (schemaObj.type !== 'object' || !schemaObj.properties) {
              return false;
            }
            
            const schemaKeys = Object.keys(schemaObj.properties);
            // Check if the schema properties overlap significantly with form data
            const commonKeys = formDataKeys.filter(key => schemaKeys.includes(key));
            return commonKeys.length > 0;
          });
          
          if (matchingPropsSchema) {
            return generateDefaultValue(matchingPropsSchema as JSONSchema7, formData, fieldPath);
          }
        }
      }
      
      // If we found a matching schema by type, use it
      if (matchingTypeSchema) {
        return generateDefaultValue(matchingTypeSchema as JSONSchema7, formData, fieldPath);
      }
    }
    
    // If there's a field path and it contains nested paths, 
    // we could potentially use parent context to select schema
    // This would need to be implemented if we had a full context mechanism
    
    // Default prioritization strategy remains the same
    // First try to find a schema with a default value
    const schemaWithDefault = schema.anyOf.find(
      (s) => (s as JSONSchema7).default !== undefined
    );
    
    // Then try to find a non-null schema
    const nonNullSchema = !schemaWithDefault ? 
      schema.anyOf.find(s => {
        const schemaType = (s as JSONSchema7).type;
        if (Array.isArray(schemaType)) {
          return !schemaType.includes('null');
        }
        return schemaType !== 'null';
      }) : 
      null;
    
    // Choose the best schema based on priority: default value > non-null > first item
    const representativeSchema = schemaWithDefault || nonNullSchema || schema.anyOf[0];
    
    return generateDefaultValue(representativeSchema as JSONSchema7, formData, fieldPath);
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

// Initialize form with smart anyOf schema selection based on existing data
export function initializeFormWithSchema<T extends Record<string, SchemaType>>(
  schema: JSONSchema7, 
  existingData?: Partial<T>
): T {
  // If we have existing data, use it to better select anyOf schemas
  if (existingData && Object.keys(existingData).length > 0) {
    return generateDefaultValues(schema, existingData as Record<string, SchemaType>) as T;
  }
  
  // Fall back to basic default generation
  return generateDefaultValues(schema) as T;
}
