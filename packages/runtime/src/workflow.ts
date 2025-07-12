import { type DefaultEnv, type RequestContext, withBindings } from "./index.ts";
import type { AppContext, CreateMCPServerOptions } from "./mastra.ts";

import { D1Store } from "@mastra/cloudflare-d1";
import { Mastra } from "@mastra/core";
import { RuntimeContext } from "@mastra/core/di";
import { DurableObject } from "./cf-imports.ts";

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
  ctx: RequestContext;
}

export interface CancelWorkflowArgs {
  workflowId: string;
  runId?: string;
  ctx: RequestContext;
}

export interface ResumeWorkflowArgs {
  workflowId: string;
  runId?: string;
  resumeData: unknown;
  stepId: string;
  ctx: RequestContext;
}
export interface WorkflowDO extends Rpc.DurableObjectBranded {
  start: (args: StartWorkflowArgs) => Promise<{ runId: string }>;
  cancel: (args: CancelWorkflowArgs) => Promise<{ cancelled: boolean }>;
  resume: (args: ResumeWorkflowArgs) => Promise<{ resumed: boolean }>;
}

export const Workflow = (workflows?: CreateMCPServerOptions["workflows"]) => {
  return class Workflow extends DurableObject<DefaultEnv>
    implements WorkflowDO {
    constructor(state: DurableObjectState, env: DefaultEnv) {
      super(state, env);
    }

    bindings(ctx: RequestContext) {
      return withBindings<DefaultEnv>(
        this.env,
        ctx,
      );
    }

    workflow(workflowId: string, bindings: DefaultEnv) {
      const bindedWorkflows = workflows?.map((w) => w(bindings)) || [];
      const workflowsMap = Object.fromEntries(
        bindedWorkflows.map((w) => [w.id, w]),
      );
      const d1Storage = new D1Store({
        client: bindings.DECO_CHAT_WORKSPACE_DB,
      });
      const mastra = new Mastra({
        storage: d1Storage,
        workflows: {
          [workflowId]: workflowsMap[workflowId],
        },
        telemetry: {
          enabled: true,
          serviceName: `app-${this.env.DECO_CHAT_SCRIPT_SLUG}`,
        },
      });

      return mastra.getWorkflow(workflowId);
    }

    async start({ workflowId, runId, args, ctx }: StartWorkflowArgs) {
      const bindings = this.bindings(ctx);
      const workflow = this.workflow(workflowId, bindings);

      const run = await workflow.createRunAsync({
        runId: this.ctx.id.name ?? runId,
      });

      this.ctx.waitUntil(
        run.start({
          inputData: args,
          runtimeContext: createRuntimeContext(bindings, this.ctx),
        }),
      );
      return {
        runId: run.runId,
      };
    }

    async cancel({ workflowId, runId, ctx }: CancelWorkflowArgs) {
      const run = await this.workflow(workflowId, this.bindings(ctx))
        .createRunAsync({
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
      ctx,
    }: ResumeWorkflowArgs) {
      const bindings = this.bindings(ctx);
      const run = await this.workflow(workflowId, bindings).createRunAsync({
        runId: this.ctx.id.name ?? runId,
      });

      this.ctx.waitUntil(
        run.resume({
          resumeData,
          step: stepId,
          runtimeContext: createRuntimeContext(bindings, this.ctx),
        }),
      );

      return {
        resumed: true,
      };
    }
  };
};
