import { Icon as IconUI } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { DEFAULT_INTEGRATION_ICON } from "../../../constants.ts";

interface Props {
  icon?: string;
  name: string;
  className?: string;
}

export function Icon({ icon, name, className }: Props) {
  const ico = icon ?? DEFAULT_INTEGRATION_ICON;

  if (ico.startsWith("icon://")) {
    return (
      <div
        className={cn(
          "bg-background border rounded-md p-1 h-6 w-6 flex items-center justify-center",
          className,
        )}
      >
        <IconUI name={ico.replace("icon://", "")} size={16} />
      </div>
    );
  }

  return (
    <img
      src={icon}
      alt={`${name} icon`}
      className={cn(
        "bg-background h-8 w-8 object-contain border rounded-md p-1",
        className,
      )}
    />
  );
}
