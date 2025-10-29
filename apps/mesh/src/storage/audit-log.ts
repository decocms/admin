/**
 * Audit Log Storage Implementation
 * 
 * Tracks all tool executions for auditing and compliance
 */

import type { Kysely } from 'kysely';
import { nanoid } from 'nanoid';
import type { Database, AuditLog } from './types';

export interface LogAuditParams {
  projectId?: string;
  userId?: string;
  connectionId?: string;
  toolName: string;
  allowed: boolean;
  duration?: number;
  timestamp: Date;
  requestMetadata?: Record<string, any>;
}

export class AuditLogStorage {
  constructor(private db: Kysely<Database>) {}

  async log(params: LogAuditParams): Promise<void> {
    const id = `audit_${nanoid()}`;
    
    await this.db
      .insertInto('audit_logs')
      .values({
        id,
        projectId: params.projectId ?? null,
        userId: params.userId ?? null,
        connectionId: params.connectionId ?? null,
        toolName: params.toolName,
        allowed: params.allowed ? 1 : 0, // SQLite boolean
        duration: params.duration ?? null,
        timestamp: params.timestamp.toISOString(),
        requestMetadata: params.requestMetadata 
          ? JSON.stringify(params.requestMetadata)
          : null,
      })
      .execute();
  }

  async query(filters: {
    projectId?: string;
    userId?: string;
    connectionId?: string;
    toolName?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let query = this.db.selectFrom('audit_logs').selectAll();

    if (filters.projectId) {
      query = query.where('projectId', '=', filters.projectId);
    }
    if (filters.userId) {
      query = query.where('userId', '=', filters.userId);
    }
    if (filters.connectionId) {
      query = query.where('connectionId', '=', filters.connectionId);
    }
    if (filters.toolName) {
      query = query.where('toolName', '=', filters.toolName);
    }
    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate.toISOString() as any);
    }
    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate.toISOString() as any);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    const logs = await query.execute();
    
    return logs.map(log => ({
      ...log,
      allowed: log.allowed === 1, // Convert SQLite boolean
      requestMetadata: log.requestMetadata 
        ? JSON.parse(log.requestMetadata as any)
        : null,
    }));
  }
}

