import { Icon } from "@deco/ui/components/icon.tsx";

interface IntegrationIconProps {
  icon?: string;
  name: string;
  className?: string;
}

export function IntegrationIcon(
  { icon, name, className }: IntegrationIconProps,
) {
  if (!icon) return null;

  if (icon.startsWith("icon://")) {
    return (
      <div
        className={`bg-background border rounded-md p-1 h-6 w-6 flex items-center justify-center ${
          className || ""
        }`}
      >
        <Icon name={icon.replace("icon://", "")} size={16} />
      </div>
    );
  }

  return (
    <img
      src={icon}
      alt={`${name} icon`}
      className={`bg-background h-8 w-8 object-contain border rounded-md p-1 ${
        className || ""
      }`}
    />
  );
}
