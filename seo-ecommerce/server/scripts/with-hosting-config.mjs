#!/usr/bin/env node
// Temporarily strip specific [[kv_namespaces]] blocks (e.g. SEO_CACHE) from wrangler.toml
// so that deco hosting deploy does not attempt to attach external KV (avoids 10041 errors).
// Restores the original file after the wrapped command exits.

import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const WRANGLER = path.join(ROOT, "wrangler.toml");
const BACKUP = path.join(ROOT, "wrangler.original.toml");
const HOSTING = path.join(ROOT, "wrangler.hosting.toml");

const BINDINGS_TO_STRIP = (process.env.STRIP_KV_BINDINGS || "SEO_CACHE")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function buildHostingConfig(original) {
  // Remove only [[kv_namespaces]] blocks whose binding matches BINDINGS_TO_STRIP
  // Simple state machine parsing.
  const lines = original.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "[[kv_namespaces]]") {
      const block = [line];
      i++;
      let bindingName = undefined;
      while (i < lines.length) {
        const l = lines[i];
        if (
          l.trim().startsWith("[") && l.trim() !== "[vars]" &&
          l.trim() !== "[assets]" && !l.trim().startsWith("binding =")
        ) {
          // Next table/array or section begins; stop block.
          break;
        }
        if (l.trim().startsWith("binding")) {
          const m = l.match(/binding\s*=\s*"([^"]+)"/);
          if (m) bindingName = m[1];
        }
        if (l.trim().startsWith("[[kv_namespaces]]") && block.length > 0) {
          // Found another block start unexpectedly – break so outer loop reprocesses.
          break;
        }
        block.push(l);
        i++;
      }
      if (bindingName && BINDINGS_TO_STRIP.includes(bindingName)) {
        // Skip writing this block.
        continue;
      } else {
        out.push(...block);
      }
      continue; // already advanced i
    } else {
      out.push(line);
      i++;
    }
  }
  return out.join("\n");
}

function prepare() {
  if (!fs.existsSync(WRANGLER)) {
    console.error("wrangler.toml not found");
    process.exit(1);
  }
  if (fs.existsSync(BACKUP)) {
    console.error(
      "Backup already exists, aborting to avoid overwrite:",
      BACKUP,
    );
    process.exit(1);
  }
  const original = fs.readFileSync(WRANGLER, "utf-8");
  fs.writeFileSync(BACKUP, original, "utf-8");
  const hosting = buildHostingConfig(original);
  fs.writeFileSync(HOSTING, hosting, "utf-8");
  fs.copyFileSync(HOSTING, WRANGLER);
}

function restore() {
  try {
    if (fs.existsSync(BACKUP)) {
      fs.copyFileSync(BACKUP, WRANGLER);
      fs.unlinkSync(BACKUP);
    }
  } catch (e) {
    console.error("Failed to restore wrangler.toml:", e);
  }
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: with-hosting-config <command> [args...]");
  process.exit(1);
}

prepare();

const child = spawn(args[0], args.slice(1), {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

child.on("exit", (code) => {
  restore();
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error("Child process error:", err);
  restore();
  process.exit(1);
});

process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(143);
});
