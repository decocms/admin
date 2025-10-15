/**
 * Workflow Prompts for Resources 2.0
 *
 * This module contains comprehensive prompts and descriptions for workflow
 * creation, updating, and management using the Resources 2.0 system.
 */

export const WORKFLOW_CREATE_PROMPT = `Create a workflow with alternating code and tool_call steps.

## Execution Pattern

Workflows follow a strict alternating pattern where **each step receives the previous step's output**:

\`\`\`
Input → Code → Tool Call → Code → Tool Call → Code (final) → Output
\`\`\`

**Key Rules:**
1. **Code steps transform data** for the next tool_call or final output
2. **Tool calls receive** the previous step's output as their input
3. **Final step must be code** that returns data matching the workflow's output schema

## Code Step Execute Function

Code steps must export a default async function. Available API:

\`\`\`javascript
export default async function(ctx) {
  // Read workflow input (original input passed to workflow)
  const workflowInput = await ctx.readWorkflowInput();
  
  // Read result from a previous step by name
  const prevResult = await ctx.readStepResult('step-name');
  
  // Call integration tools (must declare in dependencies array)
  const result = await ctx.env['i:slack-123'].send_message({
    channel: '#general',
    text: 'Hello'
  });
  
  // Sleep utilities
  await ctx.sleep('wait-name', 5000);  // milliseconds
  await ctx.sleepUntil('wait-name', Date.now() + 5000);  // timestamp
  
  // Return data for next step (must match next tool's input schema)
  return { field1: prevResult.data, field2: workflowInput.userId };
}
\`\`\`

**Code Step Structure:**
\`\`\`json
{
  "type": "code",
  "def": {
    "name": "transform-data",
    "description": "Transform previous result for next tool",
    "execute": "export default async function(ctx) { ... }",
    "dependencies": [{ "integrationId": "i:slack-123" }]  // Optional, only if using ctx.env
  }
}
\`\`\`

## Tool Call Step Structure

Tool calls execute external integrations with the previous step's output:

\`\`\`json
{
  "type": "tool_call",
  "def": {
    "name": "call-external-api",
    "description": "Execute external tool",
    "tool_name": "send_message",
    "integration": "i:slack",
    "options": {
      "retries": { "limit": 3, "delay": 1000 },
      "timeout": 30000
    }
  }
}
\`\`\`

**Integration IDs:**
- Don't know the ID? Use a placeholder like \`i:slack\` or \`i:database\`
- Validation will show available integrations if the ID doesn't exist
- The system will guide you to the correct ID

**HTTP Requests:**
- \`fetch\` is NOT available in this environment
- To make HTTP requests, use the \`i:http\` integration with the \`HTTP_FETCH\` tool
- Example: \`await ctx.env['i:http'].HTTP_FETCH({ url: '...', method: 'GET' })\`
- Remember to add \`{ integrationId: 'i:http' }\` to dependencies

## Best Practices

1. **Alternate code → tool_call → code → tool_call** - Code prepares data for tools
2. **Each code step returns data** matching the next tool call's input schema
3. **Use placeholders for integration IDs** - Validation errors will list available integrations
4. **Final code step** aggregates results and returns output matching workflow's output schema
5. **Keep transformations simple** - Each code step should do one thing
6. **Use stopAfter parameter** to test steps incrementally`;

export const WORKFLOW_UPDATE_PROMPT = `Update a workflow while maintaining the alternating code → tool_call pattern.

## Execution Pattern Reminder

\`\`\`
Input → Code → Tool Call → Code → Tool Call → Code (final) → Output
\`\`\`

**Key Rules:**
1. **Each step receives the previous step's output**
2. **Code steps transform data** for the next tool_call
3. **Final step must be code** returning data matching output schema

## Code Step Execute API

\`\`\`javascript
export default async function(ctx) {
  const workflowInput = await ctx.readWorkflowInput();
  const prevResult = await ctx.readStepResult('step-name');
  const toolResult = await ctx.env['i:integration'].tool_name({ args });
  await ctx.sleep('name', 5000);
  await ctx.sleepUntil('name', timestamp);
  return { data: 'for next step' };
}
\`\`\`

## Update Guidelines

1. **Maintain alternation** - code → tool_call → code → tool_call
2. **Match schemas** - Each code step output must match next tool's input schema
3. **Use placeholders for integration IDs** - Validation will show available integrations
4. **Update dependencies** - Add \`{ integrationId }\` to code step's dependencies if using ctx.env
5. **Test incrementally** - Use stopAfter to test each updated step

## Common Patterns

**Adding a tool call:**
- Add code step before it to transform data
- Add tool_call with placeholder ID (e.g., \`i:slack\`)
- Add code step after to handle result
- Validation will guide you to correct IDs

**Fixing integration IDs:**
- Use placeholder IDs - validation errors list all available integrations
- Copy the correct ID from the error message

**HTTP Requests:**
- \`fetch\` is NOT available in this environment
- To make HTTP requests, use the \`i:http\` integration with the \`HTTP_FETCH\` tool
- Example: \`await ctx.env['i:http'].HTTP_FETCH({ url: '...', method: 'GET' })\`
- Remember to add \`{ integrationId: 'i:http' }\` to dependencies`;

export const WORKFLOW_SEARCH_PROMPT = `Search workflows in the workspace. 

Supports filtering by:
- Workflow title and description
- Workflow status (draft, active, inactive)
- Workflow tags and categories
- Author and version information

Use the 'term' parameter for text search across title, description, and tags.
Use the 'filters' parameter for structured filtering by status, category, etc.`;

export const WORKFLOW_READ_PROMPT = `Read a specific workflow by its Resources 2.0 URI.

Returns the complete workflow definition including:
- Workflow metadata (title, description, status, tags, etc.)
- Workflow definition with input/output schemas
- Step definitions (code and tool_call steps)
- Execution statistics and timestamps`;

export const WORKFLOW_DELETE_PROMPT = `Delete a workflow from the workspace.

This will permanently remove the workflow file from the DECONFIG storage.
Use with caution as this action cannot be undone.`;

export const WORKFLOWS_START_WITH_URI_PROMPT = `Execute a workflow by URI with optional partial execution and state injection.

## Overview

This tool starts a workflow execution using a Resources 2.0 URI. Workflows are sequential automation processes that consist of alternating steps between tool calls (calling integration tools) and code steps (data transformation). Each workflow validates input against its schema and executes steps in order until completion or until stopped at a specified step.

## Parameters

### uri
The Resources 2.0 URI of the workflow to execute (e.g., rsc://workflow/my-workflow).

### input
The input data passed to the workflow. This data:
- Will be validated against the workflow's defined input schema
- Is accessible to all steps via \`ctx.readWorkflowInput()\`
- Should match the structure expected by the workflow's first step

### stopAfter (Optional)
The name of the step where execution should halt. When specified:
- The workflow executes **up to and including** the named step
- Execution stops after the specified step completes
- Useful for debugging, testing individual steps, or partial workflow execution

### state (Optional)
Pre-computed step results to inject into the workflow execution state. Format: \`{ "step-name": STEP_RESULT }\`

This allows you to:
- **Skip steps**: Provide expected outputs for steps you want to bypass
- **Resume workflows**: Continue from a specific point with known intermediate results  
- **Test workflows**: Inject mock data to test specific scenarios
- **Debug workflows**: Isolate problems by providing known good inputs to later steps

## Return Value

Returns an object with:
- \`runId\`: Unique identifier for tracking this workflow execution (legacy)
- \`uri\`: The Resources 2.0 URI of the workflow run (format: rsc://i:workflows-management/workflow_run/{runId})
- \`error\`: Error message if workflow failed to start (validation errors, missing workflow, etc.)

## Monitoring Workflow Execution

After starting a workflow, use the returned \`uri\` with **DECO_RESOURCE_WORKFLOW_RUN_READ** to monitor progress and retrieve results:
- The workflow_run resource includes status, current step, step results, logs, and timing information
- For running workflows, call DECO_RESOURCE_WORKFLOW_RUN_READ repeatedly to poll for updates
- The resource automatically refreshes with the latest execution state`;

export const WORKFLOWS_GET_STATUS_PROMPT = `Get the status and output of a workflow run.

**DEPRECATED**: This tool is deprecated. Use DECO_RESOURCE_WORKFLOW_RUN_READ instead, which provides the same information through the workflow_run resource.

This tool retrieves the current status and results of a workflow execution, including:
- Current execution status (pending, running, completed, failed)
- Results from completed steps
- Final workflow output (if completed)
- Error information (if failed)
- Execution logs and timing information

Use this tool to monitor workflow progress, retrieve results, or debug failed executions.`;

export const WORKFLOW_RUN_READ_PROMPT = `Read the status and results of a workflow run using its Resources 2.0 URI.

## Overview

This tool retrieves comprehensive information about a workflow execution, including real-time status, step results, logs, and timing information. Use this after starting a workflow with DECO_WORKFLOW_START to monitor progress and retrieve results.

## Input

- **uri**: The Resources 2.0 URI of the workflow run (format: rsc://i:workflows-management/workflow_run/{runId})
  - This URI is returned by DECO_WORKFLOW_START when you start a workflow
  - You can also search for workflow runs using DECO_RESOURCE_WORKFLOW_RUN_SEARCH

## Return Value

Returns a workflow_run resource object with:

### Core Fields
- **status**: Current execution status ("pending", "running", "completed", "failed", "errored")
- **runId**: Unique identifier for this execution
- **workflowURI**: The URI of the workflow definition that was executed

### Execution Details
- **currentStep**: Name of the step currently executing (if status is "running")
- **stepResults**: Object mapping step names to their output values (for completed steps)
- **finalResult**: The final workflow output (if status is "completed")
- **partialResult**: Intermediate results from completed steps (if still running)

### Error Information
- **error**: Error message and details (if status is "failed" or "errored")
- **logs**: Array of log entries from step execution, including errors and warnings

### Timing
- **startTime**: Unix timestamp when the workflow started
- **endTime**: Unix timestamp when the workflow finished (if completed/failed)
- **created_at**: ISO 8601 timestamp when the run was created
- **updated_at**: ISO 8601 timestamp of the last status update

### Raw Data
- **workflowStatus**: Complete raw workflow status from Cloudflare Workflows (for advanced use cases)

## Usage Pattern

\`\`\`javascript
// 1. Start a workflow
const { uri } = await DECO_WORKFLOW_START({
  uri: "rsc://workflow/my-workflow",
  input: { userId: "123" }
});

// 2. Monitor execution
const run = await DECO_RESOURCE_WORKFLOW_RUN_READ({ uri });
console.log(run.data.status); // "running"
console.log(run.data.currentStep); // "step-2-process-data"

// 3. Poll until complete
while (run.data.status === "running" || run.data.status === "pending") {
  await sleep(2000);
  run = await DECO_RESOURCE_WORKFLOW_RUN_READ({ uri });
}

// 4. Get results
if (run.data.status === "completed") {
  console.log(run.data.finalResult);
} else {
  console.error(run.data.error);
  console.log(run.data.logs);
}
\`\`\`

## Common Use Cases

- **Monitor Progress**: Poll this tool to track workflow execution in real-time
- **Retrieve Results**: Get the final output once a workflow completes
- **Debug Failures**: Access error messages and logs when workflows fail
- **Inspect Steps**: View intermediate results from each completed step
- **Resume Workflows**: Use partialResult to continue from a checkpoint`;
export const WORKFLOWS_START_PROMPT = `Execute a multi-step workflow with optional partial execution and state injection.

## Overview

This tool starts a workflow execution. Workflows are sequential automation processes that consist of alternating steps between tool calls (calling integration tools) and code steps (data transformation). Each workflow validates input against its schema and executes steps in order until completion or until stopped at a specified step.

## Parameters

### name
The identifier of the workflow to execute. This must match an existing workflow definition in the workspace.

### input
The input data passed to the workflow. This data:
- Will be validated against the workflow's defined input schema
- Is accessible to all steps via \`ctx.readWorkflowInput()\`
- Should match the structure expected by the workflow's first step

### stopAfter (Optional)
The name of the step where execution should halt. When specified:
- The workflow executes **up to and including** the named step
- Execution stops after the specified step completes
- Useful for debugging, testing individual steps, or partial workflow execution
- Example: If workflow has steps ["validate", "process", "notify"], setting \`stopAfter: "process"\` will run "validate" and "process" but skip "notify"

### state (Optional)
Pre-computed step results to inject into the workflow execution state. Format: \`{ "step-name": STEP_RESULT }\`

This allows you to:
- **Skip steps**: Provide expected outputs for steps you want to bypass
- **Resume workflows**: Continue from a specific point with known intermediate results  
- **Test workflows**: Inject mock data to test specific scenarios
- **Debug workflows**: Isolate problems by providing known good inputs to later steps

Example:
\`\`\`json
{
  "validate-input": { "isValid": true, "errors": [] },
  "fetch-data": { "records": [{"id": 1, "name": "test"}] }
}
\`\`\`

## Execution Flow

1. **Validation**: Input is validated against the workflow's input schema
2. **State Injection**: Any provided state results are loaded into the workflow context
3. **Step Execution**: Steps run sequentially, with each step having access to:
   - Original workflow input via \`ctx.readWorkflowInput()\`
   - Previous step results via \`ctx.readStepResult(stepName)\`
   - Injected state results (treated as if those steps already completed)
4. **Stopping**: If \`stopAfter\` is specified, execution halts after that step completes
5. **Tracking**: Returns a \`runId\` for monitoring progress with \`WORKFLOWS_GET_STATUS\`

## Common Use Cases

- **Full Execution**: Run complete workflow from start to finish
- **Step-by-Step Debugging**: Use \`stopAfter\` to test each step individually
- **Workflow Resumption**: Use \`state\` to continue from a previous execution point
- **Testing with Mock Data**: Use \`state\` to inject test results for upstream steps
- **Partial Processing**: Stop at intermediate steps to inspect results before continuing

## Return Value

Returns an object with:
- \`runId\`: Unique identifier for tracking this workflow execution
- \`error\`: Error message if workflow failed to start (validation errors, missing workflow, etc.)`;
