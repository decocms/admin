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
| DECO_CHAT_API_TOKEN | (Optional) Prioritário para LLM Deco |
| DECO_CHAT_API_URL | (Optional) Override base URL da API Deco |
| DECO_CHAT_WORKSPACE | (Optional) Workspace alvo para LLM |
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

### Health Check Script
Run after deploy (expects deployed base URL):
```bash
HEALTH_URL=https://seu-worker.example.workers.dev npm run health
```
CI: fail pipeline if exit code !=0 (degraded ou rate limited / erro de rede).

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
 
### Purge Script
Use:
```bash
npm run seo:cache:purge -- --key "pagespeed:v1:mobile:https://example.com/"  # exact key
npm run seo:cache:purge -- --prefix pagespeed:v1:                                 # by prefix
npm run seo:cache:purge -- --prefix links:v1: --dry-run                           # preview deletions
```

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

## Metrics Endpoint (`/__metrics`)

Exposes in-memory counters (per isolate) for cache + tool performance (não persistente).

Example:
```bash
curl -s https://<your-worker>/__metrics | jq
```
Sample output:
```json
{
	"cache": {
		"lruHits": 120,
		"kvHits": 340,
		"misses": 58,
		"staleServed": 7,
		"revalidationsTriggered": 7,
		"writes": 65,
		"lruSize": 82,
		"lruCap": 200
	},
	"tools": {
		"PAGESPEED": {
			"calls": 10,
			"errors": 1,
			"avgMs": 820.5,
			"p95Ms": 1400,
			"errorRate": 0.1
		},
		"LINK_ANALYZER": {
			"calls": 25,
			"errors": 0,
			"avgMs": 110.2,
			"p95Ms": 180,
			"errorRate": 0
		}
	}
}
```
Cache fields:
- `lruHits`: Atendimentos servidos diretamente do cache em memória (fresco dentro do TTL).
- `kvHits`: Atendimentos obtidos do KV (frescos ou stale) carregados para memória.
- `misses`: Operações que precisaram executar fetch original (primeira escrita ou hard-expired).
- `staleServed`: Respostas servidas dentro da janela stale (SWR) enquanto revalidação ocorre.
- `revalidationsTriggered`: Número de revalidações em background disparadas (corresponde a staleServed quando SWR habilitado).
- `writes`: Quantidade de gravações no KV (miss + revalidate concluída).
- `lruSize`: Tamanho atual do LRU em memória.
- `lruCap`: Capacidade máxima configurada do LRU.

Tool fields (por ferramenta):
- `calls`: Total de execuções (sucesso + erro).
- `errors`: Quantidade que resultou em erro.
- `avgMs`: Latência média (ms) incluindo erros.
- `p95Ms`: Estimativa p95 usando janela deslizante (últimos 100 samples).
- `errorRate`: `errors / calls` (0–1).

Uso rápido de diagnóstico:
1. Alta proporção `misses` / (`lruHits` + `kvHits`) indica possível TTL curto demais ou tráfego cold.
2. `staleServed` crescendo sem aumento proporcional em `revalidationsTriggered` (não deveria acontecer) sugere inspeção.
3. `lruSize` frequentemente próximo de `lruCap` pode justificar aumento de capacidade (ver impacto de memória primeiro).
4. `errorRate` > 0.2 em qualquer ferramenta sugere instabilidade externa ou bug.
5. `p95Ms` subindo enquanto média estável indica outliers (investigar dependências externas / rede).

Inclui também métricas agregadas de LLM quando chave de provedor está presente (prioridade: Deco -> OpenRouter):
Campo `llm` em `/__metrics`:
```jsonc
"llm": {
	"calls": 12,
	"errors": 2,
	"avgMs": 1800.4,
	"p95Ms": 3200,
	"errorRate": 0.1666
}
```
Interpretando LLM:
- `calls`: tentativas de invocar modelo (sucesso + erro)
- `errors`: falhas HTTP / rede / timeout
- `avgMs` / `p95Ms`: latência de round-trip apenas de chamadas LLM
- `errorRate`: estabilidade (alvo < 0.1 ideal)

Alertas rápidos:
- `p95Ms` > 5000ms sugere latência excessiva (possível upstream congestion / throttling)
- `errorRate` > 0.3 por 5+ chamadas → investigar chave / limites de quota

Futuro (planejado): breakdown de categorias de erro (rede, timeout, quota), histogramas Prometheus e tagging de modelo.

## Prometheus Metrics (`/__metrics/prom`)
Formato exposition (text/plain) para scraping Prometheus. Inclui:
- cache_* counters e gauges (hits, misses, stale, writes, lru size/capacity)
- tool_* (calls, errors, avg_latency_ms, p95_latency_ms, error_rate)
- llm_* (calls_total, errors_total, avg_latency_ms, p95_latency_ms, error_rate) – agregadas (sem label de modelo ainda; provedor usado definido pela prioridade)

Exemplo scrape:
```bash
curl -s https://<worker>/__metrics/prom | head
```
Integração Prometheus scrape config (exemplo):
```yaml
scrape_configs:
  - job_name: 'seo-ecommerce-worker'
    metrics_path: /__metrics/prom
    static_configs:
      - targets: ['worker-domain.workers.dev']
```

## Health Endpoint (`/__health`)
Retorna snapshot rápido para monitor/uptime com status HTTP 200 (ok) ou 503 (degraded). Rate limit ~60 req/min por isolate.

Example:
```json
{
  "status": "ok",
  "buildId": "kx8f0l2",
  "uptimeSec": 1234.5,
  "startedAt": 1710000000000,
  "cache": { /* cache metrics */ },
  "tools": { /* tool metrics */ },
  "missingSecrets": [],
  "warnings": [],
  "X-RateLimit-Remaining": 54
}
```
Degradation triggers:
- Segredo obrigatório ausente.
- errorRate > 50% (>=5 chamadas) em alguma ferramenta.
- (Implícito futuro) LLM errorRate alto pode ser sinal, consulte métricas `llm`.

HTTP Codes:
- 200 ok
- 429 rate limited (body {"error":"rate_limited"})
- 503 degraded

Headers:
- `X-RateLimit-Remaining` tokens restantes no minuto corrente.

Uso sugerido: health check externo (Cron, uptime monitor).

## Auth Quickstart
Fluxo implementado (client-side Supabase):

1. Login (`/login`): redireciona para `/analise` se já autenticado.
2. Cadastro (`/signup`): redireciona para `/analise` após criar conta (ou aguarda confirmação e mantém heurística de sessão).
3. Reset senha (`/reset`): envia email via Supabase com redirect para `/login`.
4. Painel protegido (`/analise`): verifica `la-supa-auth` no localStorage; se ausente, mostra gate com link para login preservando `next`.

Storage chaves:
- `la-supa-auth`: objeto de sessão Supabase.
- `la-user`: info mínima (email) para pré-carregar UI.

Guards utilitários (`view/src/lib/authGuard.ts`):
- `isLoggedIn()`
- `requireAuth()`
- `redirectIfLoggedIn()`

Para SSR/API server-side reforçar restrições futuras, adicionar validação do bearer token nas rotas protegidas (`/api/analises`).


