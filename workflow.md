# Workflow Builder UI Feature

## Overview

This document outlines the implementation of a visual workflow builder UI that
allows users to create, edit, and execute workflows using a drag-and-drop
interface powered by React Flow. The UI will provide an intuitive way to build
complex workflows by connecting tools and mappers in a visual canvas.

## Feature Description

The Workflow Builder is a visual interface accessible via the URL pattern
`/:org/:project/workflows/:workflow-name` that enables users to:

1. **Edit Existing Workflows**: Load and modify existing workflow definitions
2. **Create Workflows Visually**: Drag and drop tools and mappers onto a canvas
3. **Connect Components**: Link tools and mappers to create execution flows
4. **Auto-Generate Mappers**: Automatically insert mapper nodes when connecting
   tools
5. **Generate Workflow Definitions**: Convert visual workflows into executable
   workflow definitions
6. **Execute Workflows**: Run workflows with proper input validation and
   execution tracking
7. **Replay Steps**: Rerun individual nodes or steps during workflow execution

**Note**: This is an early-stage feature accessible only by typing the URL
directly in the browser address bar.

## Technical Architecture

### Routing Structure

The workflow builder will be accessible via the following URL pattern:

```
/:org/:project/workflows/:workflow-name
```

**Example URLs:**

- `/acme-corp/my-project/workflows/process-user-data`
- `/my-org/ecommerce/workflows/order-fulfillment`
- `/company/analytics/workflows/data-pipeline`

**Route Parameters:**

- `org`: Organization identifier
- `project`: Project identifier
- `workflow-name`: Name of the workflow to edit

### Core Technologies

- **React Flow**: For the visual workflow canvas and node management
- **React JSON Schema Form (RJSF) with Shadcn**: For dynamic form generation
  based on JSON schemas
- **Zod**: For schema validation
- **TypeScript**: For type safety throughout the implementation

### Key Components

#### 1. WorkflowBuilderPage

The main page component that handles routing and workflow loading.

```typescript
interface WorkflowBuilderPageProps {
  org: string;
  project: string;
  workflowName: string;
}

// Route component
function WorkflowBuilderPage(
  { org, project, workflowName }: WorkflowBuilderPageProps,
) {
  const { workflow, isLoading, error } = useWorkflow(
    org,
    project,
    workflowName,
  );

  if (isLoading) return <WorkflowLoadingSkeleton />;
  if (error) return <WorkflowErrorState error={error} />;
  if (!workflow) return <WorkflowNotFoundState workflowName={workflowName} />;

  return <WorkflowCanvas workflow={workflow} />;
}
```

#### 2. WorkflowCanvas

The main canvas component that renders the React Flow interface.

```typescript
interface WorkflowCanvasProps {
  workflow: WorkflowDefinition;
  onWorkflowChange: (workflow: WorkflowDefinition) => void;
  isDirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
}
```

#### 3. Node Types

Two primary node types for the workflow:

**Tool Node**

```typescript
interface ToolNodeData {
  type: "tool_call";
  name: string;
  description: string;
  tool_name: string;
  integration: string;
  options?: Record<string, any>;
}
```

**Mapper Node**

```typescript
interface MapperNodeData {
  type: "mapping";
  name: string;
  description: string;
  execute: string; // Generated or user-defined code
  outputSchema: Record<string, any>;
}
```

#### 4. Workflow State Management

```typescript
interface WorkflowBuilderState {
  nodes: Node[];
  edges: Edge[];
  isDirty: boolean;
  currentWorkflow?: WorkflowDefinition;
  executionState?: {
    runId: string;
    status: "pending" | "running" | "completed" | "failed";
    stepResults: Record<string, any>;
  };
}
```

#### 5. Form Integration with RJSF

The workflow builder will use React JSON Schema Form (RJSF) with Shadcn
components for dynamic form generation:

```typescript
interface WorkflowFormProps {
  schema: Record<string, any>; // JSON Schema for form generation
  onSubmit: (data: Record<string, any>) => void;
  initialData?: Record<string, any>;
  uiSchema?: Record<string, any>; // Custom UI configuration
}
```

**Benefits of RJSF with Shadcn:**

- **Dynamic Form Generation**: Automatically generates forms from JSON schemas
- **Consistent UI**: Uses Shadcn components for consistent design system
- **Validation**: Built-in validation based on JSON Schema
- **Customization**: Flexible UI schema for custom form layouts
- **Type Safety**: Full TypeScript support with proper typing

## Implementation Details

### 1. Workflow Loading and Initialization

#### Route Handler

```typescript
// In the main router configuration
{
  path: '/:org/:project/workflows/:workflowName',
  element: <WorkflowBuilderPage />,
  loader: async ({ params }) => {
    const { org, project, workflowName } = params;
    return { org, project, workflowName };
  }
}
```

#### Workflow Loading Hook

```typescript
function useWorkflow(org: string, project: string, workflowName: string) {
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkflow() {
      try {
        setIsLoading(true);
        setError(null);

        // Call SANDBOX_GET_WORKFLOW to load existing workflow
        const result = await client.SANDBOX_GET_WORKFLOW({
          name: workflowName,
        });

        if (result.workflow) {
          setWorkflow(result.workflow);
        } else {
          // Workflow doesn't exist - create a new one
          setWorkflow(createEmptyWorkflow(workflowName));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load workflow",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkflow();
  }, [org, project, workflowName]);

  return { workflow, isLoading, error };
}

function createEmptyWorkflow(name: string): WorkflowDefinition {
  return {
    name,
    description: `Workflow: ${name}`,
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    outputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
    steps: [],
  };
}
```

#### Canvas Initialization

```typescript
function WorkflowCanvas({ workflow }: WorkflowCanvasProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Convert workflow definition to React Flow nodes and edges
  useEffect(() => {
    const { nodes: flowNodes, edges: flowEdges } = convertWorkflowToFlow(
      workflow,
    );
    setNodes(flowNodes);
    setEdges(flowEdges);
    setIsDirty(false);
  }, [workflow]);

  // Convert React Flow nodes and edges back to workflow definition
  const convertFlowToWorkflow = useCallback(() => {
    return convertFlowToWorkflowDefinition(nodes, edges, workflow);
  }, [nodes, edges, workflow]);

  return (
    <div className="h-screen w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
      >
        <WorkflowToolbar
          isDirty={isDirty}
          onGenerate={handleGenerate}
          onRun={handleRun}
        />
        <WorkflowPalette />
      </ReactFlow>
    </div>
  );
}
```

### 2. Canvas Actions

#### Add Tool Action

- **Trigger**: Tool palette or context menu
- **Behavior**:
  - Opens existing "Add Integration" dialog (reused from agent creation)
  - User selects integration and tool from the familiar interface
  - Creates new tool node on canvas with selected tool configuration
  - Sets node position based on mouse coordinates
  - Marks canvas as dirty

#### Add Mapper Action

- **Trigger**: Tool palette or context menu
- **Behavior**:
  - Creates new mapper node on canvas
  - Opens mapper configuration dialog
  - Sets node position based on mouse coordinates
  - Marks canvas as dirty

### 2. Auto-Mapper Generation

**Always insert a mapper between tools** - this ensures data transformation is
explicit and configurable.

When a user connects two tools directly:

```typescript
function handleEdgeConnect(connection: Connection) {
  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (sourceNode?.type === "tool" && targetNode?.type === "tool") {
    // Remove direct connection
    const newEdges = edges.filter((e) =>
      !(e.source === connection.source && e.target === connection.target)
    );

    // Create mapper node
    const mapperNode = createMapperNode({
      name: `map-${sourceNode.data.name}-to-${targetNode.data.name}`,
      description:
        "This mapper transforms the output from the previous step to match the input requirements of the next step",
      execute: generateDefaultMapperCode(sourceNode, targetNode),
    });

    // Create new edges: source -> mapper -> target
    const newMapperEdges = [
      { source: connection.source, target: mapperNode.id },
      { source: mapperNode.id, target: connection.target },
    ];

    setNodes([...nodes, mapperNode]);
    setEdges([...newEdges, ...newMapperEdges]);
  }
}

function generateDefaultMapperCode(sourceNode: Node, targetNode: Node): string {
  // If data types match, generate identity function: x => x
  // If data types don't match, generate transformation logic
  const sourceOutput = getToolOutputSchema(sourceNode.data.tool_name);
  const targetInput = getToolInputSchema(targetNode.data.tool_name);

  if (schemasMatch(sourceOutput, targetInput)) {
    return `export default async function(ctx) {
  const input = await ctx.readStepResult('${sourceNode.data.name}');
  return input; // Identity transformation
}`;
  } else {
    return `export default async function(ctx) {
  const input = await ctx.readStepResult('${sourceNode.data.name}');
  // TODO: Transform input to match target requirements
  // Source schema: ${JSON.stringify(sourceOutput)}
  // Target schema: ${JSON.stringify(targetInput)}
  return input;
}`;
  }
}
```

### 3. Generate Button Behavior

#### When Canvas is Dirty

- **Button Text**: "Generate Workflow"
- **Action**: Calls AI GenerateObject function with workflow schema
- **Process**:
  1. Validates canvas structure (no orphaned nodes, proper flow)
  2. Converts nodes/edges to workflow definition
  3. Calls `MCPClient['AI_GATEWAY'].AI_GENERATE_OBJECT` with workflow schema and
     prompt
  4. Uses AI to enhance/complete the workflow definition
  5. Calls `SANDBOX_UPSERT_WORKFLOW` with the AI-generated workflow
  6. Marks canvas as clean
  7. Updates button to "Run Workflow"

#### When Canvas is Clean

- **Button Text**: "Run Workflow"
- **Action**: Opens input form and executes workflow
- **Process**:
  1. Shows RJSF-generated input form based on workflow's input schema
  2. Validates input against workflow's input schema using RJSF validation
  3. Calls `SANDBOX_START_WORKFLOW`
  4. Shows execution progress and results

### 4. Workflow Execution UI

#### Execution States

```typescript
interface ExecutionState {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  currentStep?: string;
  stepResults: Record<string, any>;
  logs: Array<{ type: "log" | "warn" | "error"; content: string }>;
}
```

#### Visual Feedback

- **Node States**: Different colors/styles for pending, running, completed,
  failed
- **Progress Indicator**: Shows current execution step
- **Logs Panel**: Displays execution logs in real-time
- **Results Panel**: Shows step results and final output

#### Replay Functionality

- **Individual Node Replay**: Right-click on completed nodes to rerun
- **Step Replay**: Use `SANDBOX_REPLAY_WORKFLOW_FROM_STEP` for partial execution
- **Visual Indicators**: Show which nodes can be replayed

## Required Code Changes

### 1. New Components to Create

#### `/apps/web/src/pages/workflow-builder/`

```
workflow-builder/
├── WorkflowBuilderPage.tsx     # Main page component with routing
├── WorkflowLoadingSkeleton.tsx # Loading state component
├── WorkflowErrorState.tsx      # Error state component
└── WorkflowNotFoundState.tsx   # Not found state component
```

#### `/apps/web/src/components/workflow-builder/`

```
workflow-builder/
├── WorkflowCanvas.tsx          # Main canvas component
├── WorkflowToolbar.tsx         # Toolbar with actions
├── WorkflowPalette.tsx         # Tool/mapper selection palette
├── WorkflowExecutionPanel.tsx  # Execution status and logs
├── WorkflowInputForm.tsx       # RJSF-based input schema form
├── nodes/
│   ├── ToolNode.tsx           # Tool node component
│   ├── MapperNode.tsx         # Mapper node component
│   └── InputNode.tsx          # Input node component
├── dialogs/
│   ├── ToolConfigDialog.tsx   # Tool configuration (RJSF-based)
│   ├── MapperConfigDialog.tsx # Mapper configuration (RJSF-based)
│   └── WorkflowSettingsDialog.tsx # Workflow metadata (RJSF-based)
└── hooks/
    ├── useWorkflow.ts         # Workflow loading and management
    ├── useWorkflowBuilder.ts  # Main workflow state management
    ├── useWorkflowExecution.ts # Execution state management
    └── useWorkflowValidation.ts # Canvas validation
```

#### Reused Components

- **Integration Selection Dialog**: Reuse existing "Add Integration" dialog from
  agent creation
- **Tool Selection Interface**: Leverage existing tool discovery and selection
  UI

### 2. Schema Integration

#### Workflow Definition Conversion

```typescript
function convertCanvasToWorkflow(
  nodes: Node[],
  edges: Edge[],
  inputSchema: Record<string, any>,
  outputSchema: Record<string, any>,
): WorkflowDefinition {
  // Convert nodes to workflow steps
  const steps = nodes
    .filter((node) => node.type !== "input")
    .map((node) => {
      if (node.data.type === "tool_call") {
        return {
          type: "tool_call" as const,
          def: {
            name: node.data.name,
            description: node.data.description,
            options: node.data.options,
            tool_name: node.data.tool_name,
            integration: node.data.integration,
          },
        };
      } else if (node.data.type === "mapping") {
        return {
          type: "mapping" as const,
          def: {
            name: node.data.name,
            description: node.data.description,
            execute: node.data.execute,
          },
        };
      }
    });

  return {
    name: workflowName,
    description: workflowDescription,
    inputSchema,
    outputSchema,
    steps,
  };
}
```

### 3. AI Integration

#### Generate Workflow Function

```typescript
async function generateWorkflow(
  canvasData: { nodes: Node[]; edges: Edge[] },
  userPrompt?: string,
) {
  const workflowDefinition = convertCanvasToWorkflow(canvasData);

  // Use AI to enhance or generate the workflow
  const enhancedWorkflow = await MCPClient["AI_GATEWAY"].AI_GENERATE_OBJECT({
    schema: WorkflowDefinitionSchema,
    prompt: userPrompt ||
      `Generate a complete workflow definition from this canvas structure. 
    
    Current workflow structure:
    - Name: ${workflowDefinition.name}
    - Description: ${workflowDefinition.description}
    - Steps: ${workflowDefinition.steps.length} steps
    - Input Schema: ${JSON.stringify(workflowDefinition.inputSchema)}
    - Output Schema: ${JSON.stringify(workflowDefinition.outputSchema)}
    
    Please enhance this workflow definition to be complete and executable, following the same patterns as the sandbox workflow creation tool.`,
    data: workflowDefinition,
  });

  return enhancedWorkflow;
}
```

### 4. State Management Updates

#### Workflow Builder Context

```typescript
interface WorkflowBuilderContextType {
  // Canvas state
  nodes: Node[];
  edges: Edge[];
  isDirty: boolean;

  // Workflow state
  currentWorkflow?: WorkflowDefinition;
  executionState?: ExecutionState;

  // Actions
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  deleteNode: (nodeId: string) => void;
  addEdge: (edge: Edge) => void;
  deleteEdge: (edgeId: string) => void;

  // Workflow actions
  generateWorkflow: () => Promise<void>;
  runWorkflow: (input: Record<string, any>) => Promise<void>;
  replayStep: (stepName: string) => Promise<void>;

  // UI state
  selectedNode?: string;
  showInputForm: boolean;
  setShowInputForm: (show: boolean) => void;
}
```

## User Experience Flow

### 1. Accessing and Editing a Workflow

1. User types URL `/:org/:project/workflows/:workflow-name` in browser address
   bar
2. System loads existing workflow or creates empty workflow if not found
3. User sees visual representation of workflow on canvas
4. User clicks "Add Tool" to open familiar "Add Integration" dialog
5. User selects integration and tool from existing interface
6. User connects tools (always auto-generates mappers between tools)
7. User configures mapper functions if needed (identity function `x => x` for
   matching types)
8. User clicks "Generate Workflow" to save changes
9. AI generates complete workflow definition using
   MCPClient['AI_GATEWAY'].AI_GENERATE_OBJECT
10. Canvas becomes "clean" state

### 2. Running a Workflow

1. User clicks "Run Workflow" (when canvas is clean)
2. RJSF-generated input form appears based on workflow's input schema
3. User fills required input fields with automatic validation
4. Workflow execution starts
5. Visual feedback shows progress through nodes
6. Results displayed in execution panel

### 3. Debugging/Replaying

1. User can right-click on any completed node
2. "Replay from here" option appears
3. Workflow re-executes from that step
4. Visual indicators show replay progress

## RJSF Integration Details

### 1. Package Installation

```bash
cd apps/web
bun add @rjsf/shadcn
```

### 2. RJSF Configuration

The workflow builder will use RJSF with Shadcn components for all form
interactions:

```typescript
import { Form } from "@rjsf/shadcn";
import { RJSFSchema, UiSchema } from "@rjsf/utils";

// Workflow input form
function WorkflowInputForm({
  schema,
  onSubmit,
  initialData,
}: WorkflowFormProps) {
  const uiSchema: UiSchema = {
    "ui:submitButtonOptions": {
      submitText: "Run Workflow",
      norender: false,
      props: {
        className: "w-full",
      },
    },
  };

  return (
    <Form
      schema={schema}
      uiSchema={uiSchema}
      formData={initialData}
      onSubmit={onSubmit}
      validator={validator}
    />
  );
}

// Tool configuration form
function ToolConfigDialog({ tool, onSave }: ToolConfigProps) {
  const schema = generateToolConfigSchema(tool);

  return (
    <Dialog>
      <DialogContent>
        <Form
          schema={schema}
          formData={tool.options}
          onSubmit={({ formData }) => onSave(formData)}
        />
      </DialogContent>
    </Dialog>
  );
}
```

### 3. Schema Generation

Dynamic schema generation for different form types:

```typescript
// Generate input schema form from workflow definition
function generateInputFormSchema(workflow: WorkflowDefinition): RJSFSchema {
  return {
    type: "object",
    title: `Input for ${workflow.name}`,
    description: workflow.description,
    properties: workflow.inputSchema.properties,
    required: workflow.inputSchema.required || [],
  };
}

// Generate tool configuration schema
function generateToolConfigSchema(tool: ToolDefinition): RJSFSchema {
  return {
    type: "object",
    title: `Configure ${tool.name}`,
    properties: {
      retry: {
        type: "number",
        title: "Retry Attempts",
        minimum: 0,
        default: 0,
      },
      timeout: {
        type: "number",
        title: "Timeout (ms)",
        minimum: 1000,
        default: 30000,
      },
      ...tool.customOptions, // Dynamic options based on tool type
    },
  };
}
```

### 4. Form Validation Integration

RJSF provides built-in validation that integrates seamlessly with the workflow
API:

```typescript
// Custom validator for workflow-specific validation
const workflowValidator = (formData: any, errors: any) => {
  // Custom validation logic
  if (formData.email && !formData.email.includes("@")) {
    errors.email.addError("Invalid email format");
  }
  return errors;
};
```

## Integration Points

### 1. Existing API Integration

- `SANDBOX_UPSERT_WORKFLOW`: For saving workflow definitions
- `SANDBOX_START_WORKFLOW`: For executing workflows
- `SANDBOX_GET_WORKFLOW_STATUS`: For monitoring execution
- `SANDBOX_REPLAY_WORKFLOW_FROM_STEP`: For partial execution
- `SANDBOX_LIST_WORKFLOWS`: For loading existing workflows

### 2. Integration with Existing Systems

- **Integrations API**: For tool selection and configuration
- **MCP Tools**: For tool discovery and metadata
- **AI Generation**: For workflow enhancement and code generation

## Future Enhancements

### 1. Advanced Features

- **Conditional Flows**: Support for branching logic
- **Parallel Execution**: Multiple paths running simultaneously
- **Error Handling**: Retry logic and error recovery flows
- **Sub-workflows**: Nested workflow execution
- **Templates**: Pre-built workflow templates

### 2. Collaboration Features

- **Version Control**: Workflow versioning and history
- **Sharing**: Share workflows between users
- **Comments**: Annotations on workflow steps
- **Real-time Collaboration**: Multiple users editing simultaneously

### 3. Performance Optimizations

- **Lazy Loading**: Load workflow components on demand
- **Caching**: Cache workflow definitions and execution results
- **Optimistic Updates**: Immediate UI feedback for better UX

## Implementation Priority

### Phase 1: Core Functionality

1. URL routing setup for `/:org/:project/workflows/:workflow-name`
2. Workflow loading and initialization
3. Basic React Flow canvas setup
4. Tool and mapper node creation
5. Auto-mapper generation on connection
6. Basic workflow generation and saving

### Phase 2: Execution Features

1. Workflow execution UI
2. Real-time progress tracking
3. Step replay functionality
4. Results display

### Phase 3: Polish and Enhancement

1. Advanced node configuration
2. Workflow templates
3. Error handling and validation
4. Performance optimizations

This implementation will create a powerful, user-friendly workflow builder that
rivals other well-known web-based workflow systems while integrating seamlessly
with the existing deco.chat architecture.

## Documentation and Resources

### React Flow Documentation

#### Core Documentation

- **Official React Flow Documentation**: https://reactflow.dev/docs
- **Getting Started Guide**: https://reactflow.dev/learn/getting-started
- **API Reference**: https://reactflow.dev/api-reference
- **GitHub Repository**: https://github.com/xyflow/xyflow

#### Key Concepts and Tutorials

- **Node Types**: https://reactflow.dev/learn/customization/node-types
- **Edge Types**: https://reactflow.dev/learn/customization/edge-types
- **Controls and Background**:
  https://reactflow.dev/learn/customization/controls
- **Minimap**: https://reactflow.dev/learn/customization/minimap
- **Background Patterns**: https://reactflow.dev/learn/customization/background
- **Custom Handles**: https://reactflow.dev/learn/customization/handles
- **Node Positioning**:
  https://reactflow.dev/learn/customization/node-positioning

#### Advanced Features

- **Subflows**: https://reactflow.dev/learn/advanced/subflows
- **Node Resizing**: https://reactflow.dev/learn/customization/node-resizing
- **Node Selection**: https://reactflow.dev/learn/customization/node-selection
- **Edge Selection**: https://reactflow.dev/learn/customization/edge-selection
- **Keyboard Shortcuts**:
  https://reactflow.dev/learn/advanced/keyboard-shortcuts
- **Touch Device Support**: https://reactflow.dev/learn/advanced/touch-devices

#### Examples and Use Cases

- **Workflow Builder Example**: https://reactflow.dev/examples/workflow-builder
- **Node Editor Example**: https://reactflow.dev/examples/node-editor
- **Custom Node Example**: https://reactflow.dev/examples/custom-node
- **Drag and Drop**: https://reactflow.dev/examples/drag-and-drop
- **Node Resizer**: https://reactflow.dev/examples/node-resizer
- **All Examples**: https://reactflow.dev/examples

### React JSON Schema Form (RJSF) Documentation

#### Core Documentation

- **Official RJSF Documentation**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/
- **Quickstart Guide**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/quickstart/
- **GitHub Repository**: https://github.com/rjsf-team/react-jsonschema-form

#### Shadcn Integration

- **RJSF Shadcn Package**: https://www.npmjs.com/package/@rjsf/shadcn
- **RJSF 6.x Upgrade Guide**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/migration-guides/v6.x%20upgrade%20guide/
- **Shadcn Integration Discussion**:
  https://github.com/rjsf-team/react-jsonschema-form/issues/4213

#### Advanced Customization

- **Custom Widgets**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets
- **Custom Fields**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-fields
- **Custom Templates**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-templates
- **Custom Validators**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-validators
- **UI Schema**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/ui-schema

#### Form Builder Tools

- **React JSON Schema Form Builder**:
  https://react-json-schema-form-builder.readthedocs.io/
- **Shadcn Form Builder**: https://www.shadcn-form.com/

### Additional Resources

#### React Hook Form (Backup Form Handling)

- **Official Documentation**: https://react-hook-form.com/
- **Advanced React Forms Tutorial**:
  https://wasp.sh/blog/2025/01/22/advanced-react-hook-form-zod-shadcn

#### Zod Validation

- **Official Documentation**: https://zod.dev/
- **Schema Validation Guide**: https://zod.dev/?id=basic-usage

#### Shadcn UI Components

- **Official Documentation**: https://ui.shadcn.com/
- **Components Reference**: https://ui.shadcn.com/docs/components

### Implementation Examples

#### React Flow Workflow Builders

- **Flow Builder Example**:
  https://github.com/xyflow/xyflow/tree/main/example/src/WorkflowBuilder
- **Node Editor Example**:
  https://github.com/xyflow/xyflow/tree/main/example/src/NodeEditor
- **Custom Node Example**:
  https://github.com/xyflow/xyflow/tree/main/example/src/CustomNode

#### RJSF with Shadcn Examples

- **Basic Form Example**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/quickstart/
- **Custom Widget Example**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets

### Best Practices and Patterns

#### React Flow Best Practices

1. **Node Types**: Create reusable node types for different workflow elements
2. **Edge Types**: Use different edge types for different connection types
3. **State Management**: Keep React Flow state separate from business logic
4. **Performance**: Use React.memo for custom nodes to prevent unnecessary
   re-renders
5. **Accessibility**: Ensure keyboard navigation and screen reader support

#### RJSF Best Practices

1. **Schema Design**: Keep schemas simple and well-structured
2. **Validation**: Use both JSON Schema validation and custom validators
3. **UI Schema**: Leverage UI schema for better form layout and UX
4. **Custom Components**: Create custom widgets for complex form elements
5. **Error Handling**: Provide clear error messages and validation feedback

#### Integration Patterns

1. **Form Integration**: Use RJSF for configuration dialogs and input forms
2. **State Synchronization**: Keep React Flow state in sync with workflow
   definitions
3. **API Integration**: Use existing SDK hooks for workflow operations
4. **Error Boundaries**: Implement proper error handling for both React Flow and
   RJSF
5. **Loading States**: Provide loading indicators for async operations

### Troubleshooting Resources

#### Common React Flow Issues

- **Node Positioning**:
  https://reactflow.dev/learn/customization/node-positioning
- **Edge Routing**: https://reactflow.dev/learn/customization/edge-types
- **Performance Issues**: https://reactflow.dev/learn/advanced/performance

#### Common RJSF Issues

- **Schema Validation**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-validators
- **Custom Widgets**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/advanced-customization/custom-widgets
- **Theme Integration**:
  https://rjsf-team.github.io/react-jsonschema-form/docs/migration-guides/v6.x%20upgrade%20guide/

### Community and Support

#### React Flow

- **GitHub Issues**: https://github.com/xyflow/xyflow/issues
- **Discord Community**: https://discord.gg/Bqt6xrs
- **Stack Overflow**: Tag: `react-flow`

#### RJSF

- **GitHub Issues**: https://github.com/rjsf-team/react-jsonschema-form/issues
- **Stack Overflow**: Tag: `react-jsonschema-form`

This comprehensive documentation provides all the necessary resources for
implementing the Workflow Builder UI feature, from basic setup to advanced
customization and troubleshooting.

## Implementation Clarifications

### Tool Discovery and Selection

- **Reuse Existing UI**: The workflow builder will reuse the existing "Add
  Integration" dialog from agent creation
- **Familiar Interface**: Users will see the same tool selection interface
  they're already familiar with
- **No New Discovery Logic**: Leverage existing integration and tool discovery
  mechanisms

### Auto-Mapper Generation Strategy

- **Always Insert Mappers**: Every connection between tools will automatically
  insert a mapper node
- **Identity Functions**: When data types match, generate simple identity
  functions (`x => x`)
- **Transformation Functions**: When data types don't match, generate
  transformation logic with TODO comments
- **Explicit Data Flow**: This ensures all data transformations are visible and
  configurable

### AI Integration Details

- **Service**: Use existing `MCPClient['AI_GATEWAY'].AI_GENERATE_OBJECT`
- **Prompt Strategy**: Send detailed prompts similar to sandbox workflow
  creation tool
- **Enhancement Focus**: AI will enhance and complete workflow definitions, not
  create from scratch
- **Schema Compliance**: AI output will be validated against
  WorkflowDefinitionSchema

### RJSF Shadcn Integration

- **Beta Package**: Use `@rjsf/shadcn@^6.0.0-beta.10` as specified
- **Stable Integration**: The beta package is stable enough for production use
- **No Fallback Needed**: RJSF Shadcn integration will work as expected

### URL Routing

- **Single Pattern**: Use `/:org/:project/workflows/:workflow-name` for direct
  editing
- **No Edit Route**: No need for separate `/edit` route - the main route handles
  editing
- **Early Stage Access**: Feature accessible only by typing URL directly in
  browser

### State Management Strategy

- **React Flow State**: Handle visual canvas state (nodes, edges, positions)
- **Workflow State**: Manage workflow definition and execution state
- **Form State**: Use RJSF for all form interactions
- **Synchronization**: Keep states synchronized through well-defined interfaces

### Error Handling Approach

- **Graceful Degradation**: Handle missing workflows by creating empty ones
- **Validation Errors**: Show clear error messages for invalid configurations
- **AI Generation Failures**: Fallback to basic workflow definition if AI
  generation fails
- **Execution Errors**: Display execution errors in the execution panel

### Performance Considerations

- **Canvas Optimization**: Use React.memo for custom nodes to prevent
  unnecessary re-renders
- **Large Workflows**: Implement node virtualization for workflows with many
  nodes
- **Memory Management**: Clean up old workflow runs to prevent memory leaks
- **Lazy Loading**: Load workflow components on demand

These clarifications ensure a clear and consistent implementation approach that
leverages existing infrastructure while providing a powerful new workflow
building capability.
