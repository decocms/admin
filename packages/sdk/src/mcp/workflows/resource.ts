import { DeconfigResource } from "../deconfig/deconfig-resource.ts";
import { WorkflowDefinitionSchema } from "./workflow-schemas.ts";

export const RESOURCE_NAME = "workflow";

const WORKFLOW_PROMPT = `Create or update a workflow in the sandbox environment.

## Overview

Workflows are powerful automation tools that execute a sequence of steps sequentially to accomplish complex tasks. Each workflow consists of:

- **Input Schema**: Defines the data structure and parameters required to start the workflow
- **Output Schema**: Defines the final result structure after all steps complete
- **Steps**: An ordered array of individual operations that run one after another (alternating between tool calls and mappers)

The workflow's final output is determined by the last step in the sequence, which should be a code step that aggregates and returns the desired result.

## Workflow Steps

Workflows alternate between two types of steps:

### 1. Tool Call Steps
Execute tools from integrations using the workflow input:
- **type**: "tool_call"
- **def**: Tool call step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **options**: Configuration with retry/timeout settings and custom properties
  - **tool_name**: The name of the tool to call
  - **integration**: The integration ID of the integration that provides this tool

**Important**: The \`integration\` property must be set to the integration ID (format: \`i:<uuid>\`), not the integration name. To find the correct integration ID:
1. Use the \`integration_list\` tool to get available integrations
2. Look for the integration that provides the tool you need
3. Use the integration's ID (e.g., \`i:123e4567-e89b-12d3-a456-426614174000\`) in the \`integration\` property

Tool calls receive the workflow input directly. Use code steps before tool calls to transform the input as needed.

### 2. Code Steps
Transform data between tool calls:
- **type**: "code"
- **def**: Code step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **execute**: ES module code with a default async function

### Code Step Execution Function
Each code step's execute function follows this pattern:
\`\`\`javascript
export default async function(ctx) {
  // ctx contains WellKnownOptions helper functions:
  // - await ctx.readWorkflowInput(): Returns the initial workflow input
  // - await ctx.readStepResult(stepName): Returns output from a previous step
  // - await ctx.sleep(name, duration): Sleeps for a specified duration
  // - await ctx.sleepUntil(name, date): Sleeps until a specified date or timestamp
  
  // Transform data between tool calls
  const input = await ctx.readWorkflowInput();
  const previousResult = await ctx.readStepResult('previous-step');
  
  // Your code logic here
  return transformedData;
}
\`\`\`

## Final Output

The workflow's final output is automatically determined by the last step in the sequence. This should be a code step that:

1. Aggregates data from previous steps using ctx.readStepResult(stepName)
2. Transforms the data to match the workflow's output schema
3. Returns the final result

The last code step effectively replaces the need for a separate workflow execute function.

## Examples

### Example 1: Data Processing Workflow

*Note: Integration IDs shown are examples. Use the \`integration_list\` tool to get actual integration IDs.*

\`\`\`json
{
  "name": "process-user-data",
  "description": "Validates, enriches, and stores user data",
  "inputSchema": {
    "type": "object",
    "properties": {
      "email": { "type": "string", "format": "email" },
      "name": { "type": "string" }
    },
    "required": ["email", "name"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" },
      "status": { "type": "string", "enum": ["created", "updated"] }
    }
  },
  "steps": [
    {
      "type": "code",
      "def": {
        "name": "validate-input",
        "description": "Validates user input data",
        "execute": "export default async function(ctx) { const input = await ctx.readWorkflowInput(); return { isValid: input.email.includes('@'), errors: [] }; }"
      }
    },
    {
      "type": "tool_call",
      "def": {
        "name": "store-user",
        "description": "Stores user data in database",
        "options": {
          "retries": { "limit": 2 },
          "timeout": 5000
        },
        "tool_name": "create_user",
        "integration": "i:123e4567-e89b-12d3-a456-426614174000"
      }
    },
    {
      "type": "code",
      "def": {
        "name": "finalize-result",
        "description": "Aggregates and returns the final workflow result",
        "execute": "export default async function(ctx) { const storedUser = await ctx.readStepResult('store-user'); return { userId: storedUser.id, status: 'created' }; }"
      }
    }
  ]
}
\`\`\`

### Example 2: AI Content Generation Workflow

*Note: Integration IDs shown are examples. Use the \`integration_list\` tool to get actual integration IDs.*

\`\`\`json
{
  "name": "generate-content",
  "description": "Generates and reviews AI content",
  "inputSchema": {
    "type": "object",
    "properties": {
      "topic": { "type": "string" },
      "tone": { "type": "string", "enum": ["formal", "casual", "technical"] }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "content": { "type": "string" },
      "quality": { "type": "number", "minimum": 0, "maximum": 10 }
    }
  },
  "steps": [
    {
      "type": "code",
      "def": {
        "name": "prepare-prompt",
        "description": "Prepares the AI prompt from input",
        "execute": "export default async function(ctx) { const input = await ctx.readWorkflowInput(); return { prompt: \`Write about \${input.topic} in a \${input.tone} tone\` }; }"
      }
    },
    {
      "type": "tool_call",
      "def": {
        "name": "generate-draft",
        "description": "Creates initial content draft using AI",
        "options": {
          "retries": { "limit": 1 },
          "timeout": 30000,
          "temperature": 0.7,
          "maxTokens": 1000
        },
        "tool_name": "generate_text",
        "integration": "i:987fcdeb-51a2-43d7-8f9e-123456789abc"
      }
    },
    {
      "type": "code",
      "def": {
        "name": "finalize-content",
        "description": "Aggregates and returns the final content result",
        "execute": "export default async function(ctx) { const draft = await ctx.readStepResult('generate-draft'); const review = await ctx.readStepResult('review-content'); return { content: draft.content, quality: review.quality }; }"
      }
    }
  ]
}
\`\`\`

## Best Practices

1. **Alternating Steps**: Design workflows to alternate between tool calls and code
2. **Final Code Step**: Always end with a code step that aggregates and returns the final result
3. **Input Transformation**: Use code steps before tool calls to transform workflow input as needed
4. **Integration Discovery**: Always use the \`integration_list\` tool to find the correct integration ID before creating tool_call steps
5. **Minimal Output**: Keep code step outputs minimal to improve performance
6. **Error Handling**: Use retry and timeout configurations appropriately for tool calls
7. **Schema Validation**: Define clear input/output schemas for type safety
8. **Step Independence**: Design steps to be testable in isolation
9. **Business Configuration**: Use options to expose tunable parameters for tool calls
10. **Sequential Execution**: Steps run in order - design accordingly
11. **Data Flow**: Use code to transform data between tool calls

## WellKnownOptions Interface

The context object in code step execute functions includes:

\`\`\`typescript
interface WellKnownOptions {
  readWorkflowInput(): Promise<WorkflowInputSchema>;
  readStepResult(stepName: string): Promise<StepOutputSchema>;
  sleep(name: string, duration: number): Promise<void>;
  sleepUntil(name: string, date: Date | number): Promise<void>;
}
\`\`\`

Use these helper functions to access workflow input and previous step results within your code step execute functions.

`;

export const WorkflowResource = DeconfigResource.define({
  directory: "/src/workflows",
  resourceName: RESOURCE_NAME,
  schema: WorkflowDefinitionSchema,
  enhancements: {
    DECO_CHAT_RESOURCES_CREATE: {
      description: WORKFLOW_PROMPT,
    },
    DECO_CHAT_RESOURCES_UPDATE: {
      description: WORKFLOW_PROMPT,
    },
  },
});
