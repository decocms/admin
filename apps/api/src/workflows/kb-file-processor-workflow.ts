import type {
  Workflow,
  WorkflowEvent,
  WorkflowStep,
} from "@cloudflare/workers-types";
import { type KbFileProcessorMessage, processBatch } from "@deco/sdk/workflows";

const { WorkflowEntrypoint } = await import("cloudflare:workers");

// Environment interface for workflow
interface Env extends Record<string, unknown> {
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVER_TOKEN: string;
  TURSO_ADMIN_TOKEN: string;
  TURSO_ORGANIZATION: string;
  TURSO_GROUP_DATABASE_TOKEN: string;
  VECTOR_BATCH_SIZE?: string;
  // Add other workflow bindings here if needed
  KB_FILE_PROCESSOR: Workflow;
}

/**
 * Cloudflare Workflow for processing knowledge base files
 */
export class KbFileProcessorWorkflow
  extends WorkflowEntrypoint<Env, KbFileProcessorMessage> {
  override async run(
    event: WorkflowEvent<KbFileProcessorMessage>,
    step: WorkflowStep,
  ) {
    const message = event.payload;
    console.log(
      `Workflow processing file: ${message.fileUrl}, batch: ${
        message.batchPage || 0
      }`,
    );

    // Process the current batch
    const result = await step.do("process-batch", async () => {
      return await processBatch(message, this.env);
    });

    // If there are more batches to process, trigger the next workflow instance
    if (result.hasMore) {
      await step.do("trigger-next-batch", async () => {
        const nextMessage: KbFileProcessorMessage = {
          ...message,
          batchPage: result.batchPage,
          totalPages: result.totalPages,
        };

        // Create new workflow instance for the next batch
        await this.env.KB_FILE_PROCESSOR.create({
          params: nextMessage,
        });

        return { triggered: true };
      });
    } else {
      console.log(`Workflow processing completed for: ${message.fileUrl}`);
    }

    return {
      completed: !result.hasMore,
      batchPage: result.batchPage,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
    };
  }
}

export type { KbFileProcessorMessage };
