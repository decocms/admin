import { ajvResolver as rawAjvResolver } from "@hookform/resolvers/ajv";
import type { Options } from "ajv";

const options = {
  allErrors: true,
  multipleOfPrecision: 8,
  strict: false,
  verbose: true,
  discriminator: false,
} as const;

// Filter out any incompatible options from the base options
const safeBaseOptions: Partial<Options> = {};
Object.entries(options).forEach(([key, value]) => {
  // Only include options that are definitely compatible
  if (key !== "useDefaults" || typeof value === "boolean") {
    (safeBaseOptions as any)[key] = value;
  }
});

export const ajvResolver: typeof rawAjvResolver = (
  schema,
  instanceOptions = {},
) => {
  // Filter out incompatible options and only pass known safe options
  const safeOptions: Partial<Options> = {};

  // Only include options that are definitely compatible
  if (
    "strictNumbers" in instanceOptions &&
    typeof instanceOptions.strictNumbers === "boolean"
  ) {
    safeOptions.strictNumbers = instanceOptions.strictNumbers;
  }

  if ("useDefaults" in instanceOptions) {
    const useDefaults = instanceOptions.useDefaults;
    if (typeof useDefaults === "boolean") {
      safeOptions.useDefaults = useDefaults;
    }
    // Skip "empty" and "shared" values to avoid version conflicts
  }

  return rawAjvResolver(schema, {
    ...safeBaseOptions,
    ...safeOptions,
  });
};
