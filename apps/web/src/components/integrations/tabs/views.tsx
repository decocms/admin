import {
  buildAddViewPayload,
  findPinnedView,
  useAddView,
  useRemoveView,
  useTools,
  type Integration,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useMemo, useState } from "react";
import { useCurrentTeam } from "../../sidebar/team-selector.tsx";

// V2 Views UI with add/remove functionality
export function ViewsV2UI({ integration }: { integration: Integration }) {
  const connection = integration.connection;
  const { data: toolsData, isLoading: isLoadingTools } = useTools(connection);
  const [term, setTerm] = useState("");
  const currentTeam = useCurrentTeam();
  const addViewMutation = useAddView();
  const removeViewMutation = useRemoveView();

  const viewTools = useMemo(() => {
    return toolsData.tools.filter((t) => /^DECO_VIEW_RENDER_.+/.test(t.name));
  }, [toolsData.tools]);

  // Process all views and add status information
  const viewsWithStatus = useMemo(() => {
    if (!viewTools || viewTools.length === 0 || !currentTeam.views) return [];
    return viewTools.map((tool) => {
      const match = tool.name.match(/^DECO_VIEW_RENDER_(.+)$/);
      const viewName = match?.[1] ?? tool.name;

      // Check if inputSchema is empty (no parameters required)
      const schema = tool.inputSchema;
      const hasEmptySchema =
        schema &&
        typeof schema === "object" &&
        (!(schema as { properties?: Record<string, unknown> }).properties ||
          Object.keys(
            (schema as { properties?: Record<string, unknown> }).properties ||
              {},
          ).length === 0);

      // Check if this view is already added to the team (only for empty schema views)
      const existingView = hasEmptySchema
        ? findPinnedView(currentTeam.views, integration.id, {
            name: viewName,
            url: `/view/${integration.id}/${viewName}`, // Construct the expected URL
          })
        : null;

      return {
        ...tool,
        viewName,
        hasEmptySchema,
        isAdded: !!existingView,
        teamViewId: existingView?.id,
      } as typeof tool & {
        viewName: string;
        hasEmptySchema: boolean;
        isAdded: boolean;
        teamViewId?: string;
      };
    });
  }, [viewTools, currentTeam.views, integration.id]);

  const filtered = useMemo(() => {
    const q = term.toLowerCase();
    if (!q) return viewsWithStatus;
    return viewsWithStatus.filter(
      (t) =>
        t.viewName.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q),
    );
  }, [term, viewsWithStatus]);

  function getParamNames(schema: unknown): string[] {
    if (!schema || typeof schema !== "object") return [];
    const props = (schema as { properties?: Record<string, unknown> })
      .properties;
    if (!props || typeof props !== "object") return [];
    return Object.keys(props);
  }

  const handleAddView = async (tool: (typeof viewsWithStatus)[0]) => {
    try {
      await addViewMutation.mutateAsync({
        view: buildAddViewPayload({
          view: {
            name: tool.viewName,
            title: tool.viewName,
            icon: "layers", // Default icon for views
            url: `/view/${integration.id}/${tool.viewName}`,
          },
          integrationId: integration.id,
        }),
      });
      toast.success(`View "${tool.viewName}" added successfully`);
    } catch (error) {
      console.error("Error adding view:", error);
      toast.error(`Failed to add view "${tool.viewName}"`);
    }
  };

  const handleRemoveView = async (tool: (typeof viewsWithStatus)[0]) => {
    if (!tool.teamViewId) {
      toast.error("No view to remove");
      return;
    }
    try {
      await removeViewMutation.mutateAsync({ viewId: tool.teamViewId });
      toast.success(`View "${tool.viewName}" removed successfully`);
    } catch (error) {
      console.error("Error removing view:", error);
      toast.error(`Failed to remove view "${tool.viewName}"`);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search views..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <ScrollArea className="flex-1 h-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
          {isLoadingTools
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))
            : filtered.map((tool) => {
                const params = getParamNames(tool.inputSchema);

                return (
                  <Card
                    key={tool.name}
                    className="p-4 rounded-xl border-border"
                  >
                    <div className="flex flex-col justify-between gap-2 w-full h-full">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold truncate">
                          {tool.viewName}
                        </div>
                        {tool.hasEmptySchema && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {tool.isAdded && (
                              <div className="flex items-center gap-1 text-xs text-success">
                                <Icon name="check_circle" size={14} />
                                <span>Added</span>
                              </div>
                            )}
                            {tool.isAdded ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive h-6 px-2"
                                onClick={() => handleRemoveView(tool)}
                                disabled={removeViewMutation.isPending}
                              >
                                {removeViewMutation.isPending ? (
                                  <Icon name="hourglass_empty" size={12} />
                                ) : (
                                  <Icon name="remove" size={12} />
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => handleAddView(tool)}
                                disabled={addViewMutation.isPending}
                              >
                                {addViewMutation.isPending ? (
                                  <Icon name="hourglass_empty" size={12} />
                                ) : (
                                  <Icon name="add" size={12} />
                                )}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {tool.description && (
                        <div className="text-sm text-muted-foreground line-clamp-2 flex-1">
                          {tool.description}
                        </div>
                      )}
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {params.length > 0 &&
                          params.map((p) => (
                            <div
                              key={p}
                              className="px-2 py-1 rounded-md text-xs bg-muted text-muted-foreground border border-border"
                            >
                              {p}
                            </div>
                          ))}
                        {params.length === 0 && tool.hasEmptySchema && (
                          // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
                          <div className="px-2 py-1 rounded-md text-xs bg-green-100 text-green-700 border border-green-200">
                            No parameters required
                          </div>
                        )}
                        {params.length === 0 && !tool.hasEmptySchema && (
                          // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
                          <div className="px-2 py-1 rounded-md text-xs bg-orange-100 text-orange-700 border border-orange-200">
                            Parameters required
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
        </div>
      </ScrollArea>
    </div>
  );
}
