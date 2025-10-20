#!/usr/bin/env node

/**
 * create-deco
 *
 * A simple wrapper that invokes the 'create' command from deco-cli
 * This allows users to run: npm create deco <project-name>
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Get the project name from command line arguments
const args = process.argv.slice(2);

// Detect the current runtime
function detectRuntime() {
  if (typeof Bun !== "undefined") {
    return "bun";
  }
  return "node";
}

const runtime = detectRuntime();

// Find the deco-cli executable
// First try the local development path (monorepo)
let decoCli = path.resolve(__dirname, "../cli/dist/cli.js");

// If not found, try to find it in node_modules (when published)
if (!fs.existsSync(decoCli)) {
  try {
    // Try to resolve deco-cli package
    decoCli = require.resolve("deco-cli/dist/cli.js");
  } catch {
    // Fallback: try to find deco-cli binary
    try {
      const decoCliPkg = require.resolve("deco-cli/package.json");
      const decoCliDir = path.dirname(decoCliPkg);
      decoCli = path.join(decoCliDir, "dist", "cli.js");
    } catch {
      console.error(
        "❌ deco-cli not found. Please ensure deco-cli is installed.",
      );
      console.error("   Tried locations:");
      console.error(
        "   - Local:",
        path.resolve(__dirname, "../cli/dist/cli.js"),
      );
      console.error("   - Package:", "deco-cli/dist/cli.js");
      process.exit(1);
    }
  }
}

// Final check if deco-cli exists
if (!fs.existsSync(decoCli)) {
  console.error("❌ deco-cli not found. Please ensure deco-cli is installed.");
  console.error("   Expected location:", decoCli);
  process.exit(1);
}

// Prepare the command arguments
const commandArgs = ["create", ...args];

// Spawn the deco-cli process with the create command using the detected runtime
const child = spawn(runtime, [decoCli, ...commandArgs], {
  stdio: "inherit",
  cwd: process.cwd(),
});

// Handle process exit
child.on("close", (code) => {
  process.exit(code || 0);
});

child.on("error", (error) => {
  console.error("❌ Error executing deco-cli:", error.message);
  process.exit(1);
});
