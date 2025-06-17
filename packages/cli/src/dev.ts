import { getConfigFilePath } from "./config.ts";

const USER_WORKER_APP_ENTRYPOINTS = [
  "main.ts",
  "main.mjs",
  "main.js",
  "main.cjs",
];

export const startDevServer = () => {
  const maybeConfigPath = getConfigFilePath(Deno.cwd());
  const rootDir = maybeConfigPath
    ? maybeConfigPath.split("/").slice(0, -1).join("/")
    : Deno.cwd();
  const files = Deno.readDirSync(rootDir);
  const entrypoint = files.find((file) =>
    USER_WORKER_APP_ENTRYPOINTS.includes(file.name)
  );

  if (!entrypoint) {
    console.error(
      `Entrypoint not found in directory ${rootDir}. Please create one of: ${
        USER_WORKER_APP_ENTRYPOINTS.join(", ")
      }`,
    );
    Deno.exit(1);
  }

  const entrypointAbsolutePath = `${rootDir}/${entrypoint.name}`;
  const devCommand = new Deno.Command("deno", {
    args: ["serve", "-A", entrypointAbsolutePath],
    cwd: rootDir,
    stdout: "inherit",
    stderr: "inherit",
  });

  devCommand.spawn();
};
