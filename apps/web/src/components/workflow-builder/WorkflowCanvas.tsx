import { WorkflowDefinitionSchema } from "@deco/sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Background,
  type Connection,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useWorkflowBuilder } from "@deco/sdk";
import type { WorkflowDefinition } from "@deco/sdk";
import { WorkflowPalette } from "./WorkflowPalette.tsx";
import { WorkflowToolbar } from "./WorkflowToolbar.tsx";
import { MapperNode } from "./nodes/MapperNode.tsx";
import { ToolNode } from "./nodes/ToolNode.tsx";

const nodeTypes: Record<string, any> = {
  tool: ToolNode,
  mapper: MapperNode,
};

interface WorkflowCanvasProps {
  workflow: WorkflowDefinition;
}

export function WorkflowCanvas({ workflow }: WorkflowCanvasProps) {
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);
  const form = useForm<WorkflowDefinition>({
    resolver: zodResolver(WorkflowDefinitionSchema as any),
    defaultValues: workflow,
    mode: "onChange",
  });

  const { formState, setValue, reset } = form;

  const {
    convertWorkflowToFlow,
    convertFlowToWorkflow,
    handleGenerateWorkflow,
    handleRunWorkflow,
  } = useWorkflowBuilder(workflow);

  // Convert workflow definition to React Flow nodes and edges
  useEffect(() => {
    reset(workflow, { keepDirty: false, keepTouched: false });
    const { nodes: flowNodes, edges: flowEdges } =
      convertWorkflowToFlow(workflow);
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [workflow, convertWorkflowToFlow, setNodes, setEdges, reset]);

  const syncStepsFromFlow = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const wf = convertFlowToWorkflow(nextNodes, nextEdges);
      setValue("steps" as any, wf.steps as any, {
        shouldDirty: true,
        shouldTouch: true,
      });
    },
    [convertFlowToWorkflow, setValue],
  );

  const handleNodesChange = useCallback(
    (changes: any) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        syncStepsFromFlow(updated, edges);
        return updated;
      });
    },
    [setNodes, edges, syncStepsFromFlow],
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        syncStepsFromFlow(nodes, updated);
        return updated;
      });
    },
    [setEdges, nodes, syncStepsFromFlow],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (sourceNode?.type === "tool" && targetNode?.type === "tool") {
        // Remove direct connection and insert mapper
        const newEdges = edges.filter(
          (e) =>
            !(e.source === connection.source && e.target === connection.target),
        );

        // Create mapper node
        const mapperId = `mapper-${Date.now()}`;
        const mapperNode: Node = {
          id: mapperId,
          type: "mapper",
          position: {
            x: (sourceNode.position.x + targetNode.position.x) / 2,
            y: (sourceNode.position.y + targetNode.position.y) / 2,
          },
          data: {
            type: "mapping",
            name: `map-${sourceNode.data.name}-to-${targetNode.data.name}`,
            description:
              "This mapper transforms the output from the previous step to match the input requirements of the next step",
            execute: `export default async function(ctx) {
  const input = await ctx.readStepResult('${sourceNode.data.name}');
  return input; // Identity transformation
}`,
            outputSchema: {},
          },
        };

        // Create new edges: source -> mapper -> target
        const newMapperEdges = [
          {
            id: `edge-${connection.source}-${mapperId}`,
            source: connection.source!,
            target: mapperId,
            type: "smoothstep",
          },
          {
            id: `edge-${mapperId}-${connection.target}`,
            source: mapperId,
            target: connection.target!,
            type: "smoothstep",
          },
        ];

        const nextNodes = [...nodes, mapperNode];
        const nextEdges = [...newEdges, ...newMapperEdges];
        setNodes(nextNodes);
        setEdges(nextEdges);
        syncStepsFromFlow(nextNodes, nextEdges);
      } else {
        // Regular connection
        const newEdge = {
          id: `edge-${connection.source}-${connection.target}`,
          source: connection.source!,
          target: connection.target!,
          type: "smoothstep",
        };
        const nextEdges = [...edges, newEdge];
        setEdges(nextEdges);
        syncStepsFromFlow(nodes, nextEdges);
      }
    },
    [nodes, edges, syncStepsFromFlow],
  );

  const handleGenerate = useCallback(async () => {
    const workflowDefinition = convertFlowToWorkflow(nodes, edges);
    await handleGenerateWorkflow(workflowDefinition);
    reset(workflowDefinition, { keepDirty: false, keepTouched: false });
  }, [nodes, edges, convertFlowToWorkflow, handleGenerateWorkflow, reset]);

  const handleRun = useCallback(async () => {
    const workflowDefinition = convertFlowToWorkflow(nodes, edges);
    await handleRunWorkflow(workflowDefinition);
  }, [nodes, edges, convertFlowToWorkflow, handleRunWorkflow]);

  // Function to add a tool to the canvas
  const handleAddTool = useCallback(
    (tool: any) => {
      const newNode: Node = {
        id: `tool-${Date.now()}`,
        type: "tool",
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
        },
        data: {
          type: "tool_call",
          name: tool.name,
          description: tool.description || `Tool: ${tool.name}`,
          tool_name: tool.name,
          integration: tool.integration.name,
          options: tool.inputSchema || {},
        },
      };

      const nextNodes = [...nodes, newNode];
      setNodes(nextNodes);
      syncStepsFromFlow(nextNodes, edges);
    },
    [setNodes, nodes, edges, syncStepsFromFlow],
  );

  // Function to add a mapper to the canvas
  const handleAddMapper = useCallback(
    (mapperData: any) => {
      const newNode: Node = {
        id: `mapper-${Date.now()}`,
        type: "mapper",
        position: {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
        },
        data: {
          type: "mapping",
          name: mapperData.name || "New Mapper",
          description:
            mapperData.description || "Transform data between workflow steps",
          execute:
            mapperData.execute ||
            `export default async function(ctx) {
  const input = await ctx.readStepResult('previous-step');
  return input; // Identity transformation
}`,
          outputSchema: mapperData.outputSchema || {},
        },
      };

      const nextNodes = [...nodes, newNode];
      setNodes(nextNodes);
      syncStepsFromFlow(nextNodes, edges);
    },
    [setNodes, nodes, edges, syncStepsFromFlow],
  );

  return (
    <div className="h-screen w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <WorkflowToolbar
          isDirty={formState.isDirty}
          onGenerate={handleGenerate}
          onRun={handleRun}
        />
        <WorkflowPalette
          onAddTool={handleAddTool}
          onAddMapper={handleAddMapper}
        />
      </ReactFlow>
    </div>
  );
}
