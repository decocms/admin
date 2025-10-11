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
) => {
  // Filter out incompatible options
  const { strictNumbers, ...compatibleOptions } = instanceOptions as Options & {
    strictNumbers?: boolean | "log";
  };
  return rawAjvResolver(schema, {
    ...options,
    ...compatibleOptions,
    ...(typeof strictNumbers === "boolean" ? { strictNumbers } : {}),
  });
};
