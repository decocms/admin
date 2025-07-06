import { Avatar, type AvatarProps } from "./index.tsx";

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
 */
export function UserAvatar({
  shape = "circle",
  size = "base",
  objectFit = "cover",
  ...props
}: UserAvatarProps) {
  return (
    <Avatar
      shape={shape}
      size={size}
      objectFit={objectFit}
      {...props}
    />
  );
}
