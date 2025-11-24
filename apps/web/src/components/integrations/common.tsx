import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense } from "react";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";

export interface IntegrationIconProps {
  icon?: string;
  name?: string;
  className?: string;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
}

export function IntegrationIcon({
  icon,
  name,
  className,
  size = "base",
}: IntegrationIconProps) {
  return (
    <Suspense fallback={<Skeleton className={className} />}>
      <IntegrationAvatar
        url={icon}
        size={size}
        fallback={name}
        className={className}
      />
    </Suspense>
  );
}
