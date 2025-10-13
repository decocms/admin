import { ajvResolver as rawAjvResolver } from "@hookform/resolvers/ajv";

// Define our own safe options interface that works across AJV versions
interface SafeAjvOptions {
  allErrors?: boolean;
  multipleOfPrecision?: number;
  strict?: boolean;
  verbose?: boolean;
  discriminator?: boolean;
  strictNumbers?: boolean;
  useDefaults?: boolean; // Only boolean, no string values
}

const options: SafeAjvOptions = {
  allErrors: true,
  multipleOfPrecision: 8,
  strict: false,
  verbose: true,
  discriminator: false,
};

export const ajvResolver: typeof rawAjvResolver = (
  schema,
  instanceOptions = {},
) => {
  // Create safe options object with only compatible properties
  const safeOptions: SafeAjvOptions = { ...options };

  // Only include boolean values for problematic options
  if (
    "strictNumbers" in instanceOptions &&
    typeof instanceOptions.strictNumbers === "boolean"
  ) {
    safeOptions.strictNumbers = instanceOptions.strictNumbers;
  }

  if (
    "useDefaults" in instanceOptions &&
    typeof instanceOptions.useDefaults === "boolean"
  ) {
    safeOptions.useDefaults = instanceOptions.useDefaults;
  }

  // Cast to unknown then to the expected type to bypass version conflicts
  return rawAjvResolver(schema, safeOptions as unknown as Parameters<typeof rawAjvResolver>[1]);
};
