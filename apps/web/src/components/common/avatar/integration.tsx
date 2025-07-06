import { Avatar, type AvatarProps } from "./index.tsx";

export interface IntegrationAvatarProps extends Omit<AvatarProps, "shape"> {
  /**
   * Override the default shape for special cases
   */
  shape?: AvatarProps["shape"];
}

/**
 * IntegrationAvatar - Specialized avatar for third-party integrations and services
 *
 * Defaults:
 * - shape="square" (integrations are services/brands)
 * - size="sm" (often used in compact lists and badges)
 * - objectFit="contain" (preserves logo aspect ratio and padding)
 */
export function IntegrationAvatar({
  shape = "square",
  size = "sm",
  objectFit = "contain",
  ...props
}: IntegrationAvatarProps) {
  return (
    <Avatar
      shape={shape}
      size={size}
      objectFit={objectFit}
      {...props}
    />
  );
}
