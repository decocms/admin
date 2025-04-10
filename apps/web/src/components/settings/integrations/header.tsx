import type { Integration } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { IntegrationIcon } from "./icon.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

export function IntegrationHeader({
  integration,
  tools,
  isAllSelected,
  setIntegrationTools,
  isExpanded,
  setIsExpanded,
}: {
  integration: Integration;
  tools: string[];
  isAllSelected: boolean;
  setIntegrationTools: (tools: string[]) => void;
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setIsExpanded(!isExpanded)}
      className="w-full p-4 hover:bg-accent/50 transition-colors"
    >
      <div className="flex w-full items-center gap-2 min-w-0">
        <Icon
          name="chevron_right"
          className={cn(
            "text-muted-foreground transition-transform cursor-pointer",
            isExpanded ? "rotate-90" : "",
          )}
        />
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <IntegrationIcon icon={integration.icon} name={integration.name} />
          <h3 className="font-medium text-base truncate">{integration?.name}</h3>
        </div>
        <div className="flex items-center gap-4 ml-auto whitespace-nowrap">
          {tools.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${integration?.id}-select-all`}
                checked={isAllSelected}
                onChange={(e) => {
                  setIntegrationTools(e.target.checked ? tools : []);
                }}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
              />
              <label
                htmlFor={`${integration?.id}-select-all`}
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Select all
              </label>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

IntegrationHeader.Skeleton = ({
  isExpanded,
  setIsExpanded,
}: {
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => setIsExpanded(!isExpanded)}
    className="w-full p-4 hover:bg-accent/50 transition-colors"
  >
    <div className="flex w-full items-center justify-between gap-2">
      <Icon
        name="chevron_right"
        className={cn(
          "text-muted-foreground transition-transform",
          isExpanded ? "rotate-90" : "",
        )}
      />
      <div className="flex items-center gap-2 flex-grow">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  </button>
);

IntegrationHeader.Error = ({
  integration,
  setIsExpanded,
  isExpanded,
}: {
  integration: Integration;
  setIsExpanded: (isExpanded: boolean) => void;
  isExpanded: boolean;
}) => (
  <button
    type="button"
    onClick={() => setIsExpanded(!isExpanded)}
    className="w-full p-4 hover:bg-red-100/50 transition-colors"
  >
    <div className="flex w-full items-center justify-between gap-2">
      <Icon
        name="chevron_right"
        className={cn(
          "text-muted-foreground transition-transform",
          isExpanded ? "rotate-90" : "",
        )}
      />
      <div className="flex items-center gap-2 flex-grow">
        <IntegrationIcon icon={integration.icon} name={integration.name} />
        <h3 className="font-medium text-base">{integration.name}</h3>
      </div>

      <div className="flex items-center gap-2">
        <Icon name="cancel" className="text-xs text-red-500" size={16} />
        <span className="text-sm text-red-500">Error</span>
      </div>
    </div>
  </button>
);
