import type { Sandbox } from "@cloudflare/sandbox";
import { join } from "node:path";

const ensureStartingSlash = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

const OUTPUT_FILE = "script.mjs";

/**
 * Bundles the given files into a single string using the Cloudflare Sandbox.
 *
 * @param files - A record of file paths to their content.
 * @param entrypoint - The entrypoint file path.
 * @param SANDBOX - The DurableObjectNamespace<Sandbox> binding.
 * @returns The bundled code as a base64 string.
 */
export const bundle = async (
  files: Record<string, string>,
  options: {
    workspace: string;
    appSlug: string;
    sandbox: DurableObjectStub<Sandbox>;
  },
): Promise<string> => {
  const { workspace, appSlug, sandbox } = options;
  const root = ensureStartingSlash(join(workspace, appSlug));

  // Copy the files to the sandbox
  await Promise.all(
    Object.entries(files).map(([path, content]) =>
      sandbox.writeFile(join(root, path), content, { encoding: "utf-8" })
    ),
  );

  // Install dependencies
  const install = await sandbox.exec("bun", ["install", `--cwd=${root}`]);

  if (install?.exitCode !== 0) {
    throw new Error(
      `Install deps failed: ${install?.stderr || install?.stdout}`,
    );
  }

  // Bundle the script
  const bundleResult = await sandbox.exec("bun", [
    "x",
    "wrangler",
    "--",
    "--cwd",
    root,
    "deploy",
    "--dry-run",
    "--outfile",
    OUTPUT_FILE,
    ...(files["wrangler.toml"] ? ["--config", "wrangler.toml"] : []),
  ]);

  if (bundleResult?.exitCode !== 0) {
    throw new Error(
      `wrangler deploy failed: ${bundleResult?.stderr || bundleResult?.stdout}`,
    );
  }

  // Read the generated script.mjs
  const readResult = await sandbox.readFile(join(root, OUTPUT_FILE), {
    encoding: "utf-8",
  });
  if (typeof readResult?.content !== "string") {
    throw new Error(`Failed to read ${OUTPUT_FILE} from sandbox`);
  }

  return readResult.content
    .split("Content-Type: application/javascript+module")[1]
    .split("------formdata-undici-")[0].trim();
};
