import type { HTMLAttributes } from "react";
import * as LucideIcons from "lucide-react";
import React from "react";

export interface Props extends HTMLAttributes<HTMLSpanElement> {
  /**
   * The name of the icon.
   */
  name: string;
  /**
   * The size of the icon.
   */
  size?: number;
}

/**
 * Uses Lucide React icons.
 * For available icons, see: https://lucide.dev/icons
 * Use the exact component name without "Icon" suffix (e.g., "MoveUpRight", "Folder", "FileText")
 */
export function Icon({ name, size = 16, style, className, ...props }: Props) {
  // Use the name directly as the component name
  const LucideIcon = LucideIcons[name as keyof typeof LucideIcons];

  if (!LucideIcon) {
    console.warn(
      `Icon "${name}" not found in Lucide React. Available icons:`,
      Object.keys(LucideIcons).slice(0, 10),
    );
    return null;
  }

  // Use proper typing for the Lucide component
  const IconComponent = LucideIcon as React.ComponentType<{
    size?: number;
    className?: string;
    style?: React.CSSProperties;
  }>;

  return React.createElement(IconComponent, {
    size,
    className,
    style,
    ...props,
  });
}
