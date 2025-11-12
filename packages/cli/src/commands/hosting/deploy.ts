import { promises as fs } from "fs";
import inquirer from "inquirer";
import { Buffer } from "node:buffer";
import process from "node:process";
import { join, posix, relative } from "path";
import { walk } from "../../lib/fs.js";
import { createWorkspaceClientStub } from "../../lib/mcp.js";
import { getCurrentEnvVars } from "../../lib/wrangler.js";
import {
  isFilePath,
  parseEnvFile,
  parseInlineJsonEnvVars,
  parseKeyValueEnvVar,
} from "../../lib/env-parser.js";

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  // Convert Windows backslashes to Unix forward slashes
  return posix.normalize(path.replace(/\\/g, "/"));
}

function tryParseInlineJson(
  input: string,
): { vars: Record<string, string>; count: number } | null {
  try {
    const parsedVars = parseInlineJsonEnvVars(input);
    const count = Object.keys(parsedVars).length;
    return { vars: parsedVars, count };
  } catch (error) {
    console.warn(
      `⚠️  Invalid JSON format: "${input}". Error: ${error instanceof Error ? error.message : String(error)}. Skipping.`,
    );
    return null;
  }
}

async function tryParseEnvFile(
  filePath: string,
  workingDir: string,
): Promise<{ vars: Record<string, string>; count: number } | null> {
  try {
    const parsedVars = await parseEnvFile(filePath, workingDir);
    const count = Object.keys(parsedVars).length;
    return { vars: parsedVars, count };
  } catch (error) {
    console.warn(
      `⚠️  Failed to read env file "${filePath}": ${error instanceof Error ? error.message : String(error)}. Skipping.`,
    );
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
  force?: boolean;
  promote?: boolean;
  dryRun?: boolean;
  inlineEnvVars?: string[];
}

const WRANGLER_CONFIG_FILES = ["wrangler.toml", "wrangler.json"];

export const deploy = async ({
  cwd,
  workspace,
  app: appSlug,
  local,
  assetsDirectory,
  skipConfirmation,
  force,
  promote = true,
  unlisted = true,
  dryRun = false,
  inlineEnvVars = [],
}: Options) => {
  console.log(
    `\n🚀 ${dryRun ? "Preparing" : "Deploying"} '${appSlug}' to '${workspace}'${
      dryRun ? " (dry run)" : ""
    }...\n`,
  );

  // Ensure the target directory exists
  try {
    await fs.stat(cwd);
  } catch {
    throw new Error("Target directory not found");
  }

  // 1. Prepare files to upload: all files in dist/ and wrangler.toml (if exists)
  const files: FileLike[] = [];
  let hasTsFile = false;
  let foundWranglerConfigInWalk = false;
  let foundWranglerConfigName = "";

  // Recursively walk cwd/ and add all files
  for await (const entry of walk(cwd, {
    includeFiles: true,
    includeDirs: false,
    skip: [
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /\.env/,
      /\.env\.local/,
      /\.dev\.vars/,
      /\.vite/,
    ],
    exts: [
      "ts",
      "mjs",
      "js",
      "cjs",
      "toml",
      "json",
      "css",
      "html",
      "txt",
      "wasm",
      "sql",
    ],
  })) {
    const realPath = normalizePath(relative(cwd, entry.path));
    const content = await fs.readFile(entry.path, "utf-8");
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
    for await (const entry of walk(assetsDirectory, {
      includeFiles: true,
      includeDirs: false,
      skip: [
        /node_modules/,
        /\.git/,
        /\.DS_Store/,
        /\.env/,
        /\.env\.local/,
        /\.dev\.vars/,
      ],
    })) {
      const realPath = normalizePath(relative(assetsDirectory, entry.path));
      const content = await fs.readFile(entry.path);
      const base64Content = Buffer.from(content).toString("base64");
      files.push({ path: realPath, content: base64Content, asset: true });
    }
  }

  // 2. wrangler.toml/json (optional)
  let wranglerConfigStatus = "";
  if (!foundWranglerConfigInWalk) {
    let found = false;
    for (const configFile of WRANGLER_CONFIG_FILES) {
      const configPath = `${process.cwd()}/${configFile}`;
      try {
        const configContent = await fs.readFile(configPath, "utf-8");
        files.push({ path: configFile, content: configContent });
        wranglerConfigStatus = `${configFile} ✅ (found in ${configPath})`;
        found = true;
        break;
      } catch {
        // not found, try next
      }
    }
    if (!found) {
      wranglerConfigStatus = "wrangler.toml/json ❌";
    }
  } else {
    wranglerConfigStatus = `${foundWranglerConfigName} ✅ (found in project files)`;
  }

  // 3. Load envVars from .dev.vars
  const { envVars: fileEnvVars, envFilepath } = await getCurrentEnvVars(cwd);

  // 4. Parse inline env vars from CLI (supports multiple formats)
  const parsedInlineEnvVars: Record<string, string> = {};
  const envVarSources: string[] = [];

  for (const envVar of inlineEnvVars) {
    const trimmedEnvVar = envVar.trim();

    if (trimmedEnvVar.startsWith("{")) {
      const result = tryParseInlineJson(trimmedEnvVar);
      if (result && result.count > 0) {
        Object.assign(parsedInlineEnvVars, result.vars);
        envVarSources.push(`JSON (${result.count} vars)`);
      }
      continue;
    }

    if (isFilePath(trimmedEnvVar)) {
      const result = await tryParseEnvFile(trimmedEnvVar, cwd);
      if (result && result.count > 0) {
        Object.assign(parsedInlineEnvVars, result.vars);
        envVarSources.push(`${trimmedEnvVar} (${result.count} vars)`);
      }
      continue;
    }

    const parsed = parseKeyValueEnvVar(trimmedEnvVar);
    if (!parsed) {
      console.warn(
        `⚠️  Invalid env var format: "${trimmedEnvVar}". Expected KEY=VALUE, JSON object, or file path. Skipping.`,
      );
      continue;
    }

    parsedInlineEnvVars[parsed.key] = parsed.value;
  }

  // 5. Merge env vars: inline vars override file vars
  const envVars = { ...fileEnvVars, ...parsedInlineEnvVars };

  const envVarsFromFile = Object.keys(fileEnvVars).length;
  const envVarsFromCLI = Object.keys(parsedInlineEnvVars).length;
  const envVarsTotal = Object.keys(envVars).length;

  let envVarsStatus = `Loaded ${envVarsFromFile} env vars from ${envFilepath}`;
  if (envVarsFromCLI > 0) {
    const sourcesInfo =
      envVarSources.length > 0 ? ` [${envVarSources.join(", ")}]` : "";
    envVarsStatus += ` + ${envVarsFromCLI} from CLI${sourcesInfo} (${envVarsTotal} total)`;
  }

  const manifest = {
    appSlug,
    files,
    envVars,
    envFilepath,
    bundle: hasTsFile,
    unlisted,
    force,
    promote,
  };

  console.log("🚚 Deployment summary:");
  console.log(`  App: ${appSlug}`);
  console.log(`  Files: ${files.length}`);
  console.log(`  ${envVarsStatus}`);
  console.log(`  ${wranglerConfigStatus}`);
  if (promote) {
    console.log(`  Promote mode: true (deployment will replace production)`);
  }

  if (dryRun) {
    const manifestPath = join(cwd, "deploy-manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\n📄 Dry run complete! Deploy manifest written to:`);
    console.log(`  ${manifestPath}`);
    console.log();
    return;
  }

  const confirmed =
    skipConfirmation ||
    (
      await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: "Proceed with deployment?",
          default: true,
        },
      ])
    ).proceed;

  if (!confirmed) {
    console.log("❌ Deployment cancelled");
    process.exit(0);
  }

  const client = await createWorkspaceClientStub({ workspace, local });
  const deploy = async (options: typeof manifest) => {
    const response = await client.callTool({
      name: "HOSTING_APP_DEPLOY",
      arguments: manifest,
    });

    if (response.isError && Array.isArray(response.content)) {
      console.error("Error deploying: ", response);

      const errorText = response.content[0]?.text;
      const errorTextJson = tryParseJson(errorText ?? "");
      if (errorTextJson?.name === "MCPBreakingChangeError" && !force) {
        console.log("Looks like you have breaking changes in your app.");
        console.log(errorTextJson.message);
        if (skipConfirmation) {
          console.error("Use --force (-f) to deploy with breaking changes");
          process.exit(1);
        }
        const confirmed = await inquirer.prompt([
          {
            type: "confirm",
            name: "proceed",
            message: "Would you like to retry with the --force flag?",
            default: true,
          },
        ]);
        if (!confirmed) {
          process.exit(1);
        }
        return deploy({ ...options, force: true });
      }
      throw new Error(errorText ?? "Unknown error");
    }
    return response;
  };

  const response = await deploy(manifest);

  // Validate response structure
  if (
    !response.structuredContent ||
    typeof response.structuredContent !== "object"
  ) {
    console.error("❌ Deployment failed: Invalid response structure");
    console.error("Response:", JSON.stringify(response, null, 2));
    throw new Error("Deployment response missing structuredContent");
  }

  const structuredContent = response.structuredContent as { hosts?: string[] };
  const hosts = structuredContent.hosts;

  if (!hosts || !Array.isArray(hosts) || hosts.length === 0) {
    console.error("❌ Deployment failed: No hosts returned in response");
    console.error("Response:", JSON.stringify(response, null, 2));
    throw new Error("Deployment response missing hosts array");
  }

  console.log(`\n🎉 Deployed! Available at:`);
  hosts.forEach((host) => console.log(`  ${host}`));
  console.log();

  const previewUrl = promote ? null : hosts[0];
  if (process.env.GITHUB_OUTPUT && previewUrl) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `preview_url=${previewUrl}\n`,
    );
  }
};
