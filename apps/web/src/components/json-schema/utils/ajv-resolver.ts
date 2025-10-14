import { ajvResolver as rawAjvResolver } from "@hookform/resolvers/ajv";

const options = {
  allErrors: true,
  multipleOfPrecision: 8,
  strict: false,
  verbose: true,
  discriminator: false,
} as const;

export const ajvResolver: typeof rawAjvResolver = (
  schema,
  instanceOptions = {},
) => rawAjvResolver(schema, { ...options, ...instanceOptions });
