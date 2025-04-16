import type { Integration } from "@deco/sdk";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { FormControl, FormItem, FormLabel } from "@deco/ui/components/form.tsx";
import { Icon as IconUI } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "./icon.tsx";

interface Props {
  integration: Integration;
  setTools: (integrationId: string, toolId?: string[]) => void;
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
  numberOfEnabledTools: number;
  totalNumberOfTools: number;
  tools: string[];
}

export function Header({
  integration,
  setTools,
  isExpanded,
  setIsExpanded,
  numberOfEnabledTools,
  totalNumberOfTools,
  tools,
}: Props) {
  const checked = numberOfEnabledTools === totalNumberOfTools;

  return (
    <div className="w-full grid grid-cols-[1fr_auto] items-center justify-between gap-2 p-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="grid grid-cols-[min-content_auto_auto_auto] justify-start items-center gap-2 cursor-pointer"
      >
        <IconUI
          name="chevron_right"
          size={16}
          className={cn(
            "text-muted-foreground transition-transform",
            isExpanded ? "rotate-90" : "",
          )}
        />
        <Icon icon={integration.icon} name={integration.name} />

        <div className="font-medium text-base truncate">
          {integration?.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {numberOfEnabledTools} of {totalNumberOfTools}
        </div>
      </button>
      <div>
        <FormItem className="flex items-center gap-2">
          <FormControl>
            <Checkbox
              checked={checked}
              onCheckedChange={() => {
                setTools(integration.id, checked ? undefined : tools);
              }}
            />
          </FormControl>
          <FormLabel className="text-xs text-muted-foreground cursor-pointer">
            Select all
          </FormLabel>
        </FormItem>
      </div>
    </div>
  );
}

Header.Skeleton = ({
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
      <IconUI
        name="chevron_right"
        className={cn(
          "text-muted-foreground transition-transform",
          isExpanded ? "rotate-90" : "",
        )}
      />
      <div className="flex items-center gap-2 flex-grow">
        <Skeleton className="h-8 w-8 rounded-md" />
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

Header.Error = ({
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
      <IconUI
        name="chevron_right"
        className={cn(
          "text-muted-foreground transition-transform",
          isExpanded ? "rotate-90" : "",
        )}
      />
      <div className="flex items-center gap-2 flex-grow">
        <Icon icon={integration.icon} name={integration.name} />
        <h3 className="font-medium text-base">{integration.name}</h3>
      </div>

      <div className="flex items-center gap-2">
        <IconUI name="cancel" className="text-xs text-red-500" size={16} />
        <span className="text-sm text-red-500">Error</span>
      </div>
    </div>
  </button>
);
