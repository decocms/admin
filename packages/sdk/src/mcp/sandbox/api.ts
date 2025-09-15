// Import for combining
import { SANDBOX_TOOLS } from "./tools.ts";
import { SANDBOX_WORKFLOWS } from "./workflows.ts";
      const env = await envPromise;

// Combine all sandbox tools and workflows
export const SANDBOX_TOOLS_AND_WORKFLOWS = [
  ...SANDBOX_TOOLS,
  ...SANDBOX_WORKFLOWS,
];
