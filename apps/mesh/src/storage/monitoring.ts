/**
 * Monitoring Storage Implementation
 *
 * Handles CRUD operations for monitoring logs using Kysely (database-agnostic).
 * All logs are organization-scoped.
 */

import type { Kysely } from "kysely";
import { nanoid } from "nanoid";
import type { MonitoringStorage } from "./ports";
import type { Database, MonitoringLog } from "./types";

// ============================================================================
// Monitoring Storage Implementation
// ============================================================================

export class SqlMonitoringStorage implements MonitoringStorage {
  constructor(private db: Kysely<Database>) {}

  async log(event: MonitoringLog): Promise<void> {
    await this.logBatch([event]);
  }

  async logBatch(events: MonitoringLog[]): Promise<void> {
    if (events.length === 0) return;

    // Use transaction for atomic batch insert
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto("monitoring_logs")
        .values(events.map((e) => this.toDbRow(e)))
        .execute();
    });
  }

  async query(filters: {
    organizationId?: string;
    connectionId?: string;
    toolName?: string;
    isError?: boolean;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: MonitoringLog[]; total: number }> {
    let query = this.db.selectFrom("monitoring_logs").selectAll();
    let countQuery = this.db
      .selectFrom("monitoring_logs")
      .select((eb) => eb.fn.count("id").as("count"));

    // Apply filters to both queries
    if (filters.organizationId) {
      query = query.where("organization_id", "=", filters.organizationId);
      countQuery = countQuery.where(
        "organization_id",
        "=",
        filters.organizationId,
      );
    }
    if (filters.connectionId) {
      query = query.where("connection_id", "=", filters.connectionId);
      countQuery = countQuery.where("connection_id", "=", filters.connectionId);
    }
    if (filters.toolName) {
      query = query.where("tool_name", "=", filters.toolName);
      countQuery = countQuery.where("tool_name", "=", filters.toolName);
    }
    if (filters.isError !== undefined) {
      query = query.where("is_error", "=", filters.isError ? 1 : 0);
      countQuery = countQuery.where("is_error", "=", filters.isError ? 1 : 0);
    }
    if (filters.startDate) {
      query = query.where(
        "timestamp",
        ">=",
        filters.startDate.toISOString() as never,
      );
      countQuery = countQuery.where(
        "timestamp",
        ">=",
        filters.startDate.toISOString() as never,
      );
    }
    if (filters.endDate) {
      query = query.where(
        "timestamp",
        "<=",
        filters.endDate.toISOString() as never,
      );
      countQuery = countQuery.where(
        "timestamp",
        "<=",
        filters.endDate.toISOString() as never,
      );
    }

    // Order by timestamp descending (most recent first)
    query = query.orderBy("timestamp", "desc");

    // Pagination (only applies to data query, not count)
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    // Execute both queries in parallel
    const [rows, countResult] = await Promise.all([
      query.execute(),
      countQuery.executeTakeFirst(),
    ]);

    const total = Number(countResult?.count || 0);
    const logs = rows.map((row) => this.fromDbRow(row));

    return { logs, total };
  }

  async getStats(filters: {
    organizationId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    totalCalls: number;
    errorRate: number;
    avgDurationMs: number;
    p50DurationMs: number;
    p95DurationMs: number;
    p99DurationMs: number;
  }> {
    let query = this.db
      .selectFrom("monitoring_logs")
      .where("organization_id", "=", filters.organizationId);

    if (filters.startDate) {
      query = query.where(
        "timestamp",
        ">=",
        filters.startDate.toISOString() as never,
      );
    }
    if (filters.endDate) {
      query = query.where(
        "timestamp",
        "<=",
        filters.endDate.toISOString() as never,
      );
    }

    // Get total count and error count
    const stats = await query
      .select([
        (eb) => eb.fn.count("id").as("total_count"),
        (eb) => eb.fn.sum(eb.ref("is_error")).as("error_count"),
        (eb) => eb.fn.avg("duration_ms").as("avg_duration"),
      ])
      .executeTakeFirst();

    // Get percentiles by fetching all durations and calculating in-memory
    // (More efficient approach would use database-specific percentile functions)
    const durations = await query
      .select("duration_ms")
      .orderBy("duration_ms", "asc")
      .execute();

    const totalCalls = Number(stats?.total_count || 0);
    const errorCount = Number(stats?.error_count || 0);
    const avgDurationMs = Number(stats?.avg_duration || 0);

    let p50 = 0;
    let p95 = 0;
    let p99 = 0;

    if (durations.length > 0) {
      p50 = durations[Math.floor(durations.length * 0.5)]?.duration_ms || 0;
      p95 = durations[Math.floor(durations.length * 0.95)]?.duration_ms || 0;
      p99 = durations[Math.floor(durations.length * 0.99)]?.duration_ms || 0;
    }

    return {
      totalCalls,
      errorRate: totalCalls > 0 ? errorCount / totalCalls : 0,
      avgDurationMs,
      p50DurationMs: p50,
      p95DurationMs: p95,
      p99DurationMs: p99,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private toDbRow(log: MonitoringLog) {
    const id = log.id || `log_${nanoid()}`;

    return {
      id,
      organization_id: log.organizationId,
      connection_id: log.connectionId,
      connection_title: log.connectionTitle,
      tool_name: log.toolName,
      input: JSON.stringify(log.input),
      output: JSON.stringify(log.output),
      is_error: log.isError ? 1 : 0,
      error_message: log.errorMessage || null,
      duration_ms: log.durationMs,
      timestamp:
        log.timestamp instanceof Date
          ? log.timestamp.toISOString()
          : log.timestamp,
      user_id: log.userId || null,
      request_id: log.requestId,
    };
  }

  private fromDbRow(row: {
    id: string;
    organization_id: string;
    connection_id: string;
    connection_title: string;
    tool_name: string;
    input: string | Record<string, unknown>;
    output: string | Record<string, unknown>;
    is_error: number;
    error_message: string | null;
    duration_ms: number;
    timestamp: string | Date;
    user_id: string | null;
    request_id: string;
  }): MonitoringLog {
    const input =
      typeof row.input === "string" ? JSON.parse(row.input) : row.input;
    const output =
      typeof row.output === "string" ? JSON.parse(row.output) : row.output;
    const timestamp =
      typeof row.timestamp === "string"
        ? new Date(row.timestamp)
        : row.timestamp;

    return {
      id: row.id,
      organizationId: row.organization_id,
      connectionId: row.connection_id,
      connectionTitle: row.connection_title,
      toolName: row.tool_name,
      input,
      output,
      isError: row.is_error === 1,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      timestamp,
      userId: row.user_id,
      requestId: row.request_id,
    };
  }
}
