import { type DefaultEnv, withBindings } from "./index.ts";
import type { AppContext, CreateMCPServerOptions } from "./mastra.ts";

import { D1Store } from "@mastra/cloudflare-d1";
import { Mastra } from "@mastra/core";
import { RuntimeContext } from "@mastra/core/di";
import { DurableObject } from "./cf-imports.ts";
import { OTLPStorageExporter } from "@mastra/core";

const createRuntimeContext = (env: DefaultEnv, ctx: DurableObjectState) => {
  const runtimeContext = new RuntimeContext<AppContext>();
  runtimeContext.set("env", env);
  runtimeContext.set("ctx", ctx);
  return runtimeContext;
};
export interface StartWorkflowArgs {
  workflowId: string;
  args: unknown;
  runId?: string;
}

export interface CancelWorkflowArgs {
  workflowId: string;
  runId?: string;
}

export interface ResumeWorkflowArgs {
  workflowId: string;
  runId?: string;
  resumeData: unknown;
  stepId: string;
}
export interface WorkflowDO extends Rpc.DurableObjectBranded {
  start: (args: StartWorkflowArgs) => Promise<{ runId: string }>;
  cancel: (args: CancelWorkflowArgs) => Promise<{ cancelled: boolean }>;
  resume: (args: ResumeWorkflowArgs) => Promise<{ resumed: boolean }>;
}

export const Workflow = (workflows?: CreateMCPServerOptions["workflows"]) => {
  return class Workflow extends DurableObject<DefaultEnv>
    implements WorkflowDO {
    protected bindings: DefaultEnv;
    protected workflows: Record<
      string,
      ReturnType<NonNullable<CreateMCPServerOptions["workflows"]>[number]>
    >;
    constructor(state: DurableObjectState, env: DefaultEnv) {
      super(state, env);
      this.bindings = withBindings<DefaultEnv>(
        env,
      );
      const bindedWorkflows = workflows?.map((w) => w(this.bindings)) || [];
      this.workflows = Object.fromEntries(
        bindedWorkflows.map((w) => [w.id, w]),
      );
    }

    workflow(workflowId: string) {
      const d1Storage = new D1Store({
        client: this.bindings.DECO_CHAT_WORKSPACE_DB,
      });
      const mastra = new Mastra({
        storage: d1Storage,
        workflows: {
          [workflowId]: this.workflows[workflowId],
        },
        telemetry: {
          enabled: true,
          serviceName: `app-${this.env.DECO_CHAT_SCRIPT_SLUG}`,
          export: {
            exporter: new OTLPStorageExporter({
              storage: d1Storage,
              logger: {
                ...console,
                trackException: () => {},
                getTransports: () => new Map(),
                getLogs: () =>
                  Promise.resolve({
                    logs: [],
                    total: 0,
                    page: 0,
                    perPage: 0,
                    hasMore: false,
                  }),
                getLogsByRunId: () =>
                  Promise.resolve({
                    logs: [],
                    total: 0,
                    page: 0,
                    perPage: 0,
                    hasMore: false,
                  }),
              },
            }),
            type: "custom",
          },
        },
      });

      return mastra.getWorkflow(workflowId);
    }

    async start({ workflowId, runId, args }: StartWorkflowArgs) {
      const workflow = this.workflow(workflowId);

      const run = await workflow.createRunAsync({
        runId: this.ctx.id.name ?? runId,
      });

      this.ctx.waitUntil(
        run.start({
          inputData: args,
          runtimeContext: createRuntimeContext(this.bindings, this.ctx),
        }),
      );
      return {
        runId: run.runId,
      };
    }

    async cancel({ workflowId, runId }: CancelWorkflowArgs) {
      const run = await this.workflow(workflowId).createRunAsync({
        runId: this.ctx.id.name ?? runId,
      });

      this.ctx.waitUntil(run.cancel());

      return {
        cancelled: true,
      };
    }
    async resume({
      workflowId,
      runId,
      resumeData,
      stepId,
    }: ResumeWorkflowArgs) {
      const run = await this.workflow(workflowId).createRunAsync({
        runId: this.ctx.id.name ?? runId,
      });

      this.ctx.waitUntil(
        run.resume({
          resumeData,
          step: stepId,
          runtimeContext: createRuntimeContext(this.bindings, this.ctx),
        }),
      );

      return {
        resumed: true,
      };
    }
  };
};
