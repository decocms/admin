Title: feat(cache-purge): audit file, concurrency, batch wait, retries & rate
limiter

Summary

- Adds robust `seo-ecommerce/server/scripts/cache-purge.mjs` features:
  - `--audit-file <path>`: writes ndjson audit list
  - `--concurrency <n>`: parallel deletes per batch (default 8)
  - `--batch-wait-ms <ms>`: wait between batches
  - `--rate-per-sec <n>`: token-bucket rate limiter
  - retries with exponential backoff for transient errors
  - better parsing / pagination of `wrangler kv key list`
- Updates GitHub Actions `SEO Maintenance` workflow to accept new inputs and
  upload audit file as an artifact.
- Adds a vitest offline test ensuring audit file is created in dry-run offline.
- Updates server README with usage examples.

Checklist

- [x] Script supports dry-run, offline, JSON output
- [x] Audit file writing (ndjson)
- [x] Concurrency, batch wait, rate limiter flags
- [x] Retry/backoff for deletes
- [x] Workflow input passthrough and artifact upload
- [x] Tests + README updated

How to test

1. Run
   `node seo-ecommerce/server/scripts/cache-purge.mjs --prefix test: --dry-run --offline --audit-file /tmp/audit.ndjson --json`
2. Confirm `/tmp/audit.ndjson` exists and contains a JSON line with
   `offline:true`.
3. Run `npm --workspace=seo-ecommerce/server test` to run vitest suite.

Notes

- The PR does not change production behavior unless `audit_file` or rate flags
  are used.
- Please review workflow secrets usage in `seo-maintenance.yml`.
