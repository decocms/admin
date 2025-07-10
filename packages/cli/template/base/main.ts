// deno-lint-ignore-file require-await
import { withRuntime } from "@deco/workers-runtime";
import {
  createStepFromTool,
  createTool,
  createWorkflow,
} from "@deco/workers-runtime/mastra";
import { z } from "zod";

// deno-lint-ignore ban-types
type Bindings = {};

const createMyTool = (_bindings: Bindings) =>
  createTool({
    id: "MY_TOOL",
    description: "Say hello",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ message: z.string() }),
    execute: async ({ context }) => ({
      message: `Hello, ${context.name}!`,
    }),
  });

const createMyWorkflow = (bindings: Bindings) => {
  const step = createStepFromTool(createMyTool(bindings));

  return createWorkflow({
    id: "MY_WORKFLOW",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ message: z.string() }),
  })
    .then(step)
    .commit();
};

const { Workflow, ...runtime } = withRuntime<Bindings>({
  workflows: [createMyWorkflow],
  tools: [createMyTool],
});

export { Workflow };

export default runtime;
