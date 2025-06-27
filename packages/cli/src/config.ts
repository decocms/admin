/**
 * This file is responsible for reading and writing the config file.
 * Config for Deco workers is stored in the wrangler.toml file, so
 * we're a superset of the wrangler config.
 */
import { z } from "zod";
import { parse, stringify } from "smol-toml";
import { readSession } from "./session.ts";

export const CONFIG_FILE = "wrangler.toml";

const requiredErrorForProp = (prop: string) =>
  `Property ${prop} is required. Please provide an inline value using --${prop} or configure it using 'deco configure'.`;

const DecoBindingSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  integration_id: z.string().min(1),
});

export type DecoBinding = z.infer<typeof DecoBindingSchema>;

const decoConfigSchema = z.object({
  workspace: z.string({
    required_error: requiredErrorForProp("workspace"),
  }),
  app: z.string({
    required_error: requiredErrorForProp("app"),
  }),
  bindings: z.array(DecoBindingSchema).optional().default([]),
  local: z.boolean().optional().default(false),
});

let local: boolean;
export const setLocal = (l: boolean): void => {
  local = l;
};
export const getLocal = (): boolean => {
  return local;
};

export type Config = z.infer<typeof decoConfigSchema>;

export interface WranglerConfig {
  [key: string]: unknown;
  name?: string;
  deco?: Partial<Config>;
}

const readWranglerConfig = async () => {
  const configPath = getConfigFilePath(Deno.cwd());
  if (!configPath) {
    return {};
  }
  const config = await Deno.readTextFile(configPath).catch(() => null);
  if (!config) {
    return {};
  }
  return parse(config) as WranglerConfig;
};

/**
 * Read the config file from the current directory or any parent directory.
 * If no config file is found, returns an empty object, so we can still merge with inline options
 * and work without a config file.
 *
 * @returns The partial config.
 */
const readConfigFile = async () => {
  const wranglerConfig = await readWranglerConfig();
  const decoConfig = wranglerConfig.deco ?? {} as Partial<Config>;
  return {
    ...decoConfig,
    app: decoConfig.app ?? wranglerConfig.name,
  };
};

/**
 * Write the config to the current directory or any parent directory.
 * @param config - The config to write.
 */
export const writeConfigFile = async (
  config: Partial<Config>,
) => {
  const wranglerConfig = await readWranglerConfig();
  const current = wranglerConfig.deco ?? {} as Partial<Config>;
  const mergedConfig = { ...current, ...config };
  const configPath = getConfigFilePath(Deno.cwd()) ??
    `${Deno.cwd()}/${CONFIG_FILE}`;
  await Deno.writeTextFile(
    configPath,
    stringify({
      ...wranglerConfig,
      deco: mergedConfig,
    }),
  );
};

/**
 * Get the config for the current project considering the passed root directory and inline options.
 * @param rootDir - The root directory to read the config from.
 * @param inlineOptions - The inline options to merge with the config.
 * @returns The config.
 */
export const getConfig = async (
  { inlineOptions = {} }: {
    inlineOptions?: Partial<Config>;
  },
) => {
  const config = await readConfigFile();
  const merged = { ...config, ...inlineOptions };
  if (!merged.workspace) {
    const session = await readSession();
    merged.workspace = session?.workspace;
  }
  merged.local = getLocal() ?? merged.local;
  return decoConfigSchema.parse(merged);
};

/**
 * Get the path to the config file in the current directory or any parent directory.
 * Useful for finding the config file when the current directory is not the root directory of the project.
 * @param cwd - The current working directory.
 * @returns The path to the config file or null if not found.
 */
export const getConfigFilePath = (cwd: string) => {
  const dirs = cwd.split("/");
  const maxDepth = dirs.length;

  for (let i = 0; i < maxDepth; i++) {
    const path = dirs.slice(0, i + 1).join("/");
    const configPath = `${path}/${CONFIG_FILE}`;

    try {
      const stat = Deno.statSync(configPath);
      if (stat.isFile) {
        return configPath;
      }
    } catch {
      // File doesn't exist, continue searching
    }
  }

  return null;
};
