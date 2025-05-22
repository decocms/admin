import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useFile } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Avatar } from "../../common/Avatar.tsx";
import { Suspense } from "react";
import { isFilePath } from "../../../utils/path.ts";

function FileIcon({ path, fallback, className, variant }: {
  path: string;
  fallback: React.ReactNode;
  className?: string;
  variant: "default" | "small";
}) {
  const { data: fileUrl } = useFile(path);

  if (variant === "small") {
    return (
      <Suspense
        fallback={
          <Skeleton
            className={cn(
              "rounded-2xl w-16 h-16 border border-slate-200",
            )}
          />
        }
      >
        <div className="relative w-full h-full">
          <Avatar
            url={typeof fileUrl === "string" ? fileUrl : undefined}
            fallback={fallback}
            fallbackClassName="!bg-transparent"
            className="w-full h-full rounded-none"
            objectFit="contain"
          />
        </div>
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <Skeleton
          className={cn(
            "rounded-2xl w-16 h-16 border border-slate-200",
          )}
        />
      }
    >
      <div
        className={cn(
          "rounded-2xl relative flex items-center justify-center p-2 h-16 w-16",
          "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-t before:from-slate-300 before:to-slate-100",
          "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)]",
          className,
        )}
      >
        <Avatar
          url={typeof fileUrl === "string" ? fileUrl : undefined}
          fallback={fallback}
          fallbackClassName="!bg-transparent"
          className="w-full h-full rounded-lg"
          objectFit="contain"
        />
      </div>
    </Suspense>
  );
}

function IntegrationIconContent(
  { icon, className, variant = "default" }: Props,
) {
  const fallback = <Icon name="conversion_path" className="text-slate-600" />;

  if (icon && isFilePath(icon)) {
    return (
      <FileIcon
        path={icon}
        fallback={fallback}
        className={className}
        variant={variant}
      />
    );
  }

  if (variant === "small") {
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          className,
        )}
      >
        {icon
          ? (
            <Avatar
              url={icon}
              fallback={fallback}
              fallbackClassName="!bg-transparent"
              className="w-full h-full rounded-2xl"
              objectFit="contain"
            />
          )
          : fallback}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl relative flex items-center justify-center p-2 h-16 w-16",
        "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-t before:from-slate-300 before:to-slate-100",
        "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)]",
        className,
      )}
    >
      {icon
        ? (
          <Avatar
            url={icon}
            fallback={fallback}
            fallbackClassName="!bg-transparent"
            className="w-full h-full rounded-lg"
            objectFit="contain"
          />
        )
        : fallback}
    </div>
  );
}

export interface Props {
  icon?: string;
  name: string;
  className?: string;
  variant?: "default" | "small";
}

export function IntegrationIcon(props: Props) {
  return (
    <Suspense
      fallback={
        <Skeleton
          className={cn(
            "rounded-2xl w-16 h-16 border border-slate-200",
            props.variant === "default" ? "p-2" : "",
            props.className,
          )}
        />
      }
    >
      <IntegrationIconContent {...props} />
    </Suspense>
  );
}
