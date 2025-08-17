#!/usr/bin/env node
/**
 * Cache purge script for SEO_CACHE KV.
 * Usage:
 *  node seo-ecommerce/server/scripts/cache-purge.mjs --key <exact-key>
 *  node seo-ecommerce/server/scripts/cache-purge.mjs --prefix pagespeed:v1:
 * Requires environment with Cloudflare credentials or runs via `wrangler kv` CLI fallback.
 */
import { execSync } from "node:child_process";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--key") out.key = args[++i];
    else if (a === "--prefix") out.prefix = args[++i];
    else if (a === "--dry-run") out.dry = true;
  }
  return out;
}

const { key, prefix, dry } = parseArgs();
if (!key && !prefix) {
  console.error("Provide --key <key> or --prefix <prefix>");
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, {
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
  });
}

try {
  if (key) {
    if (dry) {
      console.log(`[dry-run] Would delete key: ${key}`);
      process.exit(0);
    }
    run(`npx wrangler kv key delete --binding=SEO_CACHE "${key}"`);
    console.log(`Deleted key ${key}`);
  } else if (prefix) {
    const listRaw = run(
      `npx wrangler kv key list --binding=SEO_CACHE --prefix='${prefix}'`,
    );
    const list = JSON.parse(listRaw);
    if (!Array.isArray(list)) throw new Error("Unexpected list output");
    if (list.length === 0) {
      console.log("No keys with prefix", prefix);
      process.exit(0);
    }
    if (dry) {
      console.log(
        `[dry-run] Would delete ${list.length} keys for prefix ${prefix}`,
      );
      list.forEach((k) => console.log("  -", k.name));
      process.exit(0);
    }
    for (const k of list) {
      run(`npx wrangler kv key delete --binding=SEO_CACHE "${k.name}"`);
      console.log("Deleted", k.name);
    }
  }
} catch (e) {
  console.error("Purge failed", e.message);
  process.exit(1);
}
