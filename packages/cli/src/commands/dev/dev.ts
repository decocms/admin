// @ts-ignore Node types may be excluded in some build contexts
import { spawn, execSync } from "child_process";
import { getConfig, readWranglerConfig } from "../../lib/config.js";
import { ensureDevEnvironment } from "../../lib/wrangler.js";
import { link } from "./link.js";
// Use global process (avoid node:process import for type resolution portability)

// Lightweight free port finder using fetch race (net module may be unavailable in some runtimes)
async function findFreePort(
  preferred: number,
  maxAttempts = 10,
): Promise<number> {
  let port = preferred;
  for (let i = 0; i < maxAttempts; i++) {
    // Try connecting; if connection succeeds (HTTP 200/404/etc), port in use.
    // If it fails quickly (network error), assume free.
    try {
      // eslint-disable-next-line no-await-in-loop
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 400);
      // eslint-disable-next-line no-await-in-loop
      await fetch(`http://localhost:${port}`, { signal: controller.signal });
      clearTimeout(timeout);
      port += 1; // in use, try next
    } catch (_e) {
      return port; // treat as free
    }
  }
  throw new Error("No free port found for wrangler dev");
}

export interface StartDevServerOptions {
  cleanBuildDirectory?: {
    enabled: boolean;
    directory: string;
  };
}

export async function devCommand(opts: StartDevServerOptions): Promise<void> {
  try {
    // 1. Ensure development environment is set up
    console.log("🔧 Setting up development environment...");
    await ensureDevEnvironment(opts);

    // 2. Get configuration
    const _config = await getConfig().catch(() => ({
      workspace: "default",
      bindings: [],
      local: false,
      enable_workflows: true,
    }));

    const wranglerConfig = await readWranglerConfig();
    const app =
      typeof wranglerConfig.name === "string" ? wranglerConfig.name : "my-app";

    console.log(`📦 Starting development server for '${app}'...`);

    // 3. TODO: Check/setup MCP configuration when we port those utilities
    // const latest = await hasMCPPreferences(config.workspace, app);
    // if (!latest) {
    //   const mcpConfig = await promptIDESetup({
    //     workspace: config.workspace,
    //     app,
    //   });
    //   if (mcpConfig) {
    //     await writeIDEConfig(mcpConfig);
    //   }
    // }

    // 4. Start development server with tunnel integration
    console.log("🚀 Starting development server with tunnel...");

    // Detect unsupported macOS for local workerd and fall back to remote mode
    let useRemote = false;
    if (process.platform === "darwin") {
      try {
        const ver = execSync("sw_vers -productVersion", {
          encoding: "utf8",
        }).trim();
        const [maj, min] = ver.split(".").map((n: string) => parseInt(n, 10));
        // Minimum required: 13.5.0
        if (maj < 13 || (maj === 13 && min < 5)) {
          useRemote = true;
          console.warn(
            `⚠️  Detected macOS ${ver} (< 13.5). Falling back to 'wrangler dev --remote' (local workerd unsupported).`,
          );
        }
      } catch {
        // ignore detection errors
      }
    }

    let wranglerPort: number | undefined;
    if (!useRemote) {
      const argPort = process.argv
        .find((a: string) => a.startsWith("--port="))
        ?.split("=")[1];
      const desiredPort = Number(argPort || process.env.PORT || 8787);
      wranglerPort = await findFreePort(
        Number.isFinite(desiredPort) ? desiredPort : 8787,
      ).catch(() => 8790);
      process.env.PORT = String(wranglerPort);
      process.env.DECO_SELF_URL = `http://localhost:${wranglerPort}`;
      console.log(`🛠️  Selected local wrangler port: ${wranglerPort}`);
    } else {
      // Remote preview URL will be printed by wrangler; user can set DECO_SELF_URL manually for gen:self
      process.env.DECO_REMOTE = "1";
    }

    // Use link command with wrangler dev as subprocess
    await link({
      port: 8888,
      onBeforeRegister: () => {
        console.log("🔗 Starting Wrangler development server...");

        const wranglerArgs = useRemote
          ? ["wrangler", "dev", "--remote"]
          : ["wrangler", "dev", "--port", String(process.env.PORT)];
        const wranglerProcess = spawn("npx", wranglerArgs, {
          stdio: "inherit",
          shell: true,
        });

        // Handle process termination
        const cleanup = () => {
          console.log("\n⏹️  Stopping development server...");
          wranglerProcess.kill("SIGINT");
          process.exit(0);
        };

        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
        if (!useRemote && process.env.DECO_SELF_URL) {
          console.log(`🔍 MCP base URL: ${process.env.DECO_SELF_URL}/mcp`);
        } else if (useRemote) {
          console.log(
            "🔍 Remote mode enabled. After wrangler shows the preview URL, use it as DECO_SELF_URL for generation.",
          );
        }

        wranglerProcess.on("error", (error: unknown) => {
          const msg =
            error && typeof error === "object" && "message" in error
              ? (error as { message: string }).message
              : String(error);
          console.error("❌ Failed to start Wrangler:", msg);
          process.exit(1);
        });

        return wranglerProcess;
      },
    });
  } catch (error) {
    console.error(
      "❌ Development server failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
