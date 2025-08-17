#!/usr/bin/env node
/**
 * Cache purge script for SEO_CACHE KV.
 * Usage:
 *  node seo-ecommerce/server/scripts/cache-purge.mjs --key <exact-key>
 *  node seo-ecommerce/server/scripts/cache-purge.mjs --prefix pagespeed:v1:
 * Requires environment with Cloudflare credentials or runs via `wrangler kv` CLI fallback.
 */
import { execSync } from "node:child_process";
import { logSafe } from "@deco/workers-runtime/logSafe";

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--key") out.key = args[++i];
    else if (a === "--prefix") out.prefix = args[++i];
    else if (a === "--dry-run") out.dry = true;
  else if (a === "--json") out.json = true;
  }
  return out;
}

const { key, prefix, dry, json } = parseArgs();
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

const summary = { mode: key ? 'single' : 'prefix', key: key || null, prefix: prefix || null, dry, deleted: [], count: 0 };

try {
  if (key) {
    if (dry) {
      logSafe.info("[cache-purge] dry-run delete key", { key });
    } else {
      run(`npx wrangler kv key delete --binding=SEO_CACHE "${key}"`);
      logSafe.info("[cache-purge] deleted key", { key });
      summary.deleted.push(key);
      summary.count = 1;
    }
  } else if (prefix) {
    const listRaw = run(
      `npx wrangler kv key list --binding=SEO_CACHE --prefix='${prefix}'`,
    );
    const list = JSON.parse(listRaw);
    if (!Array.isArray(list)) throw new Error("Unexpected list output");
    if (list.length === 0) {
      logSafe.info("[cache-purge] no keys with prefix", { prefix });
    } else if (dry) {
      logSafe.info("[cache-purge] dry-run delete prefix", {
        prefix,
        count: list.length,
      });
      list.forEach((k) =>
        logSafe.info("[cache-purge] candidate", { key: k.name }),
      );
      summary.deleted = list.map(k => k.name);
      summary.count = list.length;
    } else {
      for (const k of list) {
        run(`npx wrangler kv key delete --binding=SEO_CACHE "${k.name}"`);
        logSafe.info("[cache-purge] deleted", { key: k.name });
        summary.deleted.push(k.name);
      }
      summary.count = summary.deleted.length;
    }
  }
} catch (e) {
  summary.error = e.message;
  logSafe.error("[cache-purge] failed", { error: e.message });
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  }
  process.exit(1);
}

if (json) {
  console.log(JSON.stringify(summary, null, 2));
}
