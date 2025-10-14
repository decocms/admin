/**
 * useGenerateStep - Generate workflow step using AI
 * Uses runtime.ts for execution
 */

import { client } from "@/lib/rpc";
import { useMutation } from "@tanstack/react-query";

type GenerateStepInput = Parameters<typeof client.GENERATE_STEP>[0];
type GenerateStepOutput = ReturnType<typeof client.GENERATE_STEP>;

export function useGenerateStep() {
  return useMutation({
    mutationFn: async (input: GenerateStepInput): GenerateStepOutput => {
      const result = await client.GENERATE_STEP({
        objective: input.objective,
        previousSteps:
          input.previousSteps?.map((step) => ({
            id: step.id,
            name: step.name,
            outputSchema: step.outputSchema,
          })) ?? [],
      });

      return result;
    },
  });
}
