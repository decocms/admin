import { Confirm } from "@cliffy/prompt";
import { walk } from "@std/fs";
import { createWorkspaceClient } from "../mcp.ts";
import { getCurrentEnvVars } from "../wrangler.ts";
import { relative } from "@std/path/relative";
import { Buffer } from "node:buffer";

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type FileLike = {
  path: string;
  content: string;
  asset?: boolean;
};

interface Options {
  cwd: string;
  workspace: string;
  app: string;
  local: boolean;
  skipConfirmation?: boolean;
  unlisted?: boolean;
  assetsDirectory?: string;
}

const WRANGLER_CONFIG_FILES = ["wrangler.toml", "wrangler.json"];

export const deploy = async (
  {
    cwd,
    workspace,
    app: appSlug,
    local,
    assetsDirectory,
    skipConfirmation,
    unlisted = true,
  }: Options,
) => {
  console.log(`\n🚀 Deploying '${appSlug}' to '${workspace}'...\n`);

  // Ensure the target directory exists
  try {
    await Deno.stat(cwd);
  } catch {
    throw new Error("Target directory not found");
  }

  // 1. Prepare files to upload: all files in dist/ and wrangler.toml (if exists)
  const files: FileLike[] = [];
  let hasTsFile = false;
  let foundWranglerConfigInWalk = false;
  let foundWranglerConfigName = "";

  // Recursively walk cwd/ and add all files
  for await (
    const entry of walk(cwd, {
      includeDirs: false,
      skip: [
        /node_modules/,
        /\.git/,
        /\.DS_Store/,
        /\.env/,
        /\.env.local/,
        /\.dev.vars/,
      ],
      exts: [
        ".ts",
        ".mjs",
        ".js",
        ".cjs",
        ".toml",
        ".json",
        ".css",
        ".html",
        ".txt",
        ".wasm",
      ],
    })
  ) {
    const realPath = relative(cwd, entry.path);
    const content = await Deno.readTextFile(entry.path);
    files.push({ path: realPath, content });
    if (realPath.endsWith(".ts")) {
      hasTsFile = true;
    }
    if (WRANGLER_CONFIG_FILES.some((name) => realPath.includes(name))) {
      foundWranglerConfigInWalk = true;
      foundWranglerConfigName = realPath;
    }
  }

  if (assetsDirectory) {
    for await (
      const entry of walk(assetsDirectory, {
        includeDirs: false,
        skip: [
          /node_modules/,
          /\.git/,
          /\.DS_Store/,
          /\.env/,
          /\.env.local/,
          /\.dev.vars/,
        ],
      })
    ) {
      const realPath = relative(assetsDirectory, entry.path);
      const content = await Deno.readFile(entry.path);
      const base64Content = Buffer.from(content).toString("base64");
      files.push({ path: realPath, content: base64Content, asset: true });
    }
  }

  // 2. wrangler.toml/json (optional)
  let wranglerConfigStatus = "";
  if (!foundWranglerConfigInWalk) {
    let found = false;
    for (const configFile of WRANGLER_CONFIG_FILES) {
      const configPath = `${Deno.cwd()}/${configFile}`;
      try {
        const configContent = await Deno.readTextFile(configPath);
        files.push({ path: configFile, content: configContent });
        wranglerConfigStatus = `${configFile} ✅ (found in ${configPath})`;
        found = true;
        break;
      } catch (_) {
        // not found, try next
      }
    }
    if (!found) {
      wranglerConfigStatus = "wrangler.toml/json ❌";
    }
  } else {
    wranglerConfigStatus =
      `${foundWranglerConfigName} ✅ (found in project files)`;
  }

  // 3. Load envVars from .dev.vars
  const { envVars, envFilepath } = await getCurrentEnvVars(Deno.cwd());
  const envVarsStatus = `Loaded ${
    Object.keys(envVars).length
  } env vars from ${envFilepath}`;

  const manifest = {
    appSlug,
    files,
    envVars,
    envFilepath,
    bundle: hasTsFile,
    unlisted,
  };

  console.log("🚚 Deployment summary:");
  console.log(`  App: ${appSlug}`);
  console.log(`  Files: ${files.length}`);
  console.log(`  ${envVarsStatus}`);
  console.log(`  ${wranglerConfigStatus}`);

  const confirmed = skipConfirmation ||
    await Confirm.prompt("Proceed with deployment?");
  if (!confirmed) {
    console.log("❌ Deployment cancelled");
    Deno.exit(0);
  }

  const client = await createWorkspaceClient({ workspace, local });
  const response = await client.callTool({
    name: "HOSTING_APP_DEPLOY",
    arguments: manifest,
  });

  if (response.isError && Array.isArray(response.content)) {
    console.error("Error deploying: ", response);

    const errorText = response.content[0]?.text;
    const errorTextJson = tryParseJson(errorText ?? "");
    throw new Error(errorTextJson ?? errorText ?? "Unknown error");
  }

  const { hosts } = response.structuredContent as { hosts: string[] };
  console.log(`\n🎉 Deployed! Available at:`);
  hosts.forEach((host) => console.log(`  ${host}`));
  console.log();
};
