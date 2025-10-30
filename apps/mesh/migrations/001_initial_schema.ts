/**
 * Initial Database Schema
 * 
 * Creates all tables for MCP Mesh:
 * - users (managed by Better Auth)
 * - projects
 * - connections
 * - roles
 * - api_keys (managed by Better Auth)
 * - audit_logs
 * - OAuth tables (oauth_clients, oauth_authorization_codes, oauth_refresh_tokens)
 * - downstream_tokens
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Users table (Better Auth managed)
  await db.schema
    .createTable('user')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('emailVerified', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('image', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Sessions table (Better Auth managed)
  await db.schema
    .createTable('session')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('userId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('expiresAt', 'text', (col) => col.notNull())
    .addColumn('ipAddress', 'text')
    .addColumn('userAgent', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Account table (Better Auth for OAuth providers)
  await db.schema
    .createTable('account')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('userId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('accountId', 'text', (col) => col.notNull())
    .addColumn('providerId', 'text', (col) => col.notNull())
    .addColumn('accessToken', 'text')
    .addColumn('refreshToken', 'text')
    .addColumn('expiresAt', 'text')
    .addColumn('password', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Verification table (Better Auth for email verification)
  await db.schema
    .createTable('verification')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expiresAt', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Projects table
  await db.schema
    .createTable('projects')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('ownerId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // MCP Connections table
  await db.schema
    .createTable('connections')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('projectId', 'text', (col) => col.references('projects.id').onDelete('cascade'))
    .addColumn('createdById', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('icon', 'text')
    .addColumn('appName', 'text')
    .addColumn('appId', 'text')
    .addColumn('connectionType', 'text', (col) => col.notNull())
    .addColumn('connectionUrl', 'text', (col) => col.notNull())
    .addColumn('connectionToken', 'text')
    .addColumn('connectionHeaders', 'text')
    .addColumn('oauthConfig', 'text')
    .addColumn('metadata', 'text')
    .addColumn('tools', 'text')
    .addColumn('bindings', 'text')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('active'))
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Roles table
  await db.schema
    .createTable('roles')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('projectId', 'text', (col) => col.notNull().references('projects.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('permissions', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // API Keys table (Better Auth managed)
  await db.schema
    .createTable('api_keys')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('userId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('hashedKey', 'text', (col) => col.notNull().unique())
    .addColumn('permissions', 'text', (col) => col.notNull())
    .addColumn('expiresAt', 'text')
    .addColumn('remaining', 'integer')
    .addColumn('metadata', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Audit Logs table
  await db.schema
    .createTable('audit_logs')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('projectId', 'text', (col) => col.references('projects.id').onDelete('cascade'))
    .addColumn('userId', 'text', (col) => col.references('user.id').onDelete('set null'))
    .addColumn('connectionId', 'text', (col) => col.references('connections.id').onDelete('set null'))
    .addColumn('toolName', 'text', (col) => col.notNull())
    .addColumn('allowed', 'integer', (col) => col.notNull())
    .addColumn('duration', 'integer')
    .addColumn('timestamp', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('requestMetadata', 'text')
    .execute();

  // OAuth Clients table
  await db.schema
    .createTable('oauth_clients')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('clientId', 'text', (col) => col.notNull().unique())
    .addColumn('clientSecret', 'text')
    .addColumn('clientName', 'text', (col) => col.notNull())
    .addColumn('redirectUris', 'text', (col) => col.notNull())
    .addColumn('grantTypes', 'text', (col) => col.notNull())
    .addColumn('scope', 'text')
    .addColumn('clientUri', 'text')
    .addColumn('logoUri', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // OAuth Authorization Codes table
  await db.schema
    .createTable('oauth_authorization_codes')
    .addColumn('code', 'text', (col) => col.primaryKey())
    .addColumn('clientId', 'text', (col) => col.notNull().references('oauth_clients.clientId').onDelete('cascade'))
    .addColumn('userId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('redirectUri', 'text', (col) => col.notNull())
    .addColumn('scope', 'text')
    .addColumn('codeChallenge', 'text')
    .addColumn('codeChallengeMethod', 'text')
    .addColumn('expiresAt', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // OAuth Refresh Tokens table
  await db.schema
    .createTable('oauth_refresh_tokens')
    .addColumn('token', 'text', (col) => col.primaryKey())
    .addColumn('clientId', 'text', (col) => col.notNull().references('oauth_clients.clientId').onDelete('cascade'))
    .addColumn('userId', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('scope', 'text')
    .addColumn('expiresAt', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Downstream Tokens table
  await db.schema
    .createTable('downstream_tokens')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('connectionId', 'text', (col) => col.notNull().references('connections.id').onDelete('cascade'))
    .addColumn('userId', 'text', (col) => col.references('user.id').onDelete('cascade'))
    .addColumn('accessToken', 'text', (col) => col.notNull())
    .addColumn('refreshToken', 'text')
    .addColumn('scope', 'text')
    .addColumn('expiresAt', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Create indexes for better query performance
  await db.schema
    .createIndex('idx_connections_projectId')
    .on('connections')
    .column('projectId')
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_projectId')
    .on('audit_logs')
    .column('projectId')
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_userId')
    .on('audit_logs')
    .column('userId')
    .execute();

  await db.schema
    .createIndex('idx_audit_logs_timestamp')
    .on('audit_logs')
    .column('timestamp')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop tables in reverse order (respecting foreign keys)
  await db.schema.dropTable('downstream_tokens').execute();
  await db.schema.dropTable('oauth_refresh_tokens').execute();
  await db.schema.dropTable('oauth_authorization_codes').execute();
  await db.schema.dropTable('oauth_clients').execute();
  await db.schema.dropTable('audit_logs').execute();
  await db.schema.dropTable('api_keys').execute();
  await db.schema.dropTable('roles').execute();
  await db.schema.dropTable('connections').execute();
  await db.schema.dropTable('projects').execute();
  await db.schema.dropTable('verification').execute();
  await db.schema.dropTable('account').execute();
  await db.schema.dropTable('session').execute();
  await db.schema.dropTable('user').execute();
}

