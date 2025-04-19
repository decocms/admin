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
        "rounded-2xl flex items-center justify-center relative p-2",
        "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-t before:from-slate-300 before:to-slate-100",
        "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)]",
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
