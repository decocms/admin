# SEO E-commerce Dev & Ops Guide

Guia prático (Windows PowerShell) para rodar, testar e publicar.

## Visão Geral

Componentes:
1. view (Astro + UI)
2. server (Worker + MCP tools: LINK_ANALYZER, PAGESPEED)
3. Scripts PowerShell para automatizar multi‑serviços.

Porta padrão do Worker local: `8787` (configurável).

## Fluxos Principais

| Objetivo | Comando rápido | Descrição |
|----------|----------------|----------|
| Subir tudo (web, api, seo) | `npm run dev:all` (raiz) | Usa concurrently, logs coloridos |
| Subir só SEO (view+worker) | `npm run dev:seo` (raiz) | Foca na auditoria |
| Subir via PowerShell parametrizado | `./dev-all.ps1 -SkipWeb -SkipApi` | Script com flags |
| Smoke test (já em execução) | `npm --prefix seo-ecommerce/server run smoke` | Valida endpoints principais |
| Subir e rodar smoke automático | `npm run seo:smoke` | Start + wait + testes |
| Smoke verboso | `npm run seo:smoke:verbose` | Inclui mais detalhes |
| Deploy SEO (build + worker) | `npm run deploy:seo` | Gera build view e deploy worker |
| Deploy rápido (sem gen) | `npm run deploy:seo:fast` | Usa build existente |
| Parar processos dev (heurístico) | `./stop-dev.ps1` | Encerra wrangler / nodes do SEO |

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
- Tools list contém LINK_ANALYZER e PAGESPEED
- Status 200 em /__env e /api/analisar
- PageSpeed retorna performance/seo >= 0

## Chamadas Diretas (Manual)

```powershell
Invoke-RestMethod -Uri http://localhost:8787/__env
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools -Method Post -ContentType 'application/json' -Body (@{tool='LINK_ANALYZER';input=@{url='https://example.com'}}|ConvertTo-Json)
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools -Method Post -ContentType 'application/json' -Body (@{tool='PAGESPEED';input=@{url='https://example.com';strategy='mobile'}}|ConvertTo-Json)
Invoke-RestMethod -Uri http://localhost:8787/mcp/tools -Method Post -ContentType 'application/json' -Body (@{tool='SEO_AUDIT';input=@{url='https://example.com'}}|ConvertTo-Json)
```

## Página de Auditoria Unificada

Rota: `/auditoria`

O que faz:
- Envia POST para `/mcp/tools` com `{ tool: 'SEO_AUDIT', input: { url } }`
- Mostra scores (performance/SEO mobile & desktop), CWV e alertas heurísticos
- Mantém último resultado em `localStorage` (`seo-audit-last`)

Diferença para `/analise`:
- `/analise` exibe saída pura do LINK_ANALYZER
- `/auditoria` agrega LINK_ANALYZER + PageSpeed (mobile/desktop) + heurísticas

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

- (Em andamento) Melhorar workflow SEO_AUDIT (atual usa single-step tool; considerar paralelizar PageSpeed)
- Tool AI_INSIGHTS (recomendações SEO) + exibição UI
- Página /auditoria consolidando resultados
- Refino supabaseClient e migração de páginas restantes
- Testes unitários (vitest) para normalização do PageSpeed

---
Qualquer dúvida: ver `seo-ecommerce/server/scripts/smoke.mjs` para entender a sequência ou abrir issue interna.
