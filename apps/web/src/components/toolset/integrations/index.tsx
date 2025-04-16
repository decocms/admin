import type { Integration, MCPTool } from "@deco/sdk";
import { useTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { FormControl, FormItem, FormLabel } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary } from "../../../ErrorBoundary.tsx";
import { Description } from "./description.tsx";
import { Header } from "./header.tsx";
import { SchemaDisplay, type SchemaProperty } from "./schema-display.tsx";

interface Props {
  integration: Integration;
  setTools: (integrationId: string, toolSet?: string[]) => void;
  toolset: Record<string, string[]>;
}

export function Integration(props: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const allProps = { ...props, isExpanded, setIsExpanded };

  return (
    <ErrorBoundary fallback={<IntegrationError {...allProps} />}>
      <Suspense fallback={<IntegrationSkeleton {...allProps} />}>
        <IntegrationUI {...allProps} />
      </Suspense>
    </ErrorBoundary>
  );
}

interface StatefulProps {
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
}

function IntegrationSkeleton({ isExpanded, setIsExpanded }: StatefulProps) {
  return (
    <div className="rounded-lg border bg-gradient-to-b from-white to-slate-50">
      <Header.Skeleton
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
      />
      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start space-x-3">
              <Skeleton className="h-4 w-4" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationError({
  integration,
  setIsExpanded,
  isExpanded,
}: Props & StatefulProps) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50">
      <Header.Error
        integration={integration}
        setIsExpanded={setIsExpanded}
        isExpanded={isExpanded}
      />
      {isExpanded && (
        <div className="border-t border-red-300 p-4">
          <div className="flex items-center space-x-2 text-red-400">
            <Icon name="cancel" />
            <p className="text-xs">
              Failed to load tools for{" "}
              {integration.name}. Please try again later.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationUI({
  integration,
  setTools,
  toolset,
  isExpanded,
  setIsExpanded,
}: Props & StatefulProps) {
  const [schemaFor, setSchemaFor] = useState<MCPTool | null>(null);
  const { data: toolsData } = useTools(integration.connection);
  const allTools = toolsData?.tools?.map((t) => t.name) || [];

  const enabledTools: string[] = useMemo(() => {
    const enabled = toolset[integration.id];

    if (enabled?.length === 0) {
      return allTools;
    }

    const set = new Set(enabled);

    return allTools.filter((tool) => set.has(tool));
  }, [toolset, toolsData, integration.id]);

  const totalTools = toolsData?.tools?.length || 0;
  const totalEnabled = enabledTools.length;

  return (
    <div className="rounded-lg border">
      <Header
        setTools={setTools}
        isExpanded={isExpanded}
        integration={integration}
        setIsExpanded={setIsExpanded}
        numberOfEnabledTools={totalEnabled}
        totalNumberOfTools={totalTools}
        tools={allTools}
      />
      {isExpanded && (
        <div className="border-t space-y">
          {schemaFor
            ? (
              <div className="space-y-4 p-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSchemaFor(null)}
                    className="gap-2"
                  >
                    <Icon name="arrow_back" size={16} />
                    Back to tools
                  </Button>
                </div>
                <div className="space-y-4">
                  <SchemaDisplay
                    title="Input Schema"
                    schema={schemaFor.inputSchema as SchemaProperty}
                  />
                </div>
              </div>
            )
            : (
              <div className="space-y">
                {toolsData.tools.map((tool: MCPTool) => {
                  const id = `${integration.id}-${tool.name}`;
                  const index = enabledTools.indexOf(tool.name);

                  return (
                    <FormItem
                      key={id}
                      className="grid grid-rows-[auto_auto] grid-cols-[auto_1fr_auto] gap-2 items-center justify-center hover:bg-slate-100 p-4"
                    >
                      <div>
                        <FormControl>
                          <Checkbox
                            id={id}
                            checked={index !== -1}
                            onCheckedChange={() => {
                              setTools(
                                integration.id,
                                index === -1
                                  ? [...enabledTools, tool.name]
                                  : enabledTools.filter((_, i) => i !== index),
                              );
                            }}
                            className="cursor-pointer"
                          />
                        </FormControl>
                      </div>

                      <FormLabel
                        htmlFor={id}
                        className="text-xs font-medium leading-none truncate cursor-pointer"
                      >
                        {tool.name}
                      </FormLabel>

                      <div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            setSchemaFor(tool);
                          }}
                          className="text-xs w-auto flex-none whitespace-nowrap"
                        >
                          View Schema
                        </Button>
                      </div>
                      <div className="col-span-3 col-start-1 row-start-2">
                        <Description
                          description={tool.description ?? ""}
                        />
                      </div>
                    </FormItem>
                  );
                })}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
