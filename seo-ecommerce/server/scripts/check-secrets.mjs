#!/usr/bin/env node
/**
 * Pre-deploy secrets validator.
 * Fails with exit code 1 if required secrets are missing.
 */
// Support synonym groups so workflows using CLOUDFLARE_* also pass.
const GROUPS = [
  {
    label: "CF_ACCOUNT_ID",
    any: ["CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"],
    required: true,
  },
  {
    label: "CF_API_TOKEN",
    any: ["CF_API_TOKEN", "CLOUDFLARE_API_TOKEN"],
    required: true,
  },
  { label: "SUPABASE_URL", any: ["SUPABASE_URL"], required: true },
  {
    label: "SUPABASE_SERVER_TOKEN",
    any: ["SUPABASE_SERVER_TOKEN"],
    required: true,
  },
];
const OPTIONAL = [
  "PUBLIC_SUPABASE_URL",
  "PUBLIC_SUPABASE_ANON_KEY",
  "OPENROUTER_API_KEY",
  "SUPABASE_ANON_KEY",
];

const missing = [];
const resolved = {};
for (const g of GROUPS) {
  const foundKey = g.any.find(
    (k) => process.env[k] && process.env[k].trim() !== "",
  );
  if (!foundKey && g.required) missing.push(g.label);
  else if (foundKey) resolved[g.label] = foundKey;
}
if (missing.length) {
  console.error(
    "[secrets] Missing required secrets (logical names):",
    missing.join(", "),
  );
  console.error(
    "Add them as GitHub Actions secrets and via `wrangler secret put`.",
  );
  process.exit(1);
}
console.log("[secrets] Required OK. Mapping used:");
for (const [logical, actual] of Object.entries(resolved)) {
  console.log(`  ${logical} -> ${actual}`);
}
const presentOptional = OPTIONAL.filter((k) => !!process.env[k]);
const missingOptional = OPTIONAL.filter((k) => !process.env[k]);
console.log(
  "[secrets] Optional present:",
  presentOptional.join(", ") || "none",
);
if (missingOptional.length) {
  console.log(
    "[secrets] Optional missing (features disabled):",
    missingOptional.join(", "),
  );
}
