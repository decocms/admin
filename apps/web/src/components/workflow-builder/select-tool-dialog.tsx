import {
  type Integration,
  type MCPConnection,
  useIntegrations,
  useTools,
} from "@deco/sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useDeferredValue, useMemo, useState } from "react";
import { IntegrationIcon } from "../integrations/common.tsx";

interface Tool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  integration: Integration;
}

interface SelectToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTool: (tool: Tool) => void;
}

export function SelectToolDialog({
  open,
  onOpenChange,
  onSelectTool,
}: SelectToolDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);

  const { data: integrations = [] } = useIntegrations();

  // Filter integrations that have tools
  const integrationsWithTools = useMemo(() => {
    return integrations.filter(
      (integration) =>
        integration.connection &&
        ["HTTP", "SSE", "Websocket", "INNATE", "Deco"].includes(
          integration.connection.type,
        ),
    );
  }, [integrations]);

  const selectedIntegration = useMemo(() => {
    return (
      integrationsWithTools.find((i) => i.id === selectedIntegrationId) ||
      integrationsWithTools[0]
    );
  }, [integrationsWithTools, selectedIntegrationId]);

  // Get tools for the selected integration
  const { data: toolsData } = useTools(
    selectedIntegration?.connection as MCPConnection,
  );
  const tools = toolsData?.tools || [];

  // Filter tools based on search term
  const filteredTools = useMemo(() => {
    if (!deferredSearchTerm) return tools;
    const lowercaseSearch = deferredSearchTerm.toLowerCase();
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(lowercaseSearch) ||
        (tool.description &&
          tool.description.toLowerCase().includes(lowercaseSearch)),
    );
  }, [tools, deferredSearchTerm]);

  const handleToolSelect = (tool: Tool) => {
    if (selectedIntegration) {
      onSelectTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        integration: selectedIntegration,
      });
      onOpenChange(false);
    }
  };

  const handleIntegrationSelect = (integration: Integration) => {
    setSelectedIntegrationId(integration.id);
    setSearchTerm(""); // Clear search when switching integrations
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4/5 h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>Select Tool</DialogTitle>
        </DialogHeader>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Integration List - Left Side */}
          <div className="w-1/3 border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-sm mb-3">Integrations</h3>
              <Input
                placeholder="Search integrations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {integrationsWithTools.map((integration) => (
                <Card
                  key={integration.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accent",
                    selectedIntegrationId === integration.id &&
                      "bg-accent border-primary",
                  )}
                  onClick={() => handleIntegrationSelect(integration)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <IntegrationIcon
                        icon={integration.icon}
                        name={integration.name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {integration.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {integration.connection?.type}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Tools List - Right Side */}
          <div className="flex-1 flex flex-col">
            {selectedIntegration ? (
              <>
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <IntegrationIcon
                      icon={selectedIntegration.icon}
                      name={selectedIntegration.name}
                      size="sm"
                    />
                    <div>
                      <h3 className="font-medium text-sm">
                        {selectedIntegration.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {tools.length} tool{tools.length !== 1 ? "s" : ""}{" "}
                        available
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredTools.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Icon
                        name="search_off"
                        className="h-8 w-8 mx-auto mb-2"
                      />
                      <p>No tools found</p>
                      {deferredSearchTerm && (
                        <p className="text-xs">Try a different search term</p>
                      )}
                    </div>
                  ) : (
                    filteredTools.map((tool) => (
                      <Card
                        key={tool.name}
                        className="cursor-pointer transition-colors hover:bg-accent"
                        onClick={() =>
                          handleToolSelect({
                            ...tool,
                            integration: selectedIntegration!,
                          })
                        }
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Icon
                              name="build"
                              className="h-4 w-4 text-primary mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm mb-1">
                                {tool.name}
                              </div>
                              {tool.description && (
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {tool.description}
                                </div>
                              )}
                              {tool.inputSchema && (
                                <div className="mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {
                                      Object.keys(
                                        tool.inputSchema.properties || {},
                                      ).length
                                    }{" "}
                                    parameters
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Icon name="build" className="h-8 w-8 mx-auto mb-2" />
                  <p>Select an integration to view its tools</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
