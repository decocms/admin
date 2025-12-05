import { promises as fs } from "fs";
import inquirer from "inquirer";
import { Buffer } from "node:buffer";
import process from "node:process";
import { posix, relative } from "path";
import { walk } from "../../../lib/fs.js";
import type {
  BuildManifestOptions,
  DeploymentClient,
  DeployOptions,
  DeployResponse,
  HostingTarget,
  PrepareFilesOptions,
} from "./index.js";
import type { FileLike } from "../deploy.js";

const WRANGLER_CONFIG_FILES = ["wrangler.toml", "wrangler.json"];

function normalizePath(path: string): string {
  // Convert Windows backslashes to Unix forward slashes
  return posix.normalize(path.replace(/\\/g, "/"));
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class DecoCMSCloudflareTarget implements HostingTarget {
  readonly name = "decocms-cloudflare";

  async detect(cwd: string): Promise<boolean> {
    // Check if wrangler.toml or wrangler.json exists in cwd
    for (const configFile of WRANGLER_CONFIG_FILES) {
      try {
        await fs.stat(`${cwd}/${configFile}`);
        return true;
      } catch {
        // not found, try next
      }
    }

    // Check in process.cwd() as fallback
    for (const configFile of WRANGLER_CONFIG_FILES) {
      try {
        await fs.stat(`${process.cwd()}/${configFile}`);
        return true;
      } catch {
        // not found, try next
      }
    }

    return false;
  }

  async validateConfig(cwd: string): Promise<void> {
    // For Cloudflare, we check if wrangler config exists (done in detect)
    // This is already optional, so no strict validation needed
  }

  async prepareFiles(
    options: PrepareFilesOptions,
  ): Promise<{ files: FileLike[]; metadata: Record<string, unknown> }> {
    const { cwd, assetsDirectory } = options;
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

    // Add assets if specified
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

    // Check for wrangler config in process.cwd() if not found in walk
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

    return {
      files,
      metadata: {
        hasTsFile,
        wranglerConfigStatus,
      },
    };
  }

  buildManifest(options: BuildManifestOptions): Record<string, unknown> {
    const {
      appSlug,
      files,
      envVars,
      envFilepath,
      unlisted,
      force,
      promote,
    } = options;

    // For Cloudflare, we need to determine if bundling is needed
    const hasTsFile = files.some((f) => f.path.endsWith(".ts"));

    return {
      appSlug,
      files,
      envVars,
      envFilepath,
      bundle: hasTsFile,
      unlisted,
      force,
      promote,
    };
  }

  async deploy(options: DeployOptions): Promise<DeployResponse> {
    const { manifest, client, skipConfirmation } = options;

    const deployFn = async (
      deployManifest: Record<string, unknown>,
    ): Promise<DeployResponse> => {
      const response = await client.callTool({
        name: "HOSTING_APP_DEPLOY",
        arguments: deployManifest,
      });

      if (response.isError && Array.isArray(response.content)) {
        console.error("Error deploying: ", response);

        const errorText = response.content[0]?.text;
        const errorTextJson = tryParseJson(errorText ?? "");
        if (
          errorTextJson?.name === "MCPBreakingChangeError" &&
          !deployManifest.force
        ) {
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
          if (!confirmed.proceed) {
            process.exit(1);
          }
          return deployFn({ ...deployManifest, force: true });
        }
        throw new Error(errorText ?? "Unknown error");
      }

      // Validate response structure
      if (
        !response.structuredContent ||
        typeof response.structuredContent !== "object"
      ) {
        console.error("❌ Deployment failed: Invalid response structure");
        console.error("Response:", JSON.stringify(response, null, 2));
        throw new Error("Deployment response missing structuredContent");
      }

      const structuredContent = response.structuredContent as {
        hosts?: string[];
      };
      const hosts = structuredContent.hosts;

      if (!hosts || !Array.isArray(hosts) || hosts.length === 0) {
        console.error("❌ Deployment failed: No hosts returned in response");
        console.error("Response:", JSON.stringify(response, null, 2));
        throw new Error("Deployment response missing hosts array");
      }

      return { hosts };
    };

    return deployFn(manifest);
  }
}
