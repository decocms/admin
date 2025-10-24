import { useCallback, useState } from "react";
import { callTool, useSDK } from "@deco/sdk";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  useWorkflowActions,
  useWorkflowFirstStepInput,
  useWorkflowStepDefinition,
  useWorkflowStepOutputs,
  useWorkflowUri,
} from "../../../stores/workflows/hooks.ts";
import { resolveAtRefsInInput, unwrapMCPResponse } from "../utils.ts";
import { appendRuntimeError, clearRuntimeError } from "../../chat/provider.tsx";
import { useResourceRoute } from "../../resources-v2/route-context.tsx";

export function useStepRunner(stepName: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { connection } = useResourceRoute();
  const actions = useWorkflowActions();
  const workflowUri = useWorkflowUri();
  const { locator } = useSDK();
  const stepOutputs = useWorkflowStepOutputs();
  const stepDefinition = useWorkflowStepDefinition(stepName);
  const firstStepInput = useWorkflowFirstStepInput();

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
        clearRuntimeError();

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
          onError: appendRuntimeError,
        });

        toast.success("Step executed successfully!");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to run step";
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
    ],
  );

  return { runStep, isSubmitting };
}
