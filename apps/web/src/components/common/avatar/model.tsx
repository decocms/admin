import { Avatar, type AvatarProps } from "./index.tsx";

export interface ModelAvatarProps extends Omit<AvatarProps, "shape"> {
  /**
   * Override the default shape for special cases
   */
  shape?: AvatarProps["shape"];
}

/**
 * ModelAvatar - Specialized avatar for AI models and LLM providers
 *
 * Defaults:
 * - shape="square" (models are AI services/brands)
 * - size="base" (standard size for model representations)
 * - objectFit="contain" (preserves model provider logos and branding)
 */
export function ModelAvatar({
  shape = "square",
  size = "base",
  objectFit = "contain",
  ...props
}: ModelAvatarProps) {
  return (
    <Avatar
      shape={shape}
      size={size}
      objectFit={objectFit}
      {...props}
    />
  );
}
