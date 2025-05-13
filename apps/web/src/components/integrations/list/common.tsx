import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

export interface Props {
  icon?: string;
  name: string;
  className?: string;
}

export function IntegrationIcon({ icon, name, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center relative bg-white border border-slate-200 overflow-hidden",
        className,
      )}
    >
      {icon && /^(data:)|(https?:)/.test(icon)
        ? (
          <img
            src={icon}
            alt={name}
            className="h-full w-full object-contain rounded-lg"
          />
        )
        : <Icon name="conversion_path" />}
    </div>
  );
}
