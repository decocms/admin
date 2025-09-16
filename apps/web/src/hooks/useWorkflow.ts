import { useSandboxWorkflow } from "@deco/sdk";

export interface WorkflowDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  steps: Array<{
    type: 'tool_call' | 'mapping';
    def: any;
  }>;
}

export function useWorkflow(org: string, project: string, workflowName: string) {
  const { data, isLoading, error } = useSandboxWorkflow(workflowName);
  
  // If workflow doesn't exist, create a new one
  const workflow = data || createEmptyWorkflow(workflowName);

  return { 
    workflow, 
    isLoading, 
    error: error?.message || null 
  };
}

function createEmptyWorkflow(name: string): WorkflowDefinition {
  return {
    name,
    description: `Workflow: ${name}`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    outputSchema: {
      type: 'object',
      properties: {},
      required: []
    },
    steps: []
  };
}
