export const isRequired = <T>(value: T): value is NonNullable<T> => {
  return value !== null && value !== undefined;
};

/**
 * Get a property from an object and assert it is a specific type
 * @param val - The value to get the property from
 * @param key - The property key
 * @param assertion - The assertion function
 * @returns The property value if it is a specific type
 */
const prop = <T>(
  val: unknown,
  key: string,
  assertion: (val: unknown) => val is T,
): T | undefined => {
  if (!val || typeof val !== "object") {
    return undefined;
  }
  if (!(key in val)) {
    return undefined;
  }
  const value = val[key as keyof typeof val];
  if (!assertion(value)) {
    return undefined;
  }
  return value;
};

/**
 * Get a property from an object and assert it is a string
 * @param val - The value to get the property from
 * @param key - The property key
 * @returns The property value if it is a string
 */
export const strProp = <T>(val: T, key: string) => {
  return prop(val, key, (val) => typeof val === "string");
};

/**
 * Get a property from an object and assert it is a string
 * @param val - The value to get the property from
 * @param key - The property key
 * @returns The property value if it is a string
 */
export const arrayProp = <Elements = string>(val: unknown, key: string) => {
  return prop(val, key, (val): val is Elements[] => Array.isArray(val));
};

/**
 * Get the stack trace
 * @returns The stack trace
 */
function getStack() {
  const obj: { stack?: string } = {};
  if ("captureStackTrace" in Error) {
    // Avoid getStack itself in the stack trace
    Error.captureStackTrace(obj, getStack);
  }
  return obj.stack;
}
