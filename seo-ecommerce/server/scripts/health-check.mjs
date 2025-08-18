#!/usr/bin/env node
import { logSafe } from '@deco/workers-runtime/logSafe';

const url = process.env.HEALTH_URL || process.argv[2];
if (!url) {
  console.error('Usage: HEALTH_URL=<url> node scripts/health-check.mjs');
  process.exit(2);
}

async function main() {
  const target = url.replace(/\/$/, '') + '/__health';
  const start = Date.now();
  let res;
  let txt;
  let json;
  try {
    res = await fetch(target, { headers: { 'Accept': 'application/json' } });
    txt = await res.text();
    try {
      json = JSON.parse(txt);
    } catch {}
  } catch (e) {
    console.error('[health] fetch error', e);
    process.exit(1);
  }
  const ms = Date.now() - start;
  const status = res.status;
  const degraded = status !== 200;
  const info = {
    status,
    ms,
    bodyStatus: json?.status,
    warnings: json?.warnings,
    missingSecrets: json?.missingSecrets,
  };
  if (degraded) {
    console.error('[health] degraded', info);
    process.exit(1);
  }
  console.log('[health] ok', info);
}
main();
