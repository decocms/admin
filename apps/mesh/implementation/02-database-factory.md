# Task 02: Database Factory (Kysely Connection)

## Overview
Create a database factory that auto-detects the database dialect from `DATABASE_URL` and returns a configured Kysely instance. Supports SQLite (default), PostgreSQL, and MySQL.

## Dependencies
- `01-database-types.md` (needs Database interface)

## Context from Spec

The database factory should:
1. Parse `DATABASE_URL` to detect protocol
2. Create appropriate dialect (SqliteDialect, PostgresDialect, or MysqlDialect)
3. Return a single Kysely<Database> instance
4. Default to SQLite at `file:./data/mesh.db` if no URL provided

**Key principle:** Dialect is specified ONCE at initialization, not in schema files.

## Implementation Steps

### 1. Create database factory file

**Location:** `apps/mesh/src/database/index.ts`

### 2. Import Required Dependencies

```typescript
import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Pool } from 'pg';
import { createPool } from 'mysql2';
import type { Database as DatabaseSchema } from '../storage/types';
```

### 3. Implement createDatabase Function

```typescript
export function createDatabase(databaseUrl?: string): Kysely<DatabaseSchema> {
  const url = databaseUrl || 'file:./data/mesh.db';
  const parsed = new URL(url);
  const protocol = parsed.protocol.replace(':', '');

  switch (protocol) {
    case 'postgres':
    case 'postgresql':
      return createPostgresDatabase(url);
    
    case 'sqlite':
    case 'file':
      return createSqliteDatabase(parsed.pathname);
    
    case 'mysql':
      return createMysqlDatabase(url);
    
    default:
      throw new Error(
        `Unsupported database protocol: ${protocol}. ` +
        `Supported: postgres://, sqlite://, file://, mysql://`
      );
  }
}
```

### 4. Implement Dialect-Specific Creators

```typescript
function createPostgresDatabase(connectionString: string): Kysely<DatabaseSchema> {
  const dialect = new PostgresDialect({
    pool: new Pool({
      connectionString,
      max: 10, // Connection pool size
    }),
  });
  
  return new Kysely<DatabaseSchema>({ dialect });
}

function createSqliteDatabase(dbPath: string): Kysely<DatabaseSchema> {
  // Ensure directory exists
  const dir = dbPath.substring(0, dbPath.lastIndexOf('/'));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  const dialect = new SqliteDialect({
    database: new Database(dbPath),
  });
  
  return new Kysely<DatabaseSchema>({ dialect });
}

function createMysqlDatabase(connectionString: string): Kysely<DatabaseSchema> {
  const dialect = new MysqlDialect({
    pool: createPool({
      uri: connectionString,
      connectionLimit: 10,
    }),
  });
  
  return new Kysely<DatabaseSchema>({ dialect });
}
```

### 5. Export Singleton Instance

```typescript
// Create singleton database instance from environment
export const db = createDatabase(process.env.DATABASE_URL);
```

### 6. Add Utility Functions

```typescript
/**
 * Close database connection
 * Useful for graceful shutdown
 */
export async function closeDatabase(database: Kysely<DatabaseSchema>): Promise<void> {
  await database.destroy();
}

/**
 * Get database dialect name
 */
export function getDatabaseDialect(database: Kysely<DatabaseSchema>): string {
  // Access internal executor to get dialect
  return (database as any).executor.adapter.dialect;
}
```

## File Locations

```
apps/mesh/src/
  database/
    index.ts         # Database factory
```

## Testing

Create `apps/mesh/src/database/index.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabase, closeDatabase } from './index';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Database Factory', () => {
  let tempDir: string;
  
  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mesh-test-'));
  });
  
  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });
  
  it('should create SQLite database from file:// URL', async () => {
    const dbPath = join(tempDir, 'test-file.db');
    const db = createDatabase(`file:${dbPath}`);
    
    expect(db).toBeDefined();
    
    // Test simple query
    const result = await db.selectFrom('projects' as any)
      .selectAll()
      .execute();
    
    expect(Array.isArray(result)).toBe(true);
    
    await closeDatabase(db);
  });
  
  it('should create SQLite database from sqlite:// URL', async () => {
    const dbPath = join(tempDir, 'test-sqlite.db');
    const db = createDatabase(`sqlite://${dbPath}`);
    
    expect(db).toBeDefined();
    await closeDatabase(db);
  });
  
  it('should default to SQLite when no URL provided', () => {
    const db = createDatabase();
    expect(db).toBeDefined();
  });
  
  it('should throw error for unsupported protocol', () => {
    expect(() => createDatabase('redis://localhost')).toThrow(
      'Unsupported database protocol: redis'
    );
  });
  
  it('should create directory if not exists', async () => {
    const dbPath = join(tempDir, 'nested', 'dir', 'test.db');
    const db = createDatabase(`file:${dbPath}`);
    
    expect(db).toBeDefined();
    await closeDatabase(db);
  });
});
```

Run: `bun test apps/mesh/src/database/index.test.ts`

## Environment Variables

```bash
# SQLite (default)
# No DATABASE_URL needed - defaults to ./data/mesh.db

# PostgreSQL
DATABASE_URL=postgresql://user:pass@localhost:5432/mcp_mesh

# MySQL
DATABASE_URL=mysql://user:pass@localhost:3306/mcp_mesh
```

## Validation

- [ ] SQLite database created with file:// protocol
- [ ] SQLite database created with sqlite:// protocol
- [ ] Defaults to SQLite when DATABASE_URL not set
- [ ] Directory created automatically for SQLite
- [ ] Throws error for unsupported protocols
- [ ] Returns Kysely<Database> with correct typing
- [ ] Tests pass

## Reference

See spec section: **Database Initialization with Kysely** (lines 2683-2741)

