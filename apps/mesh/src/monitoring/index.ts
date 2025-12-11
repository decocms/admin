/**
 * Monitoring Service
 *
 * Main thread service that manages the background worker for monitoring.
 * Provides a simple API for logging tool calls without blocking requests.
 */

import { setEnvironmentData } from "worker_threads";
import type {
  MonitoringConfig,
  RawMonitoringEvent,
  WorkerMessage,
} from "./types.ts";
import { getDatabaseUrl } from "../database/index.ts";

// ============================================================================
// Monitoring Service
// ============================================================================

export class MonitoringService {
  private worker: Worker | null = null;
  private queueDepth = 0;
  private readonly MAX_QUEUE_DEPTH = 10000;
  private enabled = true;
  private config: MonitoringConfig;

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      batchSize: config?.batchSize ?? 250,
      flushIntervalMs: config?.flushIntervalMs ?? 300,
      maxQueueSize: config?.maxQueueSize ?? 10000,
      databaseUrl: config?.databaseUrl ?? getDatabaseUrl(),
      redactor: config?.redactor ?? "regex",
    };

    this.enabled = this.config.enabled;
    if (this.enabled) {
      this.startWorker();
    }
  }

  private startWorker() {
    try {
      // Check if Worker is available
      if (typeof Worker === "undefined") {
        console.warn("Worker API is not available, monitoring disabled");
        this.enabled = false;
        return;
      }

      // Share config with worker using environment data (Bun feature)
      setEnvironmentData("monitoringConfig", this.config);

      // Create worker from worker.ts file
      // Bun resolves worker paths relative to project root (where bun is executed)
      const workerPath = import.meta.dir + "/worker.ts";
      this.worker = new Worker(workerPath);

      // Handle worker messages
      this.worker.onmessage = (event: MessageEvent) => {
        const response = event.data;

        if (response.type === "ack" || response.type === "flushed") {
          this.queueDepth = Math.max(0, this.queueDepth - 1);
        } else if (response.type === "error") {
          console.error("Worker error:", response.error);
          this.queueDepth = Math.max(0, this.queueDepth - 1);
        }
      };

      // Handle worker errors
      this.worker.onerror = (error: ErrorEvent) => {
        console.error("Worker error:", error);
      };

      // Listen for worker open event (Bun-specific)
      this.worker.addEventListener("open", () => {
        console.log("Monitoring worker started successfully");
      });
    } catch (error) {
      console.error("Failed to start monitoring worker:", error);
      console.warn("Monitoring will be disabled");
      this.enabled = false;
    }
  }

  /**
   * Log a tool call event (non-blocking)
   */
  async log(event: RawMonitoringEvent): Promise<void> {
    if (!this.enabled || !this.worker) {
      return;
    }

    // Check backpressure
    if (this.queueDepth > this.MAX_QUEUE_DEPTH) {
      console.warn(
        `Monitoring queue full (${this.queueDepth}), dropping event`,
      );
      return;
    }

    try {
      // Non-blocking post to worker
      this.worker.postMessage({
        type: "log",
        payload: event,
      } as WorkerMessage);

      this.queueDepth++;
    } catch (error) {
      console.error("Failed to post monitoring event:", error);
    }
  }

  /**
   * Force flush pending events
   */
  async flush(): Promise<void> {
    if (!this.worker) {
      return;
    }

    return new Promise((resolve) => {
      const worker = this.worker;
      if (!worker) {
        resolve();
        return;
      }

      const handler = (event: Event) => {
        const messageEvent = event as MessageEvent;
        if (messageEvent.data.type === "flushed") {
          worker.removeEventListener("message", handler);
          resolve();
        }
      };

      worker.addEventListener("message", handler);
      worker.postMessage({ type: "flush" } as WorkerMessage);

      // Timeout after 5 seconds
      setTimeout(() => {
        worker.removeEventListener("message", handler);
        resolve();
      }, 5000);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (!this.worker) {
      return;
    }

    try {
      // Send shutdown message
      this.worker.postMessage({ type: "shutdown" } as WorkerMessage);

      // Wait a bit for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Terminate worker
      await this.worker.terminate();
      this.worker = null;
    } catch (error) {
      console.error("Error during monitoring shutdown:", error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let monitoringServiceInstance: MonitoringService | null = null;

/**
 * Get or create the monitoring service singleton
 */
export function getMonitoringService(
  config?: Partial<MonitoringConfig>,
): MonitoringService {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new MonitoringService(config);
  }
  return monitoringServiceInstance;
}

/**
 * Export default instance for convenience
 * Lazily initialized on first access
 */
let _monitoringService: MonitoringService | null = null;
export const monitoringService = {
  log: async (event: RawMonitoringEvent) => {
    if (!_monitoringService) {
      _monitoringService = getMonitoringService();
    }
    return _monitoringService.log(event);
  },
  flush: async () => {
    if (_monitoringService) {
      return _monitoringService.flush();
    }
  },
  shutdown: async () => {
    if (_monitoringService) {
      return _monitoringService.shutdown();
    }
  },
};
