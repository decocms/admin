import { Button } from "@deco/ui/components/button.js";
import { Icon } from "@deco/ui/components/icon.js";
import { useState } from "react";
import { WorkflowStep } from "shared/types/workflows";

export function StepOutput({ step }: { step: WorkflowStep["result"] }) {
  const [activeView, setActiveView] = useState<string>("json");

  const jsonString =
  typeof step?.output === "object"
    ? JSON.stringify(step.output, null, 2)
    : String(step?.output);
const lines = jsonString.split("\n");
  return (
    <div className="bg-background border-b border-border p-4 flex flex-col gap-3 relative">
      <div
        className="nodrag"
        style={{ cursor: "default" }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with metrics */}
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-sm text-muted-foreground uppercase">
            EXECUTION RESULT
          </p>
          <div className="flex items-center gap-2 px-1">
            {step?.duration && (
              <div className="flex items-center gap-1">
                <Icon
                  name="schedule"
                  size={16}
                  className="text-purple-light"
                />
                <span className="font-mono text-sm text-muted-foreground">
                  {step.duration}ms
                </span>
              </div>
            )}
          </div>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-2 py-2 flex-wrap">
          <Button
            variant={activeView === "json" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveView("json")}
            className="h-8 px-3"
          >
            JSON
          </Button>
        </div>

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

      </div>
    </div>
  )
}