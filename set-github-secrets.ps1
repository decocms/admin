# Script PowerShell para popular secrets do GitHub Actions
# Requer o GitHub CLI (gh) instalado e autenticado

$repo = "ggstvfer/chat"

# Chaves já conhecidas
$known = @{
  "PUBLIC_SUPABASE_URL" = "https://bekbempccbkuyrvjuygr.supabase.co"
  "PUBLIC_SUPABASE_ANON_KEY" = "sb_publishable_sbXikEupU9bvVBCsjv03pQ_NEem9va7"
}

$secrets = @(
  "PUBLIC_SUPABASE_URL",
  "PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVER_TOKEN",
  "CF_API_TOKEN",
  "CF_ACCOUNT_ID",
  "CF_ZONE_ID",
  "CF_R2_ACCESS_KEY_ID",
  "CF_R2_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "OPENROUTER_API_KEY",
  "WALLET_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "GOOGLE_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CURRENCY_API_KEY",
  "LLMS_ENCRYPTION_KEY",
  "DECO_CHAT_API_JWT_PUBLIC_KEY",
  "DECO_CHAT_API_JWT_PRIVATE_KEY"
)

foreach ($key in $secrets) {
  if ($known.ContainsKey($key)) {
    $value = $known[$key]
    gh secret set $key -b"$value" -R $repo
    Write-Host "Setado automaticamente: $key"
  } else {
    $value = Read-Host "Digite o valor para $key (deixe em branco se não tiver)"
    if ($value -ne "") {
      gh secret set $key -b"$value" -R $repo
    } else {
      Write-Host "Faltando: $key"
    }
  }
}
foreach ($key in $secrets) {
  $value = Read-Host "Digite o valor para $key (deixe em branco se não tiver)"
  if ($value -ne "") {
    gh secret set $key -b"$value" -R $repo
  } else {
    Write-Host "Faltando: $key"
  }
}

Write-Host "Script finalizado. As chaves faltantes estão listadas acima."
