import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Loader2 } from "lucide-react";
import type { MCP } from "@/web/hooks/collections/use-registry-mcps";

interface MCPResultsViewProps {
  tool: MCP;
  isLoading: boolean;
  error: Error | null;
  data: unknown;
  onBack: () => void;
}

export function MCPResultsView({
  tool,
  isLoading,
  error,
  data,
  onBack,
}: MCPResultsViewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-background border-b border-border p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-10 w-10"
            >
              <Icon name="arrow_back" size={20} />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-medium">{tool.title}</h1>
              {tool.description && (
                <p className="text-sm text-muted-foreground">
                  {tool.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="max-w-6xl mx-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  Loading results...
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon
                  name="error"
                  size={48}
                  className="text-destructive mb-4"
                />
                <h3 className="text-lg font-medium mb-2">
                  Error loading results
                </h3>
                <p className="text-muted-foreground max-w-md">
                  {error instanceof Error
                    ? error.message
                    : "Unknown error occurred"}
                </p>
                <Button variant="outline" onClick={onBack} className="mt-4">
                  Go back
                </Button>
              </div>
            ) : !data ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon
                  name="inbox"
                  size={48}
                  className="text-muted-foreground mb-4"
                />
                <h3 className="text-lg font-medium mb-2">No results</h3>
                <p className="text-muted-foreground">
                  The tool returned no results.
                </p>
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-4">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
