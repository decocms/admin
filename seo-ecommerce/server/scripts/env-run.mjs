#!/usr/bin/env node
// Minimal dotenv runner for local workflows. Loads .env.local (if present)
// and runs the given command with those variables in the environment.
// Usage: node scripts/env-run.mjs -- npm run deploy:deco:force

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, '.env.local');

function parseEnv(content) {
  const out = {};
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  return parseEnv(content);
}

function main() {
  const idx = process.argv.indexOf('--');
  if (idx === -1 || idx === process.argv.length - 1) {
    console.error('Usage: node scripts/env-run.mjs -- <command> [args...]');
    process.exit(1);
  }
  const cmd = process.argv[idx + 1];
  const args = process.argv.slice(idx + 2);
  const envFromFile = loadEnv();
  const env = { ...process.env, ...envFromFile };

  const child = spawn(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => {
    console.error('Failed to run', cmd, args.join(' '), err);
    process.exit(1);
  });
}

main();
