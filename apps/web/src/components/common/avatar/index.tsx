import {
  Avatar as AvatarUI,
  AvatarFallback,
  AvatarImage,
} from "@deco/ui/components/avatar.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes, type ReactNode, useMemo } from "react";

// Predefined color palette for avatar backgrounds
const AVATAR_COLORS = [
  "bg-red-100 text-red-800",
  "bg-green-100 text-green-800",
  "bg-blue-100 text-blue-800",
  "bg-yellow-100 text-yellow-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-indigo-100 text-indigo-800",
  "bg-orange-100 text-orange-800",
  "bg-teal-100 text-teal-800",
  "bg-cyan-100 text-cyan-800",
];

/**
 * Generate a deterministic color from a string
 */
function getColorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

// CircleAvatar variants - always rounded-full
const circleAvatarVariants = cva("", {
  variants: {
    size: {
      xs: "w-6 h-6",
      sm: "w-8 h-8",
      base: "w-10 h-10",
      lg: "w-12 h-12",
      xl: "w-16 h-16",
      "2xl": "w-20 h-20",
      "3xl": "w-32 h-32",
    },
  },
  defaultVariants: {
    size: "base",
  },
});

// SquareAvatar variants - size-based roundedness
const squareAvatarVariants = cva("", {
  variants: {
    size: {
      xs: "w-6 h-6 rounded-sm",
      sm: "w-8 h-8 rounded-md",
      base: "w-10 h-10 rounded-lg",
      lg: "w-12 h-12 rounded-xl",
      xl: "w-16 h-16 rounded-2xl",
      "2xl": "w-20 h-20 rounded-3xl",
      "3xl": "w-32 h-32 rounded-3xl",
    },
  },
  defaultVariants: {
    size: "base",
  },
});

// Image variants for object-fit
const avatarImageVariants = cva("", {
  variants: {
    objectFit: {
      contain: "object-contain",
      cover: "object-cover",
    },
    roundness: {
      full: "rounded-full",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      xl: "rounded-xl",
      "2xl": "rounded-2xl",
      "3xl": "rounded-3xl",
    },
  },
  defaultVariants: {
    objectFit: "cover",
    roundness: "lg",
  },
});

// SquareAvatar roundness mapping based on size
const squareAvatarRoundnessVariants = cva("", {
  variants: {
    size: {
      xs: "rounded-sm",
      sm: "rounded-md",
      base: "rounded-lg",
      lg: "rounded-xl",
      xl: "rounded-2xl",
      "2xl": "rounded-3xl",
      "3xl": "rounded-3xl",
    },
  },
  defaultVariants: {
    size: "base",
  },
});

interface BaseAvatarProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The URL of the avatar image
   */
  url?: string;
  /**
   * Fallback text or element to display when the image is not available
   * If string is provided, it will use the first two characters (typically initials)
   */
  fallback: string | ReactNode;
  /**
   * The object fit of the avatar image
   */
  objectFit?: "contain" | "cover";
  /**
   * Additional CSS classes to apply to the avatar
   */
  className?: string;
}

/**
 * CircleAvatar - Always rounded-full, perfect for user profile pictures
 * Internal component - use Avatar with shape="circle" instead
 */
function CircleAvatar({
  url,
  fallback,
  size = "base",
  objectFit = "cover",
  className,
  ...props
}: BaseAvatarProps & {
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
}) {
  const fallbackContent = useMemo(() => {
    if (typeof fallback === "string") {
      return fallback.substring(0, 2).toUpperCase();
    }
    return fallback;
  }, [fallback]);

  const fallbackColor = useMemo(() => {
    if (typeof fallback === "string") {
      return getColorFromString(fallback);
    }
    return AVATAR_COLORS[0];
  }, [fallback]);

  return (
    <AvatarUI
      className={cn(
        circleAvatarVariants({ size }),
        "rounded-full",
        className,
      )}
      {...props}
    >
      <AvatarImage
        src={url}
        alt="Avatar"
        className={cn(
          avatarImageVariants({ objectFit, roundness: "full" }),
        )}
      />
      <AvatarFallback
        className={cn(fallbackColor, "rounded-full")}
      >
        {fallbackContent}
      </AvatarFallback>
    </AvatarUI>
  );
}

/**
 * SquareAvatar - Size-based roundedness, perfect for brand logos and general avatars
 * Internal component - use Avatar with shape="square" instead
 */
function SquareAvatar({
  url,
  fallback,
  size = "base",
  objectFit = "cover",
  className,
  ...props
}: BaseAvatarProps & {
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
}) {
  const fallbackContent = useMemo(() => {
    if (typeof fallback === "string") {
      return fallback.substring(0, 2).toUpperCase();
    }
    return fallback;
  }, [fallback]);

  const fallbackColor = useMemo(() => {
    if (typeof fallback === "string") {
      return getColorFromString(fallback);
    }
    return AVATAR_COLORS[0];
  }, [fallback]);

  return (
    <AvatarUI
      className={cn(
        squareAvatarVariants({ size }),
        className,
      )}
      {...props}
    >
      <AvatarImage
        src={url}
        alt="Avatar"
        className={cn(
          avatarImageVariants({ objectFit }),
          squareAvatarRoundnessVariants({ size }),
        )}
      />
      <AvatarFallback
        className={cn(
          fallbackColor,
          squareAvatarRoundnessVariants({ size }),
        )}
      >
        {fallbackContent}
      </AvatarFallback>
    </AvatarUI>
  );
}

// Avatar variants with shape
const avatarVariants = cva("", {
  variants: {
    shape: {
      circle: "",
      square: "",
    },
    size: {
      xs: "",
      sm: "",
      base: "",
      lg: "",
      xl: "",
      "2xl": "",
      "3xl": "",
    },
  },
  defaultVariants: {
    shape: "square",
    size: "base",
  },
});

export type AvatarProps = VariantProps<typeof avatarVariants> & BaseAvatarProps;

/**
 * Avatar - Universal avatar component with shape variant
 *
 * @param shape - 'circle' for user profiles, 'square' for brands/agents (default: 'square')
 * @param size - Size variant (default: 'base')
 * @param url - Image URL
 * @param fallback - Fallback text or element when image fails to load
 * @param objectFit - How the image should fit within the container
 * @param className - Additional CSS classes
 */
export function Avatar({
  shape = "square",
  size = "base",
  url,
  fallback,
  objectFit = "cover",
  className,
  ...props
}: AvatarProps) {
  if (shape === "circle") {
    return (
      <CircleAvatar
        url={url}
        fallback={fallback}
        size={size ?? "base"}
        objectFit={objectFit}
        className={className}
        {...props}
      />
    );
  }

  return (
    <SquareAvatar
      url={url}
      fallback={fallback}
      size={size ?? "base"}
      objectFit={objectFit}
      className={className}
      {...props}
    />
  );
}
