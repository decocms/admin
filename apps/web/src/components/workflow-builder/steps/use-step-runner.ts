import { callTool, useSDK } from "@deco/sdk";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useCallback, useState } from "react";
import {
  useWorkflowActions,
  useWorkflowFirstStepInput,
  useWorkflowStepDefinition,
  useWorkflowStepOutputs,
  useWorkflowUri,
} from "../../../stores/workflows/hooks.ts";
import { useAgenticChat } from "../../chat/provider.tsx";
import { useResourceRoute } from "../../resources-v2/route-context.tsx";
import { resolveAtRefsInInput, unwrapMCPResponse } from "../utils.ts";

export function useStepRunner(stepName: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { connection } = useResourceRoute();
  const actions = useWorkflowActions();
  const workflowUri = useWorkflowUri();
  const { locator } = useSDK();
  const stepOutputs = useWorkflowStepOutputs();
  const stepDefinition = useWorkflowStepDefinition(stepName);
  const firstStepInput = useWorkflowFirstStepInput();
  const { appendError, clearError } = useAgenticChat();

  const runStep = useCallback(
    async (data: Record<string, unknown>) => {
      if (!connection || !workflowUri) {
        toast.error("Connection is not ready. Please try again in a moment.");
        return;
      }
      if (!stepDefinition) {
        toast.error("Step definition is not available yet.");
        return;
      }

      try {
        setIsSubmitting(true);
        clearError();

        await actions.runStep({
          stepName,
          stepDefinition,
          input: data,
          connection,
          locator,
          workflowUri,
          stepOutputs,
          firstStepInput,
          callTool,
          resolveAtRefsInInput,
          unwrapMCPResponse,
          onError: (error: unknown) => {
            appendError(
              error instanceof Error ? error : new Error(String(error)),
              workflowUri,
              `Workflow: ${workflowUri?.split("/").pop()}`,
            );
            console.error("Step execution error:", error);
          },
        });

        toast.success("Step executed successfully!");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to run step";
        appendError(
          error instanceof Error ? error : new Error(message),
          workflowUri,
          `Workflow: ${workflowUri?.split("/").pop()}`,
        );
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      connection,
      workflowUri,
      stepName,
      stepDefinition,
      locator,
      stepOutputs,
      firstStepInput,
      actions,
      clearError,
      appendError,
    ],
  );

  return { runStep, isSubmitting };
}
