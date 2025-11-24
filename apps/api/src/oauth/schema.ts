const OAUTH_TABLES = {
  clients: `
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      client_id TEXT UNIQUE NOT NULL,
      client_secret TEXT,
      client_name TEXT,
      client_type TEXT NOT NULL CHECK (client_type IN ('public', 'confidential')),
      redirect_uris TEXT NOT NULL,
      grant_types TEXT DEFAULT '["authorization_code"]',
      response_types TEXT DEFAULT '["code"]',
      scope TEXT,
      token_endpoint_auth_method TEXT DEFAULT 'client_secret_basic',
      metadata TEXT,
      disabled INTEGER DEFAULT 0,
      user_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id)",
  ],
};

export async function ensureOAuthTables(
  runSql: (params: { sql: string; params: unknown[] }) => Promise<unknown>,
) {
  await runSql({ sql: OAUTH_TABLES.clients, params: [] });

  for (const indexSql of OAUTH_TABLES.indexes) {
    await runSql({ sql: indexSql, params: [] });
  }
}
