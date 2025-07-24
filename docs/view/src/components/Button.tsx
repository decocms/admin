import type { HTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

type ButtonSize = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends HTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  children?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

function getButtonClasses(
  variant: ButtonVariant = "default",
  size: ButtonSize = "default",
): string {
  // Base classes
  const baseClasses =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";

  // Variant classes
  const variantClasses = {
    default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
    destructive:
      "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20",
    outline:
      "border text-foreground bg-background shadow-xs hover:bg-accent hover:text-accent-foreground border-border",
    secondary:
      "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };

  // Size classes
  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-8 gap-1.5 px-3",
    lg: "h-10 px-6",
    icon: "size-10",
  };

  return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`;
}

export function Button({
  className = "",
  variant = "default",
  size = "default",
  children,
  disabled = false,
  type = "button",
  ...props
}: ButtonProps) {
  const buttonClasses = getButtonClasses(variant, size);

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${buttonClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
