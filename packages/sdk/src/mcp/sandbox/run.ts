import { callFunction, inspect } from "@deco/cf-sandbox";
import {
  Runnable,
  WorkflowState,
  WorkflowStep,
} from "../../workflows/workflow-runner.ts";
import { MCPClientStub, ProjectTools } from "../index.ts";
import { asEnv, evalCodeAndReturnDefaultHandle } from "./utils.ts";
import {
  MappingStepDefinition,
  ToolCallStepDefinition,
  WorkflowStepDefinition,
} from "./workflows.ts";

async function runMapping(
  input: unknown,
  state: WorkflowState,
  step: MappingStepDefinition,
  client: MCPClientStub<ProjectTools>,
  runtimeId: string = "default",
): Promise<Rpc.Serializable<unknown>> {
  try {
    // Load and execute the mapping step function
    using stepEvaluation = await evalCodeAndReturnDefaultHandle(
      step.execute,
      runtimeId,
    );
    const {
      ctx: stepCtx,
      defaultHandle: stepDefaultHandle,
      guestConsole: stepConsole,
    } = stepEvaluation;

    // Create step context with WellKnownOptions
    const stepContext = {
      readWorkflowInput() {
        return input;
      },
      readStepResult(stepName: string) {
        if (!state.steps[stepName]) {
          throw new Error(`Step '${stepName}' has not been executed yet`);
        }
        return state.steps[stepName];
      },
      env: await asEnv(client),
    };

    // Call the mapping function
    const stepCallHandle = await callFunction(
      stepCtx,
      stepDefaultHandle,
      undefined,
      stepContext,
      {},
    );

    const result = stepCtx.dump(stepCtx.unwrapResult(stepCallHandle));

    // Log any console output from the step execution
    if (stepConsole.logs.length > 0) {
      console.log(`Mapping step '${step.name}' logs:`, stepConsole.logs);
    }

    return result as Rpc.Serializable<unknown>;
  } catch (error) {
    throw new Error(
      `Mapping step '${step.name}' execution failed: ${inspect(error)}`,
    );
  }
}

async function runTool(
  input: unknown,
  step: ToolCallStepDefinition,
  client: MCPClientStub<ProjectTools>,
): Promise<Rpc.Serializable<unknown>> {
  try {
    // Find the integration connection
    const { items: integrations } = await client.INTEGRATIONS_LIST({});
    const integration = integrations.find(
      (item) => item.id === step.integration,
    );

    if (!integration) {
      throw new Error(`Integration '${step.integration}' not found`);
    }

    // Call the tool with the current input (could be workflow input or previous step result)
    const toolCallResult = await client.INTEGRATIONS_CALL_TOOL({
      connection: integration.connection,
      params: {
        name: step.tool_name,
        arguments: input as Record<string, unknown>,
      },
    });

    if (toolCallResult.isError) {
      throw new Error(`Tool call failed: ${inspect(toolCallResult)}`);
    }

    const result = toolCallResult.structuredContent || toolCallResult.content;
    console.log(`Tool call '${step.tool_name}' completed successfully`);

    return result as Rpc.Serializable<unknown>;
  } catch (error) {
    throw new Error(
      `Tool step '${step.name}' execution failed: ${inspect(error)}`,
    );
  }
}

export const asRunnableStep = (
  step: WorkflowStepDefinition,
  client: MCPClientStub<ProjectTools>,
  runtimeId: string = "default",
): WorkflowStep => {
  let runnable: Runnable | undefined = undefined;
  if (step.type === "mapping") {
    runnable = (input, state) =>
      runMapping(
        input,
        state,
        step.def as MappingStepDefinition,
        client,
        runtimeId,
      );
  } else if (step.type === "tool_call") {
    runnable = (input) =>
      runTool(input, step.def as ToolCallStepDefinition, client);
  }
  if (!runnable) {
    throw new Error(
      `Invalid step type: ${(step as unknown as { type: string }).type}`,
    );
  }
  return {
    name: step.def.name,
    config:
      step.type === "tool_call" && "options" in step.def
        ? (step.def.options ?? {})
        : undefined,
    fn: runnable,
  };
};
