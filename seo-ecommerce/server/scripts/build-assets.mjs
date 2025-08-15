#!/usr/bin/env node
/**
 * Build Astro view and copy its dist output into server/view-build
 * Ensures wrangler asset directory exists before deploy.
 */
import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
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

// Write build info file (used for cache bust diagnostics)
try {
  const infoPath = join(serverDir, 'build-info.json');
  const buildInfo = {
    buildId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    builtAt: new Date().toISOString(),
  };
  writeFileSync(infoPath, JSON.stringify(buildInfo, null, 2));
  console.log('[build-assets] Wrote build-info.json');
} catch (e) {
  console.warn('[build-assets] Failed to write build-info.json', e);
}

// Adjust _routes.json if present: ensure /_astro assets not excluded
try {
  const routesPath = join(adapterOutputDir, '_routes.json');
  if (existsSync(routesPath)) {
  // Simplest: remove the file entirely so no exclusion blocks hashed assets
  rmSync(routesPath, { force: true });
  console.log('[build-assets] Removed _routes.json to allow all static assets');
  }
} catch (e) {
  console.warn('[build-assets] Could not adjust _routes.json', e);
}

console.log('[build-assets] Done.');
