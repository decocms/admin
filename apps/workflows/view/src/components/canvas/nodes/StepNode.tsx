import { type NodeProps, useStore, Handle, Position } from "reactflow";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { useExecuteStep } from "../../../hooks/useExecuteStep";
import { useState } from "react";
import { RichTextEditor } from "../../RichTextEditor";
import { RenderInputViewModal } from "../../RenderInputViewModal";
import { useCurrentWorkflow } from "@/store/workflow";

interface StepNodeData {
  stepId: string;
}

export function StepNode({ data }: NodeProps<StepNodeData>) {
  const zoom = useStore((s) => s.transform[2]);
  const [showJsonView, setShowJsonView] = useState(false);
  const [_creatingInputViewFor, setCreatingInputViewFor] = useState<
    string | null
  >(null);
  const [renderingInputView, setRenderingInputView] = useState<{
    fieldName: string;
    viewName: string;
    viewCode: string;
  } | null>(null);
  const workflow = useCurrentWorkflow()
  const step = workflow?.steps?.find((s) => s.name === data.stepId)

  const executeStepMutation = useExecuteStep();

  const compact = zoom < 0.7;

  if (!step) return null;

  if (compact) {
    return (
      <div className="rounded-xl border bg-card p-3 w-[320px] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle
          type="source"
          position={Position.Right}
          style={{ opacity: 0 }}
        />
        <div className="flex items-start gap-2">
          {(
            <Icon
              name={"build"}
              size={18}
              className="text-muted-foreground flex-shrink-0 mt-0.5"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {step.name}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {step.description}
            </div>
          </div>
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-muted-foreground`
          }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-foreground border border-border rounded-xl p-[2px] w-[640px]">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Header */}
      <div className="flex items-center justify-between h-10 px-4 py-2 rounded-t-xl overflow-clip">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {(
            <Icon
              name={"build"}
              size={16}
              className="shrink-0 text-background"
            />
          )}
          <span className="text-sm font-medium text-background leading-5 truncate">
            {step.name}
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowJsonView(!showJsonView)}
            className="size-5 flex items-center justify-center hover:opacity-70 transition-opacity nodrag"
            title={showJsonView ? "Show form view" : "Show JSON view"}
          >
            <Icon name="code" size={20} className="text-muted-foreground" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="size-5 flex items-center justify-center hover:opacity-70 transition-opacity nodrag"
              >
                <Icon
                  name="more_horiz"
                  size={20}
                  className="text-muted-foreground"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (workflow) void 0;
                }}
              >
                <Icon name="content_copy" size={16} className="mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const newTitle = prompt("Enter new name:", step.name);
                  if (newTitle && workflow) {
                    void 0;
                  }
                }}
              >
                <Icon name="edit" size={16} className="mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (workflow && confirm(`Delete step "${step.name}"?`)) {
                    void 0;
                  }
                }}
                className="text-destructive"
              >
                <Icon name="delete" size={16} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col rounded-xl overflow-hidden">
        {showJsonView ? (
          <div className="bg-background p-4">
            {(() => {
              const jsonString = JSON.stringify(step, null, 2);
              const lines = jsonString.split("\n");

              return (
                <div
                  className="border border-border rounded"
                  style={{
                    height: "400px",
                    overflowY: "auto",
                    overflowX: "hidden",
                    cursor: "text",
                    pointerEvents: "auto",
                  }}
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div className="flex gap-5 p-2">
                    {/* Line numbers */}
                    <div className="flex flex-col font-mono text-sm text-muted-foreground leading-[1.5] opacity-50 select-none">
                      {lines.map((_, i) => (
                        <span key={i + 1}>{i + 1}</span>
                      ))}
                    </div>

                    {/* Code content */}
                    <div className="flex-1">
                      <pre className="font-mono text-sm text-foreground leading-[1.5] m-0 whitespace-pre-wrap break-words">
                        {jsonString}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Tools Used Section */}
            {step.dependencies && step.dependencies.length > 0 && (
              <div className="bg-background border-b border-border p-4">
                <p className="font-mono text-sm text-muted-foreground uppercase mb-4">
                  TOOLS USED
                </p>
                <div className="flex gap-3 flex-wrap">
                  {step.dependencies.map((tool) => (
                    <Badge
                      key={tool.integrationId}
                      variant="secondary"
                      className="bg-muted border border-border px-1 py-0.5 text-foreground text-sm font-normal gap-1"
                    >
                      <div className="size-4 bg-background border border-border/20 rounded-md flex items-center justify-center">
                        <Icon name="build" size={12} />
                      </div>
                      {tool.integrationId}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Input Parameters Section */}
            {step.inputSchema && (
              <div className="bg-background border-b border-border p-4">
                <div
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="font-mono text-sm text-muted-foreground uppercase mb-4">
                    INPUT PARAMETERS
                  </p>
                  <div className="flex flex-col gap-5">
                    {Object.entries(
                      (step.inputSchema as Record<string, unknown>)
                        .properties || {},
                    ).map(([key, schema]: [string, unknown]) => {
                      const schemaObj = schema as Record<string, unknown>;
                      const description =
                        typeof schemaObj.description === "string"
                          ? schemaObj.description
                          : "";
                      const inputKey = `${step.name}_${key}`;

                      return (
                        <div key={`${inputKey}_wrapper`}>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-foreground leading-none">
                              {key}
                            </label>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setCreatingInputViewFor(key)}
                              className="text-xs h-6 px-2"
                            >
                              + Add View
                            </Button>
                          </div>

                          <RichTextEditor
                            key={inputKey}
                            placeholder={description || `Enter ${key}...`}
                            minHeight="40px"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Execute Button Section */}
        <div className="bg-background border-b border-border flex items-center justify-end gap-2 p-4">
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={() => {
                executeStepMutation.mutate({
                  step: {
                    id: step.name,
                    name: step.name,
                    code: step.execute,
                    inputSchema: step.inputSchema,
                    outputSchema: step.outputSchema,
                    input: step.input,
                  },
                  authToken: workflow.authorization?.token,
                });
              }}
              disabled={executeStepMutation.isPending}
              className="bg-primary-light text-primary-dark hover:bg-[#c5e015] h-8 px-3 py-2 rounded-xl text-sm font-medium leading-5 nodrag"
            >
              {executeStepMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-dark/20 border-t-primary-dark rounded-full animate-spin" />
                  Executing...
                </span>
              ) : (
                "Execute step"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Render Input View Modal */}
      {renderingInputView && workflow && step && (
        <RenderInputViewModal
          step={step}
          fieldName={renderingInputView.fieldName}
          viewName={renderingInputView.viewName}
          viewCode={renderingInputView.viewCode}
          open={!!renderingInputView}
          onOpenChange={(open) => {
            if (!open) setRenderingInputView(null);
          }}
          onSubmit={(data) => {
            console.log("📝 [StepNode] Input view submitted:", data);

            // Update the field value
          }}
        />
      )}
    </div>
  );
}
