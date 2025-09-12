/**
 * Inspects and serializes any value to a meaningful string representation.
 * Similar to Node.js's util.inspect, but optimized for error handling and debugging.
 * Handles Error objects, objects with message properties, and other types.
 * Includes stack traces when available for better debugging.
 * @param value - The value to inspect
 * @returns A meaningful string representation with stack trace if available
 */
export function inspect(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  // Handle Error instances
  if (value instanceof Error) {
    const message = value.message || value.name || "Error";
    // Include stack trace if available and not too long
    if (value.stack && value.stack.length < 2000) {
      return `${message}\n${value.stack}`;
    }
    return message;
  }

  // Handle objects
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;

    // Try common error message properties first
    let message = "";
    if (typeof obj.message === "string" && obj.message) {
      message = obj.message;
    } else if (typeof obj.error === "string" && obj.error) {
      message = obj.error;
    } else if (typeof obj.description === "string" && obj.description) {
      message = obj.description;
    } else if (typeof obj.reason === "string" && obj.reason) {
      message = obj.reason;
    }

    // If we found a message, check for stack trace
    if (message) {
      if (
        typeof obj.stack === "string" &&
        obj.stack &&
        obj.stack.length < 2000
      ) {
        return `${message}\n${obj.stack}`;
      }
      return message;
    }

    // Try to stringify the object if it has meaningful properties
    try {
      const stringified = JSON.stringify(obj, null, 2);
      // Only use JSON if it's not just "{}" and has reasonable length
      if (stringified !== "{}" && stringified.length < 1000) {
        // If there's a stack trace, append it after the JSON
        if (
          typeof obj.stack === "string" &&
          obj.stack &&
          obj.stack.length < 2000
        ) {
          return `${stringified}\n\nStack trace:\n${obj.stack}`;
        }
        return stringified;
      }
    } catch {
      // JSON.stringify failed, continue to other methods
    }

    // Try toString method
    if (typeof obj.toString === "function") {
      try {
        const stringified = obj.toString();
        if (stringified !== "[object Object]") {
          return stringified;
        }
      } catch {
        // toString failed, continue
      }
    }

    // Show object keys if available
    const keys = Object.keys(obj);
    if (keys.length > 0) {
      return `Object with keys: ${keys.join(", ")}`;
    }

    return "[object Object]";
  }

  // Handle primitive types
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "function") {
    return `[Function: ${value.name || "anonymous"}]`;
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  // Last resort
  try {
    return String(value);
  } catch {
    return "Unknown value (could not convert to string)";
  }
}
