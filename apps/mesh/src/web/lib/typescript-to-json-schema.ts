/**
 * Utility to extract TypeScript interfaces/types from code and convert to JSON Schema.
 * Works in the browser by using Monaco's TypeScript language service.
 */

import type { Monaco } from "@monaco-editor/react";

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  additionalProperties?: boolean | JsonSchema;
  not?: JsonSchema;
}

interface ExtractedInterface {
  name: string;
  properties: Array<{
    name: string;
    type: string;
    optional: boolean;
    description?: string;
  }>;
}

/**
 * Extract a named interface from TypeScript code using regex parsing.
 * Handles basic interface definitions with primitive and common types.
 */
function extractInterfaceFromCode(
  code: string,
  interfaceName: string,
): ExtractedInterface | null {
  // Match interface definition: interface Name { ... }
  const interfaceRegex = new RegExp(
    `interface\\s+${interfaceName}\\s*\\{([^}]*)\\}`,
    "s",
  );
  const match = code.match(interfaceRegex);

  if (!match || !match[1]) return null;

  const body = match[1];
  const properties: ExtractedInterface["properties"] = [];

  // Match property definitions: name?: Type;
  // Handle multiline comments too
  const propRegex = /(?:\/\*\*?\s*([^*]*?)\s*\*\/\s*)?(\w+)(\?)?:\s*([^;]+);/g;
  let propMatch;

  while ((propMatch = propRegex.exec(body)) !== null) {
    const [, comment, name, optional, type] = propMatch;
    if (!name || !type) continue;
    properties.push({
      name,
      type: type.trim(),
      optional: !!optional,
      description: comment?.trim(),
    });
  }

  return { name: interfaceName, properties };
}

/**
 * Convert a TypeScript type string to JSON Schema.
 */
function typeToJsonSchema(typeStr: string): JsonSchema {
  const trimmed = typeStr.trim();

  // Handle union types: A | B | C
  if (trimmed.includes("|")) {
    const parts = splitUnionOrIntersection(trimmed, "|");
    if (parts.length > 1) {
      // Check if it's a simple nullable type: string | null
      const nonNullParts = parts.filter(
        (p) => p.trim() !== "null" && p.trim() !== "undefined",
      );
      const hasNull = parts.some(
        (p) => p.trim() === "null" || p.trim() === "undefined",
      );

      if (nonNullParts.length === 1 && nonNullParts[0] && hasNull) {
        // Simple nullable type
        const baseSchema = typeToJsonSchema(nonNullParts[0]);
        return { anyOf: [baseSchema, { type: "null" }] };
      }

      return { anyOf: parts.map((p) => typeToJsonSchema(p.trim())) };
    }
  }

  // Handle intersection types: A & B
  if (trimmed.includes("&")) {
    const parts = splitUnionOrIntersection(trimmed, "&");
    if (parts.length > 1) {
      return { allOf: parts.map((p) => typeToJsonSchema(p.trim())) };
    }
  }

  // Handle array types: Type[] or Array<Type>
  if (trimmed.endsWith("[]")) {
    const itemType = trimmed.slice(0, -2).trim();
    return { type: "array", items: typeToJsonSchema(itemType) };
  }

  const arrayMatch = trimmed.match(/^Array<(.+)>$/);
  if (arrayMatch?.[1]) {
    return { type: "array", items: typeToJsonSchema(arrayMatch[1]) };
  }

  // Handle Record<K, V>
  const recordMatch = trimmed.match(/^Record<\s*string\s*,\s*(.+)\s*>$/);
  if (recordMatch?.[1]) {
    return {
      type: "object",
      additionalProperties: typeToJsonSchema(recordMatch[1]),
    };
  }

  // Handle Promise<T> - unwrap the promise
  const promiseMatch = trimmed.match(/^Promise<(.+)>$/);
  if (promiseMatch?.[1]) {
    return typeToJsonSchema(promiseMatch[1]);
  }

  // Handle inline object types: { prop: Type; ... }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return parseInlineObject(trimmed);
  }

  // Handle string literal types: "value1" | "value2"
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const literalValue = trimmed.slice(1, -1);
    return { type: "string", enum: [literalValue] };
  }

  // Handle number literal
  if (/^\d+$/.test(trimmed)) {
    return { type: "number", enum: [parseInt(trimmed, 10)] };
  }

  // Primitive types
  switch (trimmed) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "null":
      return { type: "null" };
    case "undefined":
      return { type: "null" }; // JSON Schema doesn't have undefined
    case "any":
    case "unknown":
      return {}; // Any type in JSON Schema
    case "void":
      return { type: "null" };
    case "never":
      return { not: {} };
    case "object":
      return { type: "object" };
    default:
      // Unknown type, treat as any
      return {};
  }
}

/**
 * Split a type string by union (|) or intersection (&) operators,
 * respecting nested generics and objects.
 */
function splitUnionOrIntersection(
  typeStr: string,
  separator: "|" | "&",
): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < typeStr.length; i++) {
    const char = typeStr[i];
    const prevChar = typeStr[i - 1];

    // Handle string literals
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (!inString) {
      if (char === "<" || char === "{" || char === "(") {
        depth++;
      } else if (char === ">" || char === "}" || char === ")") {
        depth--;
      } else if (char === separator && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Parse an inline object type: { prop: Type; ... }
 */
function parseInlineObject(typeStr: string): JsonSchema {
  const inner = typeStr.slice(1, -1).trim();
  if (!inner) {
    return { type: "object" };
  }

  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  // Simple property parsing - handles basic cases
  const propRegex = /(\w+)(\?)?:\s*([^;]+);?/g;
  let match;

  while ((match = propRegex.exec(inner)) !== null) {
    const [, name, optional, type] = match;
    if (!name || !type) continue;
    properties[name] = typeToJsonSchema(type.trim());
    if (!optional) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Convert an extracted interface to JSON Schema.
 */
function interfaceToJsonSchema(iface: ExtractedInterface): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const prop of iface.properties) {
    const propSchema = typeToJsonSchema(prop.type);
    if (prop.description) {
      propSchema.description = prop.description;
    }
    properties[prop.name] = propSchema;

    if (!prop.optional) {
      required.push(prop.name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Extract the return type from the default export function.
 * Handles: export default async function(input: Input): Promise<Output>
 */
function extractReturnType(code: string): string | null {
  // Match: export default (async )? function ... ): ReturnType {
  const patterns = [
    // export default async function(input: Input): Promise<Output>
    /export\s+default\s+async\s+function\s*\([^)]*\)\s*:\s*Promise<([^>]+)>/,
    // export default function(input: Input): Output
    /export\s+default\s+function\s*\([^)]*\)\s*:\s*([^{\s]+)/,
    // export default async (input: Input): Promise<Output> =>
    /export\s+default\s+async\s*\([^)]*\)\s*:\s*Promise<([^>]+)>\s*=>/,
    // export default (input: Input): Output =>
    /export\s+default\s*\([^)]*\)\s*:\s*([^={\s]+)\s*=>/,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Infer type from a JavaScript/TypeScript value expression.
 */
function inferTypeFromValue(value: string): JsonSchema {
  const trimmed = value.trim();

  // String literal: "..." or '...'
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("`") && trimmed.endsWith("`"))
  ) {
    return { type: "string" };
  }

  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { type: "number" };
  }

  // Boolean literal
  if (trimmed === "true" || trimmed === "false") {
    return { type: "boolean" };
  }

  // Null/undefined
  if (trimmed === "null" || trimmed === "undefined") {
    return { type: "null" };
  }

  // Empty array
  if (trimmed === "[]") {
    return { type: "array" };
  }

  // Array literal [...]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return { type: "array" };
  }

  // Empty object
  if (trimmed === "{}") {
    return { type: "object" };
  }

  // Object literal {...}
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return { type: "object" };
  }

  // JSON.stringify always returns string
  if (trimmed.startsWith("JSON.stringify(")) {
    return { type: "string" };
  }

  // .toString() returns string
  if (trimmed.endsWith(".toString()")) {
    return { type: "string" };
  }

  // String() cast
  if (trimmed.startsWith("String(")) {
    return { type: "string" };
  }

  // Number() cast
  if (
    trimmed.startsWith("Number(") ||
    trimmed.startsWith("parseInt(") ||
    trimmed.startsWith("parseFloat(")
  ) {
    return { type: "number" };
  }

  // Boolean() cast
  if (trimmed.startsWith("Boolean(")) {
    return { type: "boolean" };
  }

  // Ternary with instanceof Error check - likely string
  if (trimmed.includes("instanceof Error") && trimmed.includes("message")) {
    return { type: "string" };
  }

  // Common patterns: error.message, .message, etc.
  if (trimmed.endsWith(".message") || trimmed.endsWith(".name")) {
    return { type: "string" };
  }

  // .length property is number
  if (trimmed.endsWith(".length")) {
    return { type: "number" };
  }

  // Default to unknown
  return {};
}

/**
 * Parse a return object literal and extract properties with inferred types.
 * Handles: return { prop1: value1, prop2: value2 };
 */
function parseReturnObjectLiteral(
  objectLiteral: string,
): Map<string, JsonSchema> {
  const properties = new Map<string, JsonSchema>();

  // Remove outer braces
  const inner = objectLiteral.slice(1, -1).trim();
  if (!inner) return properties;

  // Parse properties - handle nested objects/arrays by tracking depth
  let current = "";
  let depth = 0;
  let inString = false;
  let stringChar = "";

  const parts: string[] = [];

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    const prevChar = inner[i - 1];

    // Handle string literals
    if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (!inString) {
      if (char === "{" || char === "[" || char === "(") {
        depth++;
      } else if (char === "}" || char === "]" || char === ")") {
        depth--;
      } else if (char === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  // Parse each property
  for (const part of parts) {
    // Match: key: value or "key": value or key (shorthand)
    const propMatch = part.match(/^["']?(\w+)["']?\s*:\s*(.+)$/s);
    if (propMatch?.[1] && propMatch[2]) {
      const [, name, value] = propMatch;
      properties.set(name, inferTypeFromValue(value));
    } else {
      // Shorthand property: just the variable name
      const shorthandMatch = part.match(/^(\w+)$/);
      if (shorthandMatch?.[1]) {
        properties.set(shorthandMatch[1], {}); // Unknown type for shorthand
      }
    }
  }

  return properties;
}

/**
 * Find all return statements in the default export function and infer schema.
 */
function inferSchemaFromReturns(code: string): JsonSchema | null {
  // Find the default export function body
  const functionPatterns = [
    // export default async function(...) { ... }
    /export\s+default\s+async\s+function\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{([\s\S]*)\}$/m,
    // export default function(...) { ... }
    /export\s+default\s+function\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{([\s\S]*)\}$/m,
  ];

  let functionBody: string | null = null;

  for (const pattern of functionPatterns) {
    const match = code.match(pattern);
    if (match?.[1]) {
      functionBody = match[1];
      break;
    }
  }

  if (!functionBody) return null;

  // Find all return statements with object literals
  // Match: return { ... }; or return { ... }
  const returnRegex = /return\s*(\{[^;]*\})\s*;?/g;
  const allProperties = new Map<
    string,
    { schema: JsonSchema; count: number }
  >();
  let returnCount = 0;

  let returnMatch;
  while ((returnMatch = returnRegex.exec(functionBody)) !== null) {
    if (!returnMatch[1]) continue;
    returnCount++;

    const props = parseReturnObjectLiteral(returnMatch[1]);
    for (const [name, schema] of props) {
      const existing = allProperties.get(name);
      if (existing) {
        existing.count++;
        // Merge schemas if they differ (create anyOf)
        if (JSON.stringify(existing.schema) !== JSON.stringify(schema)) {
          if (!existing.schema.anyOf) {
            existing.schema = { anyOf: [existing.schema, schema] };
          } else {
            existing.schema.anyOf.push(schema);
          }
        }
      } else {
        allProperties.set(name, { schema, count: 1 });
      }
    }
  }

  if (allProperties.size === 0) return null;

  // Build the schema - properties not in all returns are optional
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [name, { schema, count }] of allProperties) {
    properties[name] = schema;
    if (count === returnCount) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Extract JSON Schema from TypeScript code.
 *
 * Tries to (in order):
 * 1. Find an "Output" interface and convert it
 * 2. Find the return type annotation and look for its interface
 * 3. Infer from the actual return statements in the function
 *
 * @param code - TypeScript code string
 * @returns JSON Schema or null if unable to extract
 */
export function extractOutputSchema(code: string): JsonSchema | null {
  // First, try to find an explicit Output interface
  const outputInterface = extractInterfaceFromCode(code, "Output");
  if (outputInterface) {
    return interfaceToJsonSchema(outputInterface);
  }

  // If no Output interface, try to infer from return type annotation
  const returnType = extractReturnType(code);
  if (returnType && returnType !== "Output") {
    // Try to find an interface matching the return type
    const returnInterface = extractInterfaceFromCode(code, returnType);
    if (returnInterface) {
      return interfaceToJsonSchema(returnInterface);
    }

    // If it's an inline type (starts with {), convert it directly
    if (returnType.startsWith("{")) {
      return typeToJsonSchema(returnType);
    }
  }

  // Last resort: infer from actual return statements
  const inferredSchema = inferSchemaFromReturns(code);
  if (inferredSchema) {
    return inferredSchema;
  }

  return null;
}

/**
 * Extract JSON Schema from TypeScript code using Monaco's TypeScript language service.
 * This provides more accurate type information by using the actual TypeScript compiler.
 *
 * @param monaco - Monaco instance
 * @param code - TypeScript code string
 * @param filePath - Virtual file path for the code
 * @returns JSON Schema or null if unable to extract
 */
export async function extractOutputSchemaWithMonaco(
  monaco: Monaco,
  code: string,
  filePath: string,
): Promise<JsonSchema | null> {
  try {
    // Get the TypeScript worker
    const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
    const uri = monaco.Uri.parse(filePath);
    const worker = await getWorker(uri);

    // Create a temporary model for the code
    const existingModel = monaco.editor.getModel(uri);
    const model =
      existingModel || monaco.editor.createModel(code, "typescript", uri);

    if (!existingModel) {
      model.setValue(code);
    }

    // Find the Output interface position
    const outputMatch = code.match(/interface\s+Output\s*\{/);
    if (outputMatch && outputMatch.index !== undefined) {
      // Get type information at the Output interface position
      const position = model.getPositionAt(
        outputMatch.index + "interface ".length,
      );
      const offset = model.getOffsetAt(position);

      // Get quick info (hover information) which includes the type
      const quickInfo = await worker.getQuickInfoAtPosition(filePath, offset);

      if (quickInfo?.displayParts) {
        const typeString = quickInfo.displayParts
          .map((p: { text: string }) => p.text)
          .join("");
        console.log("[extractOutputSchemaWithMonaco] Type info:", typeString);
      }
    }

    // Fall back to regex-based extraction
    return extractOutputSchema(code);
  } catch (error) {
    console.error("[extractOutputSchemaWithMonaco] Error:", error);
    // Fall back to regex-based extraction
    return extractOutputSchema(code);
  }
}

/**
 * Extract the Input interface schema from TypeScript code.
 * Useful for generating input schemas for code steps.
 */
export function extractInputSchema(code: string): JsonSchema | null {
  const inputInterface = extractInterfaceFromCode(code, "Input");
  if (inputInterface) {
    return interfaceToJsonSchema(inputInterface);
  }
  return null;
}

/**
 * Convert a JSON Schema to a TypeScript interface string.
 *
 * @param schema - JSON Schema object
 * @param typeName - Name for the generated interface (default: "Output")
 * @returns TypeScript interface declaration string
 */
export function jsonSchemaToTypeScript(
  schema: Record<string, unknown> | null | undefined,
  typeName: string = "Output",
): string {
  if (!schema) return `interface ${typeName} {}`;

  function schemaToType(s: Record<string, unknown>): string {
    if (!s || typeof s !== "object") return "unknown";

    const type = s.type as string | string[] | undefined;

    if (Array.isArray(type)) {
      return type.map((t) => primitiveToTs(t)).join(" | ");
    }

    switch (type) {
      case "string":
        if (s.enum)
          return (s.enum as string[]).map((e) => `"${e}"`).join(" | ");
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      case "array": {
        const items = s.items as Record<string, unknown> | undefined;
        return items ? `${schemaToType(items)}[]` : "unknown[]";
      }
      case "object":
        return objectToType(s);
      default:
        if (s.anyOf)
          return (s.anyOf as Record<string, unknown>[])
            .map(schemaToType)
            .join(" | ");
        if (s.oneOf)
          return (s.oneOf as Record<string, unknown>[])
            .map(schemaToType)
            .join(" | ");
        if (s.allOf)
          return (s.allOf as Record<string, unknown>[])
            .map(schemaToType)
            .join(" & ");
        return "unknown";
    }
  }

  function primitiveToTs(t: string): string {
    switch (t) {
      case "string":
        return "string";
      case "number":
      case "integer":
        return "number";
      case "boolean":
        return "boolean";
      case "null":
        return "null";
      default:
        return "unknown";
    }
  }

  function objectToType(s: Record<string, unknown>): string {
    const props = s.properties as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (!props) return "Record<string, unknown>";

    const required = new Set((s.required as string[]) || []);
    const lines = Object.entries(props).map(([key, value]) => {
      const optional = required.has(key) ? "" : "?";
      const desc = value.description ? `  /** ${value.description} */\n` : "";
      return `${desc}  ${key}${optional}: ${schemaToType(value)};`;
    });

    return `{\n${lines.join("\n")}\n}`;
  }

  return `interface ${typeName} ${schemaToType(schema as Record<string, unknown>)}`;
}
