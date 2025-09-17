import { callFunction, inspect } from "@deco/cf-sandbox";
import { WorkflowState } from "../../workflows/workflow-runner.ts";
import { MCPClientStub, ProjectTools } from "../index.ts";
import { asEnv, evalCodeAndReturnDefaultHandle } from "./utils.ts";
import {
  CodeStepDefinition,
  ToolCallStepDefinition,
} from "../workflows/api.ts";

export async function runCode(
  workflowInput: unknown,
  state: WorkflowState,
  step: CodeStepDefinition,
  client: MCPClientStub<ProjectTools>,
  runtimeId: string = "default",
): Promise<Rpc.Serializable<unknown>> {
  // Load and execute the code step function
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
    sleep: async (name: string, duration: number) => {
      await state.sleep(name, duration);
    },
    sleepUntil: async (name: string, date: Date | number) => {
      await state.sleepUntil(name, date);
    },
    readWorkflowInput() {
      return workflowInput;
    },
    readStepResult(stepName: string) {
      if (!state.steps[stepName]) {
        throw new Error(`Step '${stepName}' has not been executed yet`);
      }
      return state.steps[stepName];
    },
    env: await asEnv(client),
  };

  // Call the function
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
    console.log(`Code step '${step.name}' logs:`, stepConsole.logs);
  }

  return result as Rpc.Serializable<unknown>;
}

export async function runTool(
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

    if (toolCallResult.isError || toolCallResult.error) {
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
