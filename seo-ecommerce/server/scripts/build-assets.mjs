#!/usr/bin/env node
/**
 * Build Astro view and copy its dist output into server/view-build
 * Ensures wrangler asset directory exists before deploy.
 */
import { execSync } from 'node:child_process';
import { logSafe } from '@deco/workers-runtime/logSafe';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
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
  logSafe.error('[build-assets] view dir missing', { viewDir });
  process.exit(1);
}

logSafe.info('[build-assets] start build astro view');
run('npm run build', viewDir);

if (!existsSync(adapterOutputDir)) {
  logSafe.error('[build-assets] adapter output missing', { adapterOutputDir });
  process.exit(1);
}

logSafe.info('[build-assets] adapter output present', { adapterOutputDir });

// Write build info file (used for cache bust diagnostics)
try {
  const buildInfo = {
    buildId: Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8),
    builtAt: new Date().toISOString(),
  };
  // Write inside server root (optional) and assets directory (required for ASSETS binding)
  const infoPathRoot = join(serverDir, 'build-info.json');
  const infoPathAssets = join(adapterOutputDir, 'build-info.json');
  writeFileSync(infoPathRoot, JSON.stringify(buildInfo, null, 2));
  writeFileSync(infoPathAssets, JSON.stringify(buildInfo, null, 2));
  logSafe.info('[build-assets] wrote build-info.json', {
    infoPathRoot,
    infoPathAssets,
  });
} catch (e) {
  logSafe.warn('[build-assets] failed write build-info.json', {
    error: e.message,
  });
}

// Adjust _routes.json if present: ensure /_astro assets not excluded
try {
  const routesPath = join(adapterOutputDir, '_routes.json');
  if (existsSync(routesPath)) {
    // Simplest: remove the file entirely so no exclusion blocks hashed assets
    rmSync(routesPath, { force: true });
    logSafe.info('[build-assets] removed _routes.json');
  }
} catch (e) {
  logSafe.warn('[build-assets] adjust _routes.json failed', {
    error: e.message,
  });
}

// No legacy duplication needed (using default _astro directory now)

// Ensure _worker.js is ignored as a static asset to prevent wrangler error
try {
  const ignorePath = join(adapterOutputDir, '.assetsignore');
  let current = '';
  if (existsSync(ignorePath)) {
    current = await (await import('node:fs')).promises.readFile(
      ignorePath,
      'utf8',
    );
  }
  if (!current.split(/\r?\n/).includes('_worker.js')) {
    const next = (current.trim() ? current.trim() + '\n' : '') + '_worker.js\n';
    writeFileSync(ignorePath, next);
    logSafe.info('[build-assets] wrote .assetsignore _worker.js');
  } else {
    logSafe.info('[build-assets] .assetsignore already ok');
  }
} catch (e) {
  logSafe.warn('[build-assets] write .assetsignore failed', {
    error: e.message,
  });
}
logSafe.info('[build-assets] done');
