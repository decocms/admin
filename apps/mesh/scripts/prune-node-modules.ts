#!/usr/bin/env bun
/**
 * Prune node_modules to only include kysely-bun-worker and its dependencies
 * Uses @vercel/nft to trace file dependencies
 */

import { nodeFileTrace } from "@vercel/nft";
import { mkdir, cp } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const ENTRY_POINT = "kysely-bun-worker";
// Find the workspace root (where node_modules is located)
// Script runs from apps/mesh, so we need to go up to the root
const WORKSPACE_ROOT = process.cwd().includes("/apps/mesh")
  ? join(process.cwd(), "../..")
  : process.cwd();
const OUTPUT_DIR = join(WORKSPACE_ROOT, "pruned_node_modules");
const NODE_MODULES_DIR = join(WORKSPACE_ROOT, "node_modules");

async function pruneNodeModules() {
  console.log(`🔍 Tracing dependencies for ${ENTRY_POINT}...`);

  // Find the entry point file
  let entryPointPath: string;
  try {
    entryPointPath = require.resolve(ENTRY_POINT);
  } catch (error) {
    console.error(`❌ Failed to resolve ${ENTRY_POINT}:`, error);
    process.exit(1);
  }
  console.log(`📦 Entry point: ${entryPointPath}`);

  // Trace all file dependencies
  const { fileList } = await nodeFileTrace([entryPointPath], {
    base: WORKSPACE_ROOT,
  });

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
    await Bun.$`rm -rf ${OUTPUT_DIR}`.quiet();
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
}

pruneNodeModules().catch((error) => {
  console.error("❌ Error pruning node_modules:", error);
  process.exit(1);
});
