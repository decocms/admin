#!/usr/bin/env node
/**
 * Build Astro view and copy its dist output into server/view-build
 * Ensures wrangler asset directory exists before deploy.
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const viewDir = join(root, '..', 'view');
const serverDir = root;
// Astro Cloudflare adapter already writes directly into server/view-build when run from view with output: "server".
// We only need to ensure that directory exists before wrangler build.
const adapterOutputDir = join(serverDir, 'view-build');
const targetDir = adapterOutputDir; // For clarity

function run(cmd, cwd) {
  execSync(cmd, { stdio: 'inherit', cwd });
}

if (!existsSync(viewDir)) {
  console.error('View directory not found at', viewDir);
  process.exit(1);
}

console.log('[build-assets] Building Astro view (Cloudflare adapter)...');
run('npm run build', viewDir);

if (!existsSync(adapterOutputDir)) {
  console.error('Expected adapter output missing at', adapterOutputDir);
  process.exit(1);
}

console.log('[build-assets] Adapter output present at', adapterOutputDir, '- no copy needed.');

console.log('[build-assets] Done.');
