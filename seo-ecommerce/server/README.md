# SEO E-commerce Deployment Guide

This document summarizes the production deployment steps for the Worker + Astro view.

## Overview
- Astro static site builds in `seo-ecommerce/view/dist`.
- Built assets copied (or referenced) as `view-build` for the Worker in `seo-ecommerce/server`.
- Cloudflare Worker (Wrangler) deploys the server + serves static assets via `[assets]` section.

## Prerequisites
1. Cloudflare Account + Worker namespace with proper permissions.
2. Wrangler configured (API Token with `Account.Workers Scripts:Edit`, `Account.Workers Scripts:Read`, `Account.Workers KV:Edit` if needed).
3. Production secrets/vars (see table below).
4. Supabase project (URL + anon + service keys).

## Required Environment Vars (Wrangler `vars` or Secrets)
| Key | Purpose |
|-----|---------|
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Public anon key (exposed to client if injected) |
| SUPABASE_SERVER_TOKEN | Service role (server side only secret) |
| OPENROUTER_API_KEY | (Optional) AI features |
| PUBLIC_API_URL | (Optional) Override API base for client analyzer |

Use `wrangler secret put SUPABASE_SERVER_TOKEN` for secrets; non‑sensitive public values can remain in `[vars]`.

## Build & Deploy Flow (Manual)
```sh
# From repo root
npm install
npm run deploy:seo
```
This runs:
1. `seo-ecommerce/view`: `astro build` -> outputs `dist/`
2. Copies/uses assets via `view-build` directory (ensure sync) – script implicitly expects `view-build` to exist (created by dev or manually).
3. `seo-ecommerce/server`: `deco gen` then `wrangler build` and `deco deploy`.

If `view-build` is empty, copy the dist output manually:
```sh
cp -r seo-ecommerce/view/dist/* seo-ecommerce/server/view-build/
```
(Windows PowerShell)
```powershell
Copy-Item -Recurse -Force seo-ecommerce/view/dist/* seo-ecommerce/server/view-build/
```

## CI Recommendation
Add workflow that on tag `seo-v*`:
1. Checks out code.
2. Installs deps.
3. Runs tests + lint + build view.
4. Copies assets to `view-build`.
5. Runs `npm run deploy:seo`.

## Health Check After Deploy
1. `POST /mcp/tools` body: `{ "tool":"LINK_ANALYZER", "input": { "url": "https://example.com/" } }` expect 200 + JSON with `seoScore`.
2. Visit landing page: https://seo-ecommercex.deco.page/ (score summary card loads, form works).

## Rollback
Deploy previous Git SHA with same pipeline or use Cloudflare Worker Versions UI to revert.

## Notes
- Keep build artifacts out of git; rely on pipeline build.
- Add caching headers in Worker if necessary for static assets (currently served via `[assets]` binding defaults).
- For client env injection, ensure `PUBLIC_SUPABASE_*` env names are mapped if used on front.

## Cache Layer (Phase 2)

PageSpeed and Link Analyzer use a persistent + in-memory cache:

- Persistent: Cloudflare KV binding `SEO_CACHE` (configure in `wrangler.toml`).
- In-memory: per-isolate LRU (200 entries) for hot responses.
- Strategy: Stale-While-Revalidate (serve within stale window and refresh in background).

TTL Defaults
- PageSpeed: fresh 6h; stale additional 12h (18h total); hard expiry 48h.
- Link Analyzer: fresh 30m; stale up to 4h; hard expiry 24h.

Cache Keys (normalized, tracking params removed & sorted)
- PageSpeed: `pagespeed:v1:<strategy>:<origin><path>?<query>`
- Link Analyzer: `links:v1:<origin><path>?<query>`

Tracking params stripped: `utm_*`, `gclid`, `fbclid`, `yclid`, `_hs*`, `mc_*`, `sc_*`.

### Invalidation / Bypass
- (Planned) CLI purge script by key prefix.
- Future `noCache` context flag to skip storing/reading.

## Pure Runners

Deterministic pure functions enable fast unit tests without Worker runtime:
- `runSeoAuditPure` – aggregates PageSpeed + link analysis.
- `normalizePageSpeed` – extracts key metrics.
- `parseHtml` – HTML parsing & extraction.

### Adding a Cached Tool
1. Implement pure fetch/normalize logic.
2. Build deterministic key (URL normalization + option hash if needed).
3. Wrap with `getOrSet` specifying `ttlSeconds` / `staleTtlSeconds`.
4. Return `{ ...data, cache, stale }`.
5. Add tests: key stability, cache hit, stale serve path.

### Safety
If KV fails, system falls back to direct fetch; stale entries only used inside configured windows.


