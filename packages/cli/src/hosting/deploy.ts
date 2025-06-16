import { Confirm } from "@cliffy/prompt";
import { parse } from "@std/dotenv";
import { walk } from "@std/fs";
import { createWorkspaceClient } from "../mcp.ts";

interface Options {
  workspace: string;
  appSlug: string;
}

const readEnvFile = async (rootDir: string) => {
  const envFiles = [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.test",
  ];
  let envVars: Record<string, string> = {};

  for (const envFile of envFiles) {
    const envPath = `${rootDir}/${envFile}`;
    try {
      const stat = await Deno.stat(envPath);
      if (stat.isFile) {
        const envContent = await Deno.readTextFile(envPath);
        const parsed = parse(envContent);
        envVars = { ...envVars, ...parsed };
        console.log(`  ✅ Loaded env vars from ${envFile}`);
      }
    } catch (_) {
      // File does not exist, skip
    }
  }

  return envVars;
};

const gatherFiles = async (rootDir: string) => {
  const tsFiles: string[] = [];
  const walker = walk(rootDir, {
    exts: [".ts"],
    includeDirs: false,
    skip: [/node_modules/],
  });

  for await (const entry of walker) {
    tsFiles.push(entry.path.slice(rootDir.length + 1));
  }

  return tsFiles;
};

const readFiles = async (rootDir: string, tsFiles: string[]) => {
  const files = await Promise.all(
    tsFiles.map(async (filePath) => ({
      path: filePath,
      content: await Deno.readTextFile(`${rootDir}/${filePath}`),
    })),
  );

  return files;
};

export type FileLike = {
  path: string;
  content: string;
};

interface BuildManifest {
  envVars: Record<string, string>;
  appSlug: string;
  files: FileLike[];
}

const manifestFrom = ({ appSlug, files, envVars }: BuildManifest) => ({
  appSlug,
  files,
  envVars,
});

export const deploy = async ({ workspace, appSlug }: Options) => {
  const rootDir = Deno.cwd();
  console.log(`\n🚀 Deploying '${appSlug}' to '${workspace}'...\n`);

  const client = await createWorkspaceClient({ workspace });
  const envVars = await readEnvFile(rootDir);
  const filePaths = await gatherFiles(rootDir);
  const files = await readFiles(rootDir, filePaths);
  const manifest = manifestFrom({ appSlug, files, envVars });

  console.log("🚚 Deployment summary:");
  console.log(`  App: ${appSlug}`);
  console.log(`  Files: ${files.length}`);

  const confirmed = await Confirm.prompt("Proceed with deployment?");
  if (!confirmed) {
    console.log("❌ Deployment cancelled");
    Deno.exit(0);
  }

  const response = await client.callTool({
    name: "HOSTING_APP_DEPLOY",
    arguments: manifest,
  });

  if (response.isError && Array.isArray(response.content)) {
    throw new Error(response.content[0]?.text ?? "Unknown error");
  }

  const { entrypoint } = response.structuredContent as { entrypoint: string };
  console.log(`\n🎉 Deployed! Available at: ${entrypoint}\n`);

  await client.close();
};
