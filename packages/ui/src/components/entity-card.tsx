import { Card } from "./card.tsx";
import { cn } from "../lib/utils.ts";
import type { ReactNode } from "react";
import { Avatar as AvatarComponent } from "./avatar.tsx";
import type { AvatarProps } from "./avatar.tsx";

interface EntityCardProps {
  children: ReactNode;
  className?: string;
  onNavigate?: (e: React.MouseEvent) => void;
}

interface EntityCardContentProps {
  children: ReactNode;
  className?: string;
}

function EntityCardRoot({ children, className, onNavigate }: EntityCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onNavigate) {
      onNavigate(e);
    }
  };

  return (
    <Card
      className={cn(
        "group transition-all flex flex-col gap-0",
        onNavigate && "cursor-pointer hover:ring-2 hover:ring-primary",
        className,
      )}
      onClick={handleClick}
    >
      {children}
    </Card>
  );
}

function EntityCardAvatar({
  url,
  fallback,
  shape = "square",
  size = "lg",
  objectFit = "contain",
  className,
}: AvatarProps) {
  return (
    <AvatarComponent
      url={url}
      fallback={fallback}
      shape={shape}
      size={size}
      objectFit={objectFit}
      className={className}
    />
  );
}

function EntityCardHeader({ children, className }: EntityCardContentProps) {
  return (
    <div className={cn("p-4 flex flex-col gap-4", className)}>{children}</div>
  );
}

function EntityCardTitle({ children, className }: EntityCardContentProps) {
  return <p className={cn("font-medium truncate", className)}>{children}</p>;
}

function EntityCardSubtitle({ children, className }: EntityCardContentProps) {
  return (
    <h3 className={cn("text-sm text-muted-foreground truncate", className)}>
      {children}
    </h3>
  );
}

function EntityCardContent({ children, className }: EntityCardContentProps) {
  return (
    <div className={cn("flex flex-col gap-[2px]", className)}>{children}</div>
  );
}

function EntityCardAvatarSection({
  children,
  className,
}: EntityCardContentProps) {
  return (
    <div className={cn("flex justify-between items-start", className)}>
      {children}
    </div>
  );
}

function EntityCardFooter({ children, className }: EntityCardContentProps) {
  return (
    <div
      className={cn(
        "p-4 border-t border-border flex justify-between items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EntityCardBadge({ children, className }: EntityCardContentProps) {
  return (
    <div
      className={cn(
        "flex items-center text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EntityCardSkeleton() {
  return (
    <Card className="group transition-colors flex flex-col">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="h-12 w-12 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="flex flex-col gap-[2px]">
          <div className="h-4 w-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-4 w-40 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="p-4 border-t border-border flex justify-between items-center">
        <div className="h-6 w-6 bg-muted rounded-full animate-pulse" />
        <div className="h-6 w-6 bg-muted rounded-full animate-pulse -ml-2" />
      </div>
    </Card>
  );
}

export const EntityCard = Object.assign(EntityCardRoot, {
  Avatar: EntityCardAvatar,
  AvatarSection: EntityCardAvatarSection,
  Header: EntityCardHeader,
  Title: EntityCardTitle,
  Subtitle: EntityCardSubtitle,
  Content: EntityCardContent,
  Footer: EntityCardFooter,
  Badge: EntityCardBadge,
  Skeleton: EntityCardSkeleton,
});
