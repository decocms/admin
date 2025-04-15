import { Icon } from "@deco/ui/components/icon.tsx";

interface BadgeProps {
  text: string;
  variant?: "yellow" | "purple" | "primary";
  isDark?: boolean;
  icon?: string;
  iconSize?: number;
}

export function Badge({
  text,
  variant = "yellow",
  isDark = false,
  icon,
  iconSize = 16,
}: BadgeProps) {
  const variantClasses = {
    yellow: {
      light: {
        bg: "bg-yellow-light",
        text: "text-yellow-dark",
      },
      dark: {
        bg: "bg-yellow-dark",
        text: "text-yellow-light",
      },
    },
    purple: {
      light: {
        bg: "bg-purple-light",
        text: "text-purple-dark",
      },
      dark: {
        bg: "bg-purple-dark",
        text: "text-purple-light",
      },
    },
    primary: {
      light: {
        bg: "bg-primary-light",
        text: "text-primary-dark",
      },
      dark: {
        bg: "bg-primary-dark",
        text: "text-primary-light",
      },
    },
  };

  const { bg, text: textColor } =
    variantClasses[variant][isDark ? "dark" : "light"];

  return (
    <div
      className={`px-4 py-1 ${bg} rounded-full inline-flex justify-center items-center gap-2`}
    >
      {icon && (
        <Icon
          name={icon}
          className={`material-icons ${textColor}`}
          style={{ fontSize: `${iconSize}px` }}
        />
      )}
      <div
        className={`justify-center ${textColor} text-base font-medium leading-tight`}
      >
        {text}
      </div>
    </div>
  );
}
