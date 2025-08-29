import { spawn } from "child_process";
import { watch } from "fs";
import { join, resolve } from "path";
import { writeFile } from "fs/promises";
import {
  getConfig,
  readWranglerConfig,
  getAppDomain,
} from "../../lib/config.js";
import { ensureDevEnvironment } from "../../lib/wrangler.js";
import { genEnv } from "../gen/gen.js";
import { link } from "./link.js";
import process from "node:process";

export interface StartDevServerOptions {
  cleanBuildDirectory?: {
    enabled: boolean;
    directory: string;
  };
  genWatch?: string;
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

    // 3. Setup gen-watch if requested
    if (opts.genWatch) {
      const watchPath = resolve(opts.genWatch);
      console.log(
        `👀 Setting up file watcher for TypeScript files in: ${watchPath}`,
      );

      let isGenerating = false;
      const debounceMs = 500;
      let debounceTimer: NodeJS.Timeout | null = null;

      const generateTypes = async () => {
        if (isGenerating) return;
        isGenerating = true;

        try {
          console.log(
            "🔄 TypeScript file changed, regenerating deco.gen.ts...",
          );

          const config = await getConfig();
          const wranglerConfig = await readWranglerConfig();
          const env = await genEnv({
            workspace: config.workspace,
            local: config.local,
            bindings: config.bindings,
            selfUrl: `https://${getAppDomain(
              config.workspace,
              wranglerConfig.name ?? "my-app",
            )}/mcp`,
          });

          const outputPath = join(process.cwd(), "deco.gen.ts");
          await writeFile(outputPath, env);
          console.log(`✅ Generated types written to: ${outputPath}`);
        } catch (error) {
          console.error(
            "❌ Failed to generate types:",
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          isGenerating = false;
        }
      };

      // Generate initial types
      await generateTypes();

      // Watch for changes
      const watcher = watch(
        watchPath,
        { recursive: true },
        (_eventType, filename) => {
          if (
            filename &&
            filename.endsWith(".ts") &&
            !filename.endsWith(".gen.ts")
          ) {
            // Debounce to avoid excessive regeneration
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(generateTypes, debounceMs);
          }
        },
      );

      // Clean up on exit
      const cleanupWatcher = () => {
        console.log("\n📁 Stopping file watcher...");
        watcher.close();
      };

      process.on("SIGINT", cleanupWatcher);
      process.on("SIGTERM", cleanupWatcher);
    }

    // 4. TODO: Check/setup MCP configuration when we port those utilities
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

    // 5. Start development server with tunnel integration
    console.log("🚀 Starting development server with tunnel...");

    // Use link command with wrangler dev as subprocess
    await link({
      port: 8787,
      onBeforeRegister: () => {
        console.log("🔗 Starting Wrangler development server...");

        const wranglerProcess = spawn("npx", ["wrangler", "dev"], {
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

        wranglerProcess.on("error", (error) => {
          console.error("❌ Failed to start Wrangler:", error.message);
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
