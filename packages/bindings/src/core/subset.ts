/**
 * Structural JSON Schema Subset Check
 *
 * This module implements an algorithm to determine if one JSON Schema (A)
 * is a subset of another (B). A ⊆ B means every value valid under A is also
 * valid under B (A is more restrictive or equally restrictive).
 *
 * Core Axiom: A ⊆ B ⟺ Constraints(A) ⊇ Constraints(B)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JSONSchema = Record<string, any>;

/**
 * Deep equality check for JSON values (for const/enum comparison)
 */
function deepEqual(x: unknown, y: unknown): boolean {
  if (x === y) return true;
  if (typeof x !== typeof y) return false;
  if (x === null || y === null) return x === y;
  if (typeof x !== "object") return false;

  if (Array.isArray(x)) {
    if (!Array.isArray(y)) return false;
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) {
      if (!deepEqual(x[i], y[i])) return false;
    }
    return true;
  }

  if (Array.isArray(y)) return false;

  const xObj = x as Record<string, unknown>;
  const yObj = y as Record<string, unknown>;
  const xKeys = Object.keys(xObj);
  const yKeys = Object.keys(yObj);

  if (xKeys.length !== yKeys.length) return false;

  for (const key of xKeys) {
    if (!Object.prototype.hasOwnProperty.call(yObj, key)) return false;
    if (!deepEqual(xObj[key], yObj[key])) return false;
  }

  return true;
}

/**
 * Phase 1: Normalization
 * Convert syntactic sugar to canonical form
 */
function normalize(schema: JSONSchema | boolean): JSONSchema {
  // Boolean schemas
  if (schema === true) return {};
  if (schema === false) return { not: {} };

  // Already an object
  const s = { ...schema };

  // Type arrays -> anyOf
  if (Array.isArray(s.type)) {
    const types = s.type as string[];
    if (types.length === 1) {
      s.type = types[0];
    } else {
      const { type: _type, ...rest } = s;
      return {
        anyOf: types.map((t) => normalize({ ...rest, type: t })),
      };
    }
  }

  // Integer is number with multipleOf: 1
  if (s.type === "integer") {
    s.type = "number";
    if (s.multipleOf === undefined) {
      s.multipleOf = 1;
    }
  }

  return s;
}

/**
 * Check if set A is a subset of set B (for required fields)
 */
function isSetSubset(a: string[], b: string[]): boolean {
  const setB = new Set(b);
  return a.every((item) => setB.has(item));
}

/**
 * Get effective minimum value from schema
 */
function getEffectiveMin(schema: JSONSchema): number {
  const min = schema.minimum ?? -Infinity;
  const exMin = schema.exclusiveMinimum;

  if (typeof exMin === "number") {
    return Math.max(min, exMin);
  }
  if (exMin === true && typeof schema.minimum === "number") {
    return schema.minimum;
  }
  return min;
}

/**
 * Get effective maximum value from schema
 */
function getEffectiveMax(schema: JSONSchema): number {
  const max = schema.maximum ?? Infinity;
  const exMax = schema.exclusiveMaximum;

  if (typeof exMax === "number") {
    return Math.min(max, exMax);
  }
  if (exMax === true && typeof schema.maximum === "number") {
    return schema.maximum;
  }
  return max;
}

/**
 * Check if multipleOfA is a multiple of multipleOfB
 * (i.e., A's constraint is tighter)
 */
function isMultipleOf(a: number, b: number): boolean {
  if (b === 0) return false;
  // Handle floating point precision
  const ratio = a / b;
  return Math.abs(ratio - Math.round(ratio)) < 1e-10;
}

/**
 * Check if A's enum values are all valid in B
 */
function isEnumSubset(enumA: unknown[], schemaB: JSONSchema): boolean {
  // If B has enum, check set inclusion
  if (schemaB.enum) {
    return enumA.every((val) =>
      schemaB.enum.some((bVal: unknown) => deepEqual(val, bVal)),
    );
  }

  // If B has const, check if A's enum only contains that value
  if (schemaB.const !== undefined) {
    return enumA.length === 1 && deepEqual(enumA[0], schemaB.const);
  }

  // Otherwise, enum values must match B's type constraints
  // This is a simplified check - full validation would require more
  return true;
}

/**
 * Main subset check: isSubset(A, B)
 * Returns true if A ⊆ B (every value valid under A is valid under B)
 */
export function isSubset(
  schemaA: JSONSchema | boolean,
  schemaB: JSONSchema | boolean,
): boolean {
  // Phase 1: Normalize
  const a = normalize(schemaA);
  const b = normalize(schemaB);

  // Phase 2: Meta Logic - Universal Terminators

  // If B is {} (Any), everything is a subset
  if (Object.keys(b).length === 0) return true;

  // If A is false (Never), empty set is subset of everything
  if (a.not && Object.keys(a.not).length === 0) return true;

  // Deep equality check
  if (deepEqual(a, b)) return true;

  // Phase 2: Unions and Intersections

  // Left-side union (anyOf in A): all options must fit in B
  if (a.anyOf) {
    return (a.anyOf as JSONSchema[]).every((optA) => isSubset(optA, b));
  }

  // Left-side union (oneOf in A): all options must fit in B
  if (a.oneOf) {
    return (a.oneOf as JSONSchema[]).every((optA) => isSubset(optA, b));
  }

  // Right-side union (anyOf in B): A must fit in at least one option
  if (b.anyOf) {
    return (b.anyOf as JSONSchema[]).some((optB) => isSubset(a, optB));
  }

  // Right-side union (oneOf in B): A must fit in at least one option
  if (b.oneOf) {
    return (b.oneOf as JSONSchema[]).some((optB) => isSubset(a, optB));
  }

  // Right-side intersection (allOf in B): A must satisfy all
  if (b.allOf) {
    return (b.allOf as JSONSchema[]).every((optB) => isSubset(a, optB));
  }

  // Left-side intersection (allOf in A): merge and compare
  if (a.allOf) {
    // Simplified: check if any single branch satisfies B
    return (a.allOf as JSONSchema[]).some((optA) => isSubset(optA, b));
  }

  // Phase 3: Type-specific logic

  // Handle const in A
  if (a.const !== undefined) {
    if (b.const !== undefined) {
      return deepEqual(a.const, b.const);
    }
    if (b.enum) {
      return b.enum.some((v: unknown) => deepEqual(a.const, v));
    }
    // const must match B's type constraints
    return isValueValidForType(a.const, b);
  }

  // Handle enum in A
  if (a.enum) {
    return isEnumSubset(a.enum, b);
  }

  // Type mismatch check
  if (a.type && b.type && a.type !== b.type) {
    return false;
  }

  // If B has a type but A doesn't, A might allow more types
  if (b.type && !a.type) {
    // A is more permissive (no type restriction) so it's not a subset
    // unless A has other constraints that limit it
    if (!a.enum && a.const === undefined) {
      return false;
    }
  }

  const type = a.type || b.type;

  switch (type) {
    case "object":
      return isObjectSubset(a, b);
    case "array":
      return isArraySubset(a, b);
    case "number":
      return isNumberSubset(a, b);
    case "string":
      return isStringSubset(a, b);
    case "boolean":
    case "null":
      // These types have no additional constraints
      return true;
    default:
      // Unknown type or no type specified
      return true;
  }
}

/**
 * Check if a value would be valid for a schema's type
 */
function isValueValidForType(value: unknown, schema: JSONSchema): boolean {
  if (!schema.type) return true;

  const valueType = typeof value;
  switch (schema.type) {
    case "string":
      return valueType === "string";
    case "number":
      return valueType === "number";
    case "boolean":
      return valueType === "boolean";
    case "null":
      return value === null;
    case "object":
      return valueType === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    default:
      return true;
  }
}

/**
 * Object subset check
 */
function isObjectSubset(a: JSONSchema, b: JSONSchema): boolean {
  // Required keys: A must require at least everything B requires
  const aRequired = (a.required as string[]) || [];
  const bRequired = (b.required as string[]) || [];

  if (!isSetSubset(bRequired, aRequired)) {
    return false;
  }

  // Property compatibility
  const aProps = (a.properties as Record<string, JSONSchema>) || {};
  const bProps = (b.properties as Record<string, JSONSchema>) || {};

  // Check all properties defined in B
  for (const key of Object.keys(bProps)) {
    if (key in aProps) {
      // Both have the property, check recursively
      if (!isSubset(aProps[key], bProps[key])) {
        return false;
      }
    } else {
      // Property missing in A
      // If A is closed (additionalProperties: false), A won't produce this key
      // which means A values won't have this property, potentially violating B if B requires it
      if (a.additionalProperties === false) {
        // A is closed and doesn't have this property
        // If B requires this property, A can't satisfy it
        if (bRequired.includes(key)) {
          return false;
        }
        // Otherwise, A just won't have this optional property, which is fine
      } else {
        // A is open, check if additionalProperties schema satisfies B's property
        const aAdditional = a.additionalProperties;
        if (aAdditional && typeof aAdditional === "object") {
          if (!isSubset(aAdditional, bProps[key])) {
            return false;
          }
        }
        // If additionalProperties is true or undefined, any value is allowed
        // which might not satisfy B's property schema
      }
    }
  }

  // Check all properties defined in A (that A requires)
  // If A requires a property, B must also define it (or have compatible additionalProperties)
  for (const key of aRequired) {
    if (key in aProps && !(key in bProps)) {
      // A requires and defines this property, but B doesn't define it
      // B must have additionalProperties that accepts A's property schema
      if (b.additionalProperties === false) {
        // B doesn't allow additional properties, so A's required property would be rejected
        return false;
      } else if (
        b.additionalProperties &&
        typeof b.additionalProperties === "object"
      ) {
        // B has a schema for additional properties, check compatibility
        if (!isSubset(aProps[key], b.additionalProperties)) {
          return false;
        }
      }
      // If B's additionalProperties is true or undefined, any value is allowed
    }
  }

  // Additional properties constraint
  if (b.additionalProperties === false) {
    // B is closed, A must also be closed or not have extra properties
    const aHasExtraProps = Object.keys(aProps).some((key) => !(key in bProps));
    if (aHasExtraProps) {
      return false;
    }
    // If A is open and B is closed, A could produce extra properties
    if (a.additionalProperties !== false) {
      return false;
    }
  } else if (
    b.additionalProperties &&
    typeof b.additionalProperties === "object"
  ) {
    // B has a schema for additional properties
    const aAdditional = a.additionalProperties;
    if (aAdditional && typeof aAdditional === "object") {
      if (!isSubset(aAdditional, b.additionalProperties)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Array subset check
 */
function isArraySubset(a: JSONSchema, b: JSONSchema): boolean {
  // Items schema
  if (a.items && b.items) {
    if (Array.isArray(a.items) && Array.isArray(b.items)) {
      // Both are tuples
      if (a.items.length !== b.items.length) {
        return false;
      }
      for (let i = 0; i < a.items.length; i++) {
        if (!isSubset(a.items[i], b.items[i])) {
          return false;
        }
      }
    } else if (Array.isArray(a.items) && !Array.isArray(b.items)) {
      // A is tuple, B is list
      for (const itemSchema of a.items) {
        if (!isSubset(itemSchema, b.items)) {
          return false;
        }
      }
    } else if (!Array.isArray(a.items) && Array.isArray(b.items)) {
      // A is list, B is tuple - A is more permissive
      return false;
    } else {
      // Both are lists
      if (!isSubset(a.items, b.items)) {
        return false;
      }
    }
  } else if (b.items && !a.items) {
    // B has items constraint but A doesn't
    return false;
  }

  // Length constraints
  const aMinItems = a.minItems ?? 0;
  const bMinItems = b.minItems ?? 0;
  if (aMinItems < bMinItems) {
    return false;
  }

  const aMaxItems = a.maxItems ?? Infinity;
  const bMaxItems = b.maxItems ?? Infinity;
  if (aMaxItems > bMaxItems) {
    return false;
  }

  // Uniqueness
  if (b.uniqueItems && !a.uniqueItems) {
    return false;
  }

  return true;
}

/**
 * Number subset check
 */
function isNumberSubset(a: JSONSchema, b: JSONSchema): boolean {
  // Minimum
  const aMin = getEffectiveMin(a);
  const bMin = getEffectiveMin(b);
  if (aMin < bMin) {
    return false;
  }

  // Maximum
  const aMax = getEffectiveMax(a);
  const bMax = getEffectiveMax(b);
  if (aMax > bMax) {
    return false;
  }

  // MultipleOf
  if (b.multipleOf !== undefined) {
    if (a.multipleOf === undefined) {
      // A doesn't have multipleOf constraint, so it's more permissive
      return false;
    }
    if (!isMultipleOf(a.multipleOf, b.multipleOf)) {
      return false;
    }
  }

  return true;
}

/**
 * String subset check
 */
function isStringSubset(a: JSONSchema, b: JSONSchema): boolean {
  // Length constraints
  const aMinLength = a.minLength ?? 0;
  const bMinLength = b.minLength ?? 0;
  if (aMinLength < bMinLength) {
    return false;
  }

  const aMaxLength = a.maxLength ?? Infinity;
  const bMaxLength = b.maxLength ?? Infinity;
  if (aMaxLength > bMaxLength) {
    return false;
  }

  // Pattern (regex)
  if (b.pattern) {
    if (!a.pattern) {
      // A has no pattern constraint, more permissive
      return false;
    }
    // Exact match only (full regex subset check is computationally expensive)
    if (a.pattern !== b.pattern) {
      return false;
    }
  }

  // Format (treat as informational, exact match required)
  if (b.format && a.format !== b.format) {
    return false;
  }

  return true;
}
