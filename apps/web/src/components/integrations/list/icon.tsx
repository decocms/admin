import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

export function IntegrationIcon(
  { integration, className }: {
    integration: { icon?: string; name: string };
    className?: string;
  },
) {
  return (
    <div
      className={cn(
        "rounded-2xl flex items-center justify-center relative p-2",
        "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-t before:from-slate-300 before:to-slate-100",
        "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)]",
        className,
      )}
    >
      {integration.icon && /^(data:)|(https?:)/.test(integration.icon)
        ? (
          <img
            src={integration.icon}
            alt={`${integration.name} icon`}
            className="h-full w-full object-contain rounded-lg"
          />
        )
        : <Icon name="conversion_path" />}
    </div>
  );
}
