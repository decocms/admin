#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

// Simple rollback helper
// Usage:
//   node scripts/rollback.mjs                -> rolls back to previous deployment (if any)
//   node scripts/rollback.mjs <version-id>    -> rolls back to specified version id
// Options:
//   --dry-run  : show target version only, no rollback
//   --keep     : do not confirm (non-interactive)

function run(cmd, args, { allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { stdio: ['ignore','pipe','pipe'], encoding: 'utf-8' });
  if (r.status !== 0) {
    if (allowFail) {
      const err = new Error(`Command failed: ${cmd} ${args.join(' ')}\n${r.stderr}`);
      err.code = r.status;
      throw err;
    }
    console.error(`[rollback] Command failed: ${cmd} ${args.join(' ')}\n${r.stderr}`);
    process.exit(1);
  }
  return r.stdout.trim();
}

const argv = process.argv.slice(2);
const dry = argv.includes('--dry-run');
const offline = argv.includes('--offline');
const pick = argv.find(a => !a.startsWith('-'));

let parsed = [];
if (!offline) {
  try {
    // 1. Get deployments list (text) and parse
    const raw = run('npx', ['wrangler','deployments'], { allowFail: true });
    const lines = raw.split(/\n/).filter(l => /\b[0-9a-fA-F-]{36}\b/.test(l));
    parsed = lines.map(l => {
      const match = l.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}T[^\s]+)\s+([0-9a-fA-F-]{36})/);
      return match ? { line:l, date: match[1], id: match[2], active: l.includes('*') } : null;
    }).filter(Boolean);
  } catch (e) {
    console.error('[rollback] Unable to list deployments (auth or network issue).');
    console.error('           Run "npx wrangler login" or retry with --offline and specify a version id.');
    if (!pick) process.exit(1);
  }
}
if (!parsed.length && !pick) {
  console.error('[rollback] No deployments parsed and no explicit version id provided.');
  process.exit(1);
}

let targetId = pick;
if (!targetId) {
  const activeIdx = parsed.findIndex(p => p.active);
  if (activeIdx === -1) {
    console.error('[rollback] Active deployment not identified. Provide version id explicitly.');
    process.exit(1);
  }
  const prev = parsed.slice(activeIdx+1).find(p => true);
  if (!prev) {
    console.error('[rollback] No previous deployment available.');
    process.exit(1);
  }
  targetId = prev.id;
  console.log(`[rollback] Selected previous deployment: ${targetId}`);
}

if (dry) {
  console.log(`[rollback] DRY RUN target version: ${targetId}`);
  process.exit(0);
}

console.log(`[rollback] Rolling back to ${targetId} ...`);
const out = run('npx', ['wrangler','rollback', targetId]);
console.log(out);
console.log('[rollback] Done.');
