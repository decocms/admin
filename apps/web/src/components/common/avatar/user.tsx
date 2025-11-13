import { Avatar, type AvatarProps } from "@deco/ui/components/avatar.tsx";

export interface UserAvatarProps extends Omit<AvatarProps, "shape"> {
  /**
   * Override the default shape for special cases
   */
  shape?: AvatarProps["shape"];
}

/**
 * UserAvatar - Specialized avatar for user profiles
 *
 * Defaults:
 * - shape="circle" (users are people, circular is standard)
 * - size="base"
 * - objectFit="cover" (good for profile photos)
 * - When no URL and no fallback: renders person icon with muted styling
 */
export function UserAvatar({
  shape = "circle",
  size = "base",
  objectFit = "cover",
  url,
  fallback,
  ...props
}: UserAvatarProps) {
  // When no URL and no fallback provided, render a person icon with muted styling
  const shouldShowPersonIcon = !url && !fallback;
  const avatarUrl = shouldShowPersonIcon ? "icon://person" : url;
  const avatarFallback = shouldShowPersonIcon ? "" : fallback;
  const isMuted = shouldShowPersonIcon;

  return (
    <Avatar
      shape={shape}
      size={size}
      objectFit={objectFit}
      url={avatarUrl}
      fallback={avatarFallback}
      muted={isMuted}
      {...props}
    />
  );
}
