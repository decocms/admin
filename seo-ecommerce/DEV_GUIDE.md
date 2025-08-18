# SEO E-commerce Dev & Ops Guide

Guia prático (Windows PowerShell) para rodar, testar e publicar.

## Visão Geral

Componentes:

1. view (Astro + UI)
2. server (Worker + MCP tools: LINK_ANALYZER, PAGESPEED)
3. Scripts PowerShell para automatizar multi‑serviços.

Porta padrão do Worker local: `8787` (configurável).

## Fluxos Principais

| Objetivo                           | Comando rápido                                | Descrição                        |
| ---------------------------------- | --------------------------------------------- | -------------------------------- |
| Subir tudo (web, api, seo)         | `npm run dev:all` (raiz)                      | Usa concurrently, logs coloridos |
| Subir só SEO (view+worker)         | `npm run dev:seo` (raiz)                      | Foca na auditoria                |
| Subir via PowerShell parametrizado | `./dev-all.ps1 -SkipWeb -SkipApi`             | Script com flags                 |
| Smoke test (já em execução)        | `npm --prefix seo-ecommerce/server run smoke` | Valida endpoints principais      |
| Subir e rodar smoke automático     | `npm run seo:smoke`                           | Start + wait + testes            |
| Smoke verboso                      | `npm run seo:smoke:verbose`                   | Inclui mais detalhes             |
| Deploy SEO (build + worker)        | `npm run deploy:seo`                          | Gera build view e deploy worker  |
| Deploy rápido (sem gen)            | `npm run deploy:seo:fast`                     | Usa build existente              |
| Parar processos dev (heurístico)   | `./stop-dev.ps1`                              | Encerra wrangler / nodes do SEO  |

## Passos Iniciais (Primeira Vez)

```powershell
cd seo-ecommerce
npm install
cd server; npm install; cd ..\view; npm install; cd ..\..
```

## Rodando Desenvolvimento SEO

Opção simples (raiz):

```powershell
npm run dev:seo
```

Opção parametrizada (PowerShell):

```powershell
./dev-all.ps1 -SkipWeb -SkipApi -Port 8787 -Verbose
```

## Teste de Fumaça (Smoke)

Com serviços já rodando:

```powershell
npm --prefix seo-ecommerce/server run smoke
```

Subir e testar num passo:

```powershell
npm run seo:smoke
```

Verboso:

```powershell
npm run seo:smoke:verbose
```

Saída esperada inclui:

- Tools list contém LINK_ANALYZER, PAGESPEED, SEO_AUDIT, AI_INSIGHTS
- Status 200 em /__env e /api/analisar
- PageSpeed retorna performance/seo >= 0

## Chamadas Diretas (Manual)

```powershell
Invoke-RestMethod -Uri http://localhost:8787/__env
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools -Method Post -ContentType 'application/json' -Body (@{tool='LINK_ANALYZER';input=@{url='https://example.com'}}|ConvertTo-Json)
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools -Method Post -ContentType 'application/json' -Body (@{tool='PAGESPEED';input=@{url='https://example.com';strategy='mobile'}}|ConvertTo-Json)
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools -Method Post -ContentType 'application/json' -Body (@{tool='SEO_AUDIT';input=@{url='https://example.com'}}|ConvertTo-Json)
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools -Method Post -ContentType 'application/json' -Body (@{tool='AI_INSIGHTS';input=@{url='https://example.com'}}|ConvertTo-Json)
```

## Página de Auditoria Unificada + Insights

Rota: `/auditoria`

O que faz:

- POST para `/mcp/tools` com `{ tool: 'SEO_AUDIT', input: { url } }`
- Mostra scores (performance/SEO mobile & desktop), Core Web Vitals e alertas
  heurísticos
- Dispara também `{ tool: 'AI_INSIGHTS' }` (usa auditoria como contexto) e exibe
  recomendações
- Mantém último resultado em `localStorage` (`seo-audit-last`)

Diferença para `/analise`:

- `/analise` exibe saída crua do LINK_ANALYZER
- `/auditoria` agrega LINK_ANALYZER + PageSpeed (mobile/desktop) + heurísticas
- Acrescenta recomendações AI (LLM se `OPENROUTER_API_KEY` presente; senão
  heurísticas)

## Deploy

Normal:

```powershell
npm run deploy:seo
```

Rápido (usa dist existente da view):

```powershell
npm run deploy:seo:fast
```

Domínio custom (se configurado):

```powershell
npm run deploy:seo:domain
```

## Parar / Limpar

Heurístico (encerra wrangler + node relacionados ao SEO):

```powershell
./stop-dev.ps1
```

Se precisar matar porta ocupada manualmente:

```powershell
Get-NetTCPConnection -LocalPort 8787 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Personalização de Porta

Ao iniciar com script PowerShell:

```powershell
./dev-all.ps1 -Port 8799
$env:BASE_URL='http://localhost:8799'; npm --prefix seo-ecommerce/server run smoke
```

## Próximos Passos (Pendentes)

- Paralelizar chamadas PageSpeed dentro da auditoria
- Workflow SEO_AUDIT multi-step formal (telemetria, retries)
- Testes vitest: heurísticas AI_INSIGHTS & normalização PageSpeed
- Sanitização extra logs /mcp/tools (remover tokens eventuals)
- Cache persistente (KV/R2) opcional para PageSpeed (reduzir quota)

## Secrets de Produção

Requisitos obrigatórios para deploy (checados por `scripts/check-secrets.mjs` e
em runtime `/mcp` / `/api`):

| Variável              | Uso                                                                   |
| --------------------- | --------------------------------------------------------------------- |
| CF_ACCOUNT_ID         | Deploy Cloudflare Workers                                             |
| CF_API_TOKEN          | Auth API para publicar Worker (escopos: Workers Scripts, KV se usado) |
| SUPABASE_URL          | URL base do projeto Supabase (server)                                 |
| SUPABASE_SERVER_TOKEN | Service role key (NÃO expor publicamente)                             |

Sinônimos aceitos (qualquer um do par):

| Lógico        | Aceitos                                |
| ------------- | -------------------------------------- |
| CF_API_TOKEN  | CF_API_TOKEN ou CLOUDFLARE_API_TOKEN   |
| CF_ACCOUNT_ID | CF_ACCOUNT_ID ou CLOUDFLARE_ACCOUNT_ID |

Opcionais (habilitam recursos extras):

| Variável                 | Uso                                           |
| ------------------------ | --------------------------------------------- |
| PUBLIC_SUPABASE_URL      | Client-side init (fallback /__env se ausente) |
| PUBLIC_SUPABASE_ANON_KEY | Client-side anon auth                         |
| OPENROUTER_API_KEY       | Geração de insights via LLM (AI_INSIGHTS)     |

Pré-deploy (CI) recomendado:

```powershell
node seo-ecommerce/server/scripts/check-secrets.mjs
```

Ou usar o script:

```powershell
npm --prefix seo-ecommerce/server run deploy:checked
```

---

Qualquer dúvida: ver `seo-ecommerce/server/scripts/smoke.mjs` para entender a
sequência ou abrir issue interna.
