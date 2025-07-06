import { Avatar, type AvatarProps } from "./index.tsx";

export interface TeamAvatarProps extends Omit<AvatarProps, "shape"> {
  /**
   * Override the default shape for special cases
   */
  shape?: AvatarProps["shape"];
}

/**
 * TeamAvatar - Specialized avatar for teams and organizations
 *
 * Defaults:
 * - shape="square" (teams are entities/organizations)
 * - size="base" (standard size for team representations)
 * - objectFit="cover" (good for team photos and branded images)
 */
export function TeamAvatar({
  shape = "square",
  size = "base",
  objectFit = "cover",
  ...props
}: TeamAvatarProps) {
  return (
    <Avatar
      shape={shape}
      size={size}
      objectFit={objectFit}
      {...props}
    />
  );
}
