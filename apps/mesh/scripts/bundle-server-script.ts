#!/usr/bin/env bun
/**
 * Server and migration script bundler - bundles both server and migration scripts
 * Prunes node_modules to only include required dependencies for both scripts
 * Uses @vercel/nft to trace file dependencies
 *
 * Usage:
 *   bun run scripts/bundle-server-script.ts [--dist <path>]
 *
 * Options:
 *   --dist <path>  Output directory for pruned node_modules, server.js, and migrate.js (default: ./dist-server)
 */

import { nodeFileTrace } from "@vercel/nft";
import { mkdir, cp } from "fs/promises";
import { join, dirname, resolve } from "path";
import { existsSync } from "fs";
import { $ } from "bun";

const SCRIPT_DIR =
  import.meta.dir || dirname(new URL(import.meta.url).pathname);
const SERVER_ENTRY_POINT = join(SCRIPT_DIR, "../src/index.ts");
const MIGRATE_ENTRY_POINT = "kysely-bun-worker";

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  let distPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dist" && i + 1 < args.length) {
      distPath = args[i + 1];
      i++; // Skip the next argument as it's the value
    }
  }

  return { distPath };
}

// Find the workspace root (where node_modules is located)
// Script is at apps/mesh/scripts, so we need to go up three levels to the repo root
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, "../../..");
const NODE_MODULES_DIR = join(WORKSPACE_ROOT, "node_modules");

// Get dist path from args or use default
const { distPath } = parseArgs();
const OUTPUT_DIR = distPath
  ? resolve(distPath)
  : join(process.cwd(), "dist-server");

async function pruneNodeModules(): Promise<Set<string>> {
  console.log(`🔍 Tracing dependencies for server and migration scripts...`);

  // Find the migration entry point file
  let migrateEntryPointPath: string;
  try {
    migrateEntryPointPath = require.resolve(MIGRATE_ENTRY_POINT);
  } catch (error) {
    console.error(`❌ Failed to resolve ${MIGRATE_ENTRY_POINT}:`, error);
    process.exit(1);
  }
  console.log(`📦 Migration entry point: ${migrateEntryPointPath}`);

  // Resolve server entry point to absolute path
  const serverEntryPointPath = resolve(SERVER_ENTRY_POINT);
  if (!existsSync(serverEntryPointPath)) {
    console.error(`❌ Server entry point not found: ${serverEntryPointPath}`);
    process.exit(1);
  }
  console.log(`📦 Server entry point: ${serverEntryPointPath}`);

  // Trace all file dependencies for both entry points
  const { fileList } = await nodeFileTrace(
    [migrateEntryPointPath, serverEntryPointPath],
    {
      base: WORKSPACE_ROOT,
    },
  );

  console.log(`📋 Found ${fileList.size} files in dependency tree`);

  // Extract unique package names from traced files
  const packagesToCopy = new Set<string>();
  for (const file of fileList) {
    // Extract package name from path (e.g., node_modules/kysely-bun-worker/... -> kysely-bun-worker)
    if (file.startsWith("node_modules/")) {
      const parts = file.split("/");
      if (parts.length > 1) {
        const packageName = parts[1];
        // Handle scoped packages (e.g., @vercel/nft)
        if (packageName.startsWith("@") && parts.length > 2) {
          packagesToCopy.add(`${packageName}/${parts[2]}`);
        } else {
          packagesToCopy.add(packageName);
        }
      }
    }
  }

  console.log(
    `📦 Found ${packagesToCopy.size} packages to copy:`,
    Array.from(packagesToCopy).join(", "),
  );

  // Create output directory structure
  if (existsSync(OUTPUT_DIR)) {
    console.log(`🧹 Cleaning existing ${OUTPUT_DIR}...`);
    await $`rm -rf ${OUTPUT_DIR}`.quiet();
  }
  const outputNodeModules = join(OUTPUT_DIR, "node_modules");
  await mkdir(outputNodeModules, { recursive: true });

  // Copy entire package directories to ensure package.json and all metadata are included
  let copiedCount = 0;
  for (const packageName of packagesToCopy) {
    const packagePath = join(NODE_MODULES_DIR, packageName);
    const destPackagePath = join(outputNodeModules, packageName);

    if (!existsSync(packagePath)) {
      console.warn(`⚠️  Package not found: ${packageName} at ${packagePath}`);
      continue;
    }

    try {
      await cp(packagePath, destPackagePath, { recursive: true });
      copiedCount++;
      console.log(`✅ Copied package: ${packageName}`);
    } catch (error) {
      console.warn(`⚠️  Failed to copy package ${packageName}: ${error}`);
    }
  }

  console.log(
    `\n✅ Successfully copied ${copiedCount} packages to ${OUTPUT_DIR}`,
  );
  console.log(`📊 Output directory: ${OUTPUT_DIR}`);

  return packagesToCopy;
}

async function buildMigrateScript(packagesToExternalize: Set<string>) {
  console.log("🔨 Building migrate.js...");

  const migrateSourcePath = join(SCRIPT_DIR, "../src/database/migrate.ts");
  const migrateOutputPath = join(OUTPUT_DIR, "migrate.js");

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  const commandsParts = [
    "bun",
    "build",
    migrateSourcePath,
    "--target",
    "bun",
    "--minify",
    "--production",
    "--outfile",
    migrateOutputPath,
    "--external",
    "bun:sqlite",
  ];

  for (const pkg of packagesToExternalize) {
    commandsParts.push("--external", pkg);
  }

  console.log(`🔨 Running command: ${commandsParts.join(" ")}`);
  // Build migrate.js
  await $`${commandsParts}`.quiet();

  if (!existsSync(migrateOutputPath)) {
    console.error("❌ Failed to build migrate.js");
    process.exit(1);
  }

  console.log(`✅ migrate.js built successfully at ${migrateOutputPath}`);
}

async function buildServerScript(packagesToExternalize: Set<string>) {
  console.log("🔨 Building server.js...");

  const serverSourcePath = join(SCRIPT_DIR, "../src/index.ts");
  const serverOutputPath = join(OUTPUT_DIR, "server.js");

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  const commandsParts = [
    "bun",
    "build",
    serverSourcePath,
    "--target",
    "bun",
    "--minify",
    "--production",
    "--outfile",
    serverOutputPath,
    "--external",
    "bun:sqlite",
  ];

  for (const pkg of packagesToExternalize) {
    commandsParts.push("--external", pkg);
  }

  console.log(`🔨 Running command: ${commandsParts.join(" ")}`);
  // Build server.js
  await $`${commandsParts}`.quiet();

  if (!existsSync(serverOutputPath)) {
    console.error("❌ Failed to build server.js");
    process.exit(1);
  }

  console.log(`✅ server.js built successfully at ${serverOutputPath}`);
}

async function main() {
  // Prune node_modules to only include required dependencies for both scripts
  const packagesToExternalize = await pruneNodeModules();

  // Build both migrate.js and server.js
  await buildMigrateScript(packagesToExternalize);
  await buildServerScript(packagesToExternalize);

  console.log("\n🎉 Build completed successfully!");
  console.log(`📦 Output directory: ${OUTPUT_DIR}`);
  console.log(`   - migrate.js`);
  console.log(`   - server.js`);
  console.log(`   - node_modules/`);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
