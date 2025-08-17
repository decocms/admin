#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const wranglerPath = path.resolve(process.cwd(), 'wrangler.toml');
const toml = fs.readFileSync(wranglerPath, 'utf8');

function fail(msg){
  console.error('\n[verify-config] FAIL:', msg); process.exit(1);
}

// Simple checks
if(!/name\s*=\s*"seo-ecommercex"/.test(toml)){
  fail('Worker name not found or changed.');
}

// KV namespace check
const kvMatch = toml.match(/\[\[kv_namespaces\]\][^[]+/g) || [];
const kvSeo = kvMatch.find(b=>/binding\s*=\s*"SEO_CACHE"/.test(b));
if(!kvSeo) fail('Missing [[kv_namespaces]] block for SEO_CACHE');
if(!/id\s*=\s*"[a-f0-9]{32}"/i.test(kvSeo)) fail('SEO_CACHE id missing or malformed');
if(!/preview_id\s*=\s*"[a-f0-9]{32}"/i.test(kvSeo)) console.warn('[verify-config] WARN: preview_id missing or malformed (ok, but recommended)');

// Placeholder secrets check (basic)
if(toml.includes('<production-id>') || toml.includes('<preview-id>')){
  fail('Placeholders <production-id>/<preview-id> still present');
}

console.log('[verify-config] OK: config validated');
