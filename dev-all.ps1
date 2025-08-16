param(
	[int]$Port = 8787,
	[switch]$SkipWeb,
	[switch]$SkipApi,
	[switch]$SkipSeo,
	[switch]$Verbose
)

# Basic dev env defaults (non-sensitive). Override by exporting before running.
if (-not $env:CF_DISPATCH_NAMESPACE) { $env:CF_DISPATCH_NAMESPACE = 'dev-dispatch' }
if (-not $env:TURSO_GROUP_DATABASE_TOKEN) { $env:TURSO_GROUP_DATABASE_TOKEN = 'dev-turso-token' }
if (-not $env:TURSO_ORGANIZATION) { $env:TURSO_ORGANIZATION = 'dev-org' }
if (-not $env:CF_ACCOUNT_ID) { $env:CF_ACCOUNT_ID = 'dev-account' }
if (-not $env:CF_API_TOKEN) { $env:CF_API_TOKEN = 'dev-token' }
if (-not $env:OPENROUTER_API_KEY) { $env:OPENROUTER_API_KEY = 'dev-openrouter' }
if (-not $env:OTEL_EXPORTER_OTLP_ENDPOINT) { $env:OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318' }
if (-not $env:PUBLIC_SUPABASE_URL) { $env:PUBLIC_SUPABASE_URL = 'https://bekbempccbkuyrvjuygr.supabase.co' }
if (-not $env:PUBLIC_SUPABASE_ANON_KEY) { $env:PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_sbXikEupU9bvVBCsjv03pQ_NEem9va7' }
if (-not $env:SUPABASE_URL) { $env:SUPABASE_URL = $env:PUBLIC_SUPABASE_URL }
if (-not $env:SUPABASE_SERVER_TOKEN) { $env:SUPABASE_SERVER_TOKEN = $env:PUBLIC_SUPABASE_ANON_KEY }

Write-Host "[dev-all] Starting services (Port=$Port)" -ForegroundColor Cyan
if ($Verbose) {
	Write-Host "[dev-all] PUBLIC_SUPABASE_URL=$($env:PUBLIC_SUPABASE_URL)" -ForegroundColor DarkCyan
}

if (-not $SkipWeb) {
	Start-Process powershell -ArgumentList 'cd apps/web; npm run dev' | Out-Null
	Write-Host '[dev-all] web started'
}
if (-not $SkipApi) {
	Start-Process powershell -ArgumentList 'cd apps/api; npm run dev' | Out-Null
	Write-Host '[dev-all] api started'
}
if (-not $SkipSeo) {
	Start-Process powershell -ArgumentList "cd seo-ecommerce/view; npm run dev" | Out-Null
	Start-Process powershell -ArgumentList "cd seo-ecommerce/server; wrangler dev --port $Port" | Out-Null
	Write-Host "[dev-all] seo-ecommerce (view + worker @ http://localhost:$Port)" 
}

Write-Host '[dev-all] Done launching. Use Get-Process node to inspect running dev servers.' -ForegroundColor Green
