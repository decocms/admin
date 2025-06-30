import { Confirm } from "@cliffy/prompt";
import { walk } from "@std/fs";
import { createWorkspaceClient } from "../mcp.ts";
import { getCurrentEnvVars } from "../wrangler.ts";
import { relative } from "@std/path/relative";

export type FileLike = {
  path: string;
  content: string;
};

interface Options {
  cwd: string;
  workspace: string;
  app: string;
  local: boolean;
  skipConfirmation?: boolean;
}

export const deploy = async (
  { cwd, workspace, app: appSlug, local, skipConfirmation }: Options,
) => {
  console.log(`\n🚀 Deploying '${appSlug}' to '${workspace}'...\n`);

  // 1. Prepare files to upload: all files in dist/ and wrangler.toml (if exists)
  const files: FileLike[] = [];
  let hasTsFile = false;

  // Recursively walk cwd/ and add all files
  for await (
    const entry of walk(cwd, {
      includeDirs: false,
      exts: [".ts", ".mjs", ".js", ".cjs", ".toml", ".json", ".css", ".html"],
    })
  ) {
    const realPath = relative(cwd, entry.path);
    const content = await Deno.readTextFile(entry.path);
    files.push({ path: realPath, content });
    if (realPath.endsWith(".ts")) {
      hasTsFile = true;
    }
  }

  // 2. wrangler.toml (optional)
  let wranglerTomlStatus = "";
  let wranglerTomlPath = `${cwd}/wrangler.toml`;
  try {
    const wranglerTomlContent = await Deno.readTextFile(wranglerTomlPath);
    files.push({ path: "wrangler.toml", content: wranglerTomlContent });
    wranglerTomlStatus = `wrangler.toml ✅ (found in ${wranglerTomlPath})`;
  } catch (_) {
    // Not found in cwd, try Deno.cwd()
    wranglerTomlPath = `${Deno.cwd()}/wrangler.toml`;
    try {
      const wranglerTomlContent = await Deno.readTextFile(wranglerTomlPath);
      files.push({ path: "wrangler.toml", content: wranglerTomlContent });
      wranglerTomlStatus = `wrangler.toml ✅ (found in ${wranglerTomlPath})`;
    } catch (_) {
      wranglerTomlStatus = "wrangler.toml ❌";
    }
  }

  // 3. Load envVars from .dev.vars
  const envVars = await getCurrentEnvVars(cwd);

  const manifest = { appSlug, files, envVars, bundle: hasTsFile };

  console.log("🚚 Deployment summary:");
  console.log(`  App: ${appSlug}`);
  console.log(`  Files: ${files.length}`);
  console.log(`  ${wranglerTomlStatus}`);

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
    throw new Error(response.content[0]?.text ?? "Unknown error");
  }

  const { entrypoint } = response.structuredContent as { entrypoint: string };
  console.log(`\n🎉 Deployed! Available at: ${entrypoint}\n`);
};
