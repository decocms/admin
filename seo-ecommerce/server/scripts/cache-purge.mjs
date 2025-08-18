#!/usr/bin/env node
/**
 * Cache purge script for SEO_CACHE KV.
 * Usage:
 *  node seo-ecommerce/server/scripts/cache-purge.mjs --key <exact-key>
 *  node seo-ecommerce/server/scripts/cache-purge.mjs --prefix pagespeed:v1:
 * Requires environment with Cloudflare credentials or runs via `wrangler kv` CLI fallback.
 */
import { exec, execSync } from 'node:child_process';
import { logSafe } from '@deco/workers-runtime/logSafe';
import { appendFileSync, writeFileSync } from 'node:fs';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--key') out.key = args[++i];
    else if (a === '--prefix') out.prefix = args[++i];
    else if (a === '--dry-run') out.dry = true;
    else if (a === '--offline') out.offline = true;
    else if (a === '--json') out.json = true;
    else if (a === '--concurrency') {
      out.concurrency = Number(args[++i]) || undefined;
    } else if (a === '--audit-file') out.auditFile = args[++i];
    else if (a === '--batch-wait-ms') {
      out.batchWaitMs = Number(args[++i]) || undefined;
    } else if (a === '--rate-per-sec') {
      out.ratePerSec = Number(args[++i]) || undefined;
    }
  }
  return out;
}
const {
  key,
  prefix,
  dry,
  json,
  offline,
  concurrency,
  auditFile,
  batchWaitMs,
  ratePerSec,
} = parseArgs();
if (!key && !prefix) {
  console.error('Provide --key <key> or --prefix <prefix>');
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
  });
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

const MAX_RETRIES = 5;
const BASE_DELAY = 300; // ms

function isRetryableError(errMsg) {
  if (!errMsg) return false;
  const s = String(errMsg).toLowerCase();
  return s.includes('429') || s.includes('rate limit') ||
    s.includes('timeout') || s.includes('econnreset');
}

function runAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout || '');
    });
  });
}

async function deleteWithRetries(keyName) {
  let attempt = 0;
  while (true) {
    try {
      await runAsync(
        `npx wrangler kv key delete --binding=SEO_CACHE "${keyName}"`,
      );
      return { ok: true };
    } catch (e) {
      attempt++;
      const msg = e && e.message ? e.message : String(e);
      if (attempt >= MAX_RETRIES || !isRetryableError(msg)) {
        return { ok: false, error: msg };
      }
      const delay = BASE_DELAY * Math.pow(2, attempt - 1);
      logSafe.warn('[cache-purge] transient delete error, retrying', {
        key: keyName,
        attempt,
        delay,
        error: msg,
      });
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay);
    }
  }
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function listKeysPaged(prefix) {
  const accumulated = [];
  let cursor = undefined;
  // Attempt to use --limit with cursor if supported by local wrangler
  while (true) {
    const cursorArg = cursor ? ` --cursor='${cursor}'` : '';
    // Use double quotes around prefix so PowerShell handles it safely
    const cmdWithLimit =
      `npx wrangler kv key list --binding=SEO_CACHE --prefix="${prefix}" --limit=1000${cursorArg}`;
    let raw;
    try {
      raw = run(cmdWithLimit);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      // Some wrangler versions don't support --limit. If that's the case, try without it.
      if (
        msg.toLowerCase().includes('unknown argument') &&
        msg.toLowerCase().includes('limit')
      ) {
        const cmdNoLimit =
          `npx wrangler kv key list --binding=SEO_CACHE --prefix="${prefix}"${cursorArg}`;
        try {
          raw = run(cmdNoLimit);
        } catch (e2) {
          const m2 = e2 && e2.message ? e2.message : String(e2);
          throw new Error(`Failed to list keys: ${m2}`);
        }
      } else {
        throw new Error(`Failed to list keys: ${msg}`);
      }
    }
    const parsed = safeJsonParse(raw);
    if (Array.isArray(parsed)) {
      // Older wrangler returns an array of keys directly
      accumulated.push(...parsed.map((k) => (k && k.name) || k));
      // If array length is less than limit, we assume end
      if (parsed.length < 1000) break;
      // Otherwise try to continue — but if no cursor mechanism, break to avoid infinite loop
      break;
    }
    if (parsed && Array.isArray(parsed.keys)) {
      accumulated.push(...parsed.keys.map((k) => k.name));
      // If the API returns a cursor token, continue
      if (parsed.cursor) {
        cursor = parsed.cursor;
        continue;
      }
      // No cursor, stop
      break;
    }
    // Fallback: try to parse newline-delimited output (some wrangler prints pretty output)
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    // Try to extract JSON-looking pieces
    for (const l of lines) {
      const p = safeJsonParse(l);
      if (p && (Array.isArray(p) || p.keys)) {
        if (Array.isArray(p)) {
          accumulated.push(...p.map((k) => (k && k.name) || k));
        } else if (Array.isArray(p.keys)) {
          accumulated.push(...p.keys.map((k) => k.name));
        }
      }
    }
    break;
  }
  return accumulated;
}

const summary = {
  mode: key ? 'single' : 'prefix',
  key: key || null,
  prefix: prefix || null,
  dry,
  deleted: [],
  count: 0,
};

try {
  if (key) {
    if (dry) {
      logSafe.info('[cache-purge] dry-run delete key', { key });
    } else {
      if (offline) {
        throw new Error(
          '--offline may only be used with --dry-run to avoid accidental destructive actions',
        );
      }
      const res = await deleteWithRetries(key);
      if (!res.ok) throw new Error(`Failed to delete key ${key}: ${res.error}`);
      logSafe.info('[cache-purge] deleted key', { key });
      summary.deleted.push(key);
      summary.count = 1;
    }
  } else if (prefix) {
    let list;
    if (offline) {
      logSafe.info(
        '[cache-purge] offline mode: skipping remote list and returning empty candidates',
        { prefix },
      );
      list = [];
    } else {
      list = await listKeysPaged(prefix);
    }
    if (offline && auditFile) {
      try {
        writeFileSync(
          auditFile,
          JSON.stringify({
            offline: true,
            prefix,
            generatedAt: new Date().toISOString(),
          }) + '\n',
        );
        logSafe.info('[cache-purge] created offline audit file', { auditFile });
      } catch (e) {
        logSafe.error('[cache-purge] failed to write offline audit file', {
          auditFile,
          error: e && e.message,
        });
        summary.auditError = e && e.message;
      }
    }
    if (!Array.isArray(list) || list.length === 0) {
      logSafe.info('[cache-purge] no keys with prefix', { prefix });
    } else if (dry) {
      logSafe.info('[cache-purge] dry-run delete prefix', {
        prefix,
        count: list.length,
      });
      list.forEach((k) => logSafe.info('[cache-purge] candidate', { key: k }));
      summary.deleted = list.slice();
      summary.count = list.length;
      if (auditFile) {
        try {
          writeFileSync(auditFile, '');
          for (const name of list) {
            appendFileSync(auditFile, JSON.stringify({ key: name }) + '\n');
          }
          logSafe.info('[cache-purge] wrote audit file', {
            auditFile,
            count: list.length,
          });
        } catch (e) {
          logSafe.error('[cache-purge] failed writing audit file', {
            auditFile,
            error: e && e.message,
          });
          summary.auditError = e && e.message;
        }
      }
    } else {
      if (auditFile) {
        try {
          writeFileSync(auditFile, '');
        } catch (e) {
          logSafe.error('[cache-purge] failed to create audit file', {
            auditFile,
            error: e && e.message,
          });
          summary.auditError = e && e.message;
        }
      }
      const concurrency = (typeof concurrency !== 'undefined' && concurrency) ||
        8;
      // process in chunks to avoid overwhelming wrangler/CF
      const batchSize = concurrency;
      // token-bucket rate limiter (optional)
      let takeToken = async () => {};
      if (ratePerSec && ratePerSec > 0) {
        const rate = Number(ratePerSec);
        let tokens = rate;
        let last = Date.now();
        takeToken = async () => {
          while (true) {
            const now = Date.now();
            const elapsed = (now - last) / 1000;
            last = now;
            tokens = Math.min(rate, tokens + elapsed * rate);
            if (tokens >= 1) {
              tokens -= 1;
              return;
            }
            const waitMs = Math.ceil((1 - tokens) / rate * 1000);
            await sleep(waitMs);
          }
        };
      }
      for (let i = 0; i < list.length; i += batchSize) {
        const batch = list.slice(i, i + batchSize);
        // run deletes in parallel for this batch
        const results = await Promise.all(batch.map(async (name) => {
          if (takeToken) await takeToken();
          return deleteWithRetries(name);
        }));
        for (let j = 0; j < batch.length; j++) {
          const name = batch[j];
          const res = results[j];
          if (!res.ok) {
            logSafe.error('[cache-purge] failed to delete key after retries', {
              key: name,
              error: res.error,
            });
            summary.error = summary.error || '';
            summary.error += `delete ${name}: ${res.error}; `;
            continue;
          }
          logSafe.info('[cache-purge] deleted', { key: name });
          summary.deleted.push(name);
        }
        // optional wait between batches to avoid rate limits
        if (batchWaitMs && i + batchSize < list.length) {
          logSafe.info('[cache-purge] waiting between batches', {
            waitMs: batchWaitMs,
          });
          // eslint-disable-next-line no-await-in-loop
          await sleep(batchWaitMs);
        }
      }
      summary.count = summary.deleted.length;
    }
  }

  // token-bucket rate limiter (optional)
  let takeToken = async () => {};
  if (ratePerSec && ratePerSec > 0) {
    const rate = Number(ratePerSec);
    let tokens = rate;
    let last = Date.now();
    takeToken = async () => {
      while (true) {
        const now = Date.now();
        const elapsed = (now - last) / 1000;
        last = now;
        tokens = Math.min(rate, tokens + elapsed * rate);
        if (tokens >= 1) {
          tokens -= 1;
          return;
        }
        const waitMs = Math.ceil((1 - tokens) / rate * 1000);
        await sleep(waitMs);
      }
    };
  }
} catch (e) {
  summary.error = e.message;
  logSafe.error('[cache-purge] failed', { error: e.message });
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  }
  process.exit(1);
}

if (json) {
  console.log(JSON.stringify(summary, null, 2));
}
