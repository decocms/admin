import { useState } from "react";
import { ChevronDown, ChevronRight, Code, Edit, Play } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { useWorkflowContext } from "../../../contexts/workflow-context.tsx";
import type { WorkflowStep } from "@deco/sdk";

export function StepSlide({ step }: { step: WorkflowStep }) {
  const { state, executeStep, startEditing } = useWorkflowContext();
  const executionResult = state.executionResults[step.id];
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="h-full flex items-center justify-center p-12">
      <div className="max-w-4xl w-full space-y-8">
        {/* Step Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">{step.title}</h1>
          {step.description && (
            <p className="text-xl text-gray-600">{step.description}</p>
          )}
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
          {/* Prompt Display */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Prompt
            </h3>
            <p className="text-lg text-gray-800 leading-relaxed">
              {step.prompt}
            </p>
          </div>

          {/* Tools Used */}
          {step.usedTools && step.usedTools.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Tools Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {step.usedTools.map((tool, idx) => (
                  <Badge key={idx} variant="secondary">
                    {tool.integrationId}.{tool.toolName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Generated Code (Collapsible) */}
          {step.code && (
            <Collapsible open={showCode} onOpenChange={setShowCode}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors">
                {showCode ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Code className="w-4 h-4" />
                Generated Code
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-3 p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm">
                  <code>{step.code}</code>
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Execution Result */}
          {executionResult && (
            <div
              className={`
                p-4 rounded-lg border-2
                ${
                  executionResult.error
                    ? "bg-red-50 border-red-200"
                    : "bg-green-50 border-green-200"
                }
              `}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-2">
                {executionResult.error ? (
                  <span className="text-red-700">Execution Error</span>
                ) : (
                  <span className="text-green-700">Execution Result</span>
                )}
              </h3>
              <pre className="text-sm overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(
                  executionResult.error || executionResult.value,
                  null,
                  2,
                )}
              </pre>
              <p className="text-xs text-gray-500 mt-3">
                Executed at{" "}
                {new Date(executionResult.executedAt).toLocaleString()}
                {executionResult.duration && ` • ${executionResult.duration}ms`}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            variant="outline"
            onClick={() => startEditing(step.id)}
            className="min-w-[140px]"
          >
            <Edit className="w-5 h-5 mr-2" />
            Edit Step
          </Button>

          <Button
            size="lg"
            onClick={() => executeStep(step.id)}
            disabled={state.isExecuting}
            className="min-w-[140px]"
          >
            {state.isExecuting ? (
              <>
                <Spinner className="w-5 h-5 mr-2" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Test Step
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
