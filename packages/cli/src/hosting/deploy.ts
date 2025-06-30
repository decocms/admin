import { Confirm } from "@cliffy/prompt";
import { walk } from "@std/fs";
import { createWorkspaceClient } from "../mcp.ts";
import { getCurrentEnvVars } from "../wrangler.ts";

export type FileLike = {
  path: string;
  content: string;
};

interface Options {
  workspace: string;
  app: string;
  local: boolean;
  skipConfirmation?: boolean;
}

export const deploy = async (
  { workspace, app: appSlug, local, skipConfirmation }: Options,
) => {
  const rootDir = Deno.cwd();
  console.log(`\n🚀 Deploying '${appSlug}' to '${workspace}'...\n`);

  // 1. Run wrangler deploy --dry-run --outdir dist
  const wranglerCmd = new Deno.Command("wrangler", {
    args: ["deploy", "--dry-run", "--outdir", "dist"],
    cwd: rootDir,
    stdout: "null",
    stderr: "null",
  });
  const wranglerResult = await wranglerCmd.output();
  if (wranglerResult.code !== 0) {
    throw new Error("wrangler deploy --dry-run failed");
  }

  // 2. Prepare files to upload: all files in dist/ and wrangler.toml (if exists)
  const files: FileLike[] = [];
  const distDir = `${rootDir}/dist`;

  // Recursively walk dist/ and add all files
  for await (
    const entry of walk(distDir, {
      includeDirs: false,
      exts: [".ts", ".mjs", ".js", ".cjs", ".toml", ".json", ".css", ".html"],
    })
  ) {
    const relPath = entry.path.slice(distDir.length + 1);
    const content = await Deno.readTextFile(entry.path);
    files.push({ path: relPath, content });
  }

  // wrangler.toml (optional)
  let wranglerTomlStatus = "";
  try {
    const wranglerTomlContent = await Deno.readTextFile(
      `${rootDir}/wrangler.toml`,
    );
    files.push({ path: "wrangler.toml", content: wranglerTomlContent });
    wranglerTomlStatus = "wrangler.toml ✅";
  } catch (_) {
    // Not present, skip
    wranglerTomlStatus = "wrangler.toml ❌";
  }

  // 3. Load envVars from .dev.vars
  const envVars = await getCurrentEnvVars(rootDir);

  const manifest = { appSlug, files, envVars, bundle: false };

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
