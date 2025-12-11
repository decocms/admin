/**
 * Monitoring Background Worker
 *
 * Bun Worker that runs in a dedicated thread to handle:
 * - PII redaction
 * - Batch accumulation
 * - Periodic flushing to database
 * - Retry logic with exponential backoff
 *
 * This keeps the main request thread completely non-blocking.
 */

import { getEnvironmentData } from "worker_threads";
import { createDatabase } from "../database/index.ts";
import { SqlMonitoringStorage } from "../storage/monitoring.ts";
import type { MonitoringLog } from "../storage/types.ts";
import { RegexRedactor } from "./redactor.ts";
import type {
  MonitoringConfig,
  RawMonitoringEvent,
  WorkerMessage,
  WorkerResponse,
} from "./types.ts";

// ============================================================================
// Worker State
// ============================================================================

class MonitoringWorker {
  private batch: MonitoringLog[] = [];
  private flushTimer: Timer | null = null;
  private storage: SqlMonitoringStorage | null = null;
  private redactor: RegexRedactor;
  private config: MonitoringConfig;
  private retryQueue: MonitoringLog[] = [];
  private isShuttingDown = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.redactor = new RegexRedactor();

    // Initialize storage
    this.initializeStorage();

    // Start flush timer
    this.startFlushTimer();
  }

  private initializeStorage() {
    try {
      const db = createDatabase(this.config.databaseUrl);
      this.storage = new SqlMonitoringStorage(db);
    } catch (error) {
      console.error("Failed to initialize monitoring storage:", error);
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => console.error("Flush timer error:", err));
    }, this.config.flushIntervalMs);
  }

  async handleEvent(event: RawMonitoringEvent): Promise<void> {
    if (this.isShuttingDown) {
      console.warn("Worker is shutting down, dropping event");
      return;
    }

    try {
      // 1. Redact PII from input and output
      const redactedInput = this.redactor.redact(event.input);
      const redactedOutput = this.redactor.redact(event.output);

      // 2. Create monitoring log
      const log: MonitoringLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        organizationId: event.organizationId,
        connectionId: event.connectionId,
        connectionTitle: event.connectionTitle,
        toolName: event.toolName,
        input: redactedInput as Record<string, unknown>,
        output: redactedOutput as Record<string, unknown>,
        isError: event.isError,
        errorMessage: event.errorMessage || null,
        durationMs: event.durationMs,
        timestamp: event.timestamp,
        userId: event.userId || null,
        requestId: event.requestId,
      };

      // 3. Add to batch
      this.batch.push(log);

      // 4. Flush if batch is full
      if (this.batch.length >= this.config.batchSize) {
        await this.flush();
      }
    } catch (error) {
      console.error("Error handling monitoring event:", error);
    }
  }

  async flush(): Promise<void> {
    if (this.batch.length === 0 && this.retryQueue.length === 0) {
      return;
    }

    if (!this.storage) {
      console.warn("Storage not initialized, cannot flush");
      return;
    }

    // Combine batch and retry queue
    const toWrite = [...this.retryQueue, ...this.batch];
    this.batch = [];
    this.retryQueue = [];

    try {
      await this.storage.logBatch(toWrite);
    } catch (error) {
      console.error("Failed to flush monitoring logs:", error);

      // Add to retry queue (limit to prevent memory issues)
      if (this.retryQueue.length < this.config.maxQueueSize) {
        this.retryQueue.push(...toWrite);
      } else {
        console.warn(
          `Retry queue full (${this.retryQueue.length}), dropping ${toWrite.length} events`,
        );
      }

      // Schedule retry with exponential backoff
      setTimeout(() => {
        this.flush().catch((err) => console.error("Retry flush failed:", err));
      }, 5000); // 5 second backoff
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining events
    await this.flush();
  }
}

// ============================================================================
// Worker Initialization & Message Handler
// ============================================================================

// Get config from environment data (set by main thread)
const config = getEnvironmentData("monitoringConfig") as
  | MonitoringConfig
  | undefined;

if (!config) {
  console.error("Monitoring worker: No config found in environment data");
}

// Initialize worker on startup with config from environment
let worker = config ? new MonitoringWorker(config) : null;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case "log": {
        if (!worker) {
          console.warn("Worker not initialized, dropping event");
          return;
        }

        if (message.payload) {
          await worker.handleEvent(message.payload);
        }

        // Send acknowledgment
        self.postMessage({ type: "ack" } as WorkerResponse);
        break;
      }

      case "flush": {
        if (worker) {
          await worker.flush();
        }
        self.postMessage({ type: "flushed" } as WorkerResponse);
        break;
      }

      case "shutdown": {
        if (worker) {
          await worker.shutdown();
          worker = null;
        }
        self.postMessage({ type: "ack" } as WorkerResponse);
        break;
      }

      default:
        console.warn("Unknown message type:", message);
    }
  } catch (error) {
    const err = error as Error;
    console.error("Worker error:", err);
    self.postMessage({
      type: "error",
      error: err.message,
    } as WorkerResponse);
  }
};
