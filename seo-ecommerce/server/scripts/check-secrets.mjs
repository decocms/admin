#!/usr/bin/env node
/**
 * Pre-deploy secrets validator.
 * Fails with exit code 1 if required secrets are missing.
 */
const REQUIRED = [
  'CF_ACCOUNT_ID',
  'CF_API_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVER_TOKEN',
];
const OPTIONAL = [
  'PUBLIC_SUPABASE_URL',
  'PUBLIC_SUPABASE_ANON_KEY',
  'OPENROUTER_API_KEY',
];
let missing = [];
for (const k of REQUIRED) {
  if (!process.env[k] || process.env[k].trim() === '') missing.push(k);
}
if (missing.length) {
  console.error('[secrets] Missing required secrets:', missing.join(', '));
  console.error('Configure in CI (Actions secrets) and in Cloudflare: wrangler secret put <NAME>.');
  process.exit(1);
}
console.log('[secrets] All required secrets present.');
const presentOptional = OPTIONAL.filter(k => !!process.env[k]);
console.log('[secrets] Optional present:', presentOptional.join(', ') || 'none');
