import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useFile } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Avatar } from "../../common/Avatar.tsx";

export interface Props {
  icon?: string;
  name: string;
  className?: string;
  isLoading?: boolean;
  variant?: "default" | "small";
}

export function IntegrationIcon(
  { icon, className, isLoading, variant = "default" }: Props,
) {
  const isUrlLike = icon && /^(data:)|(https?:)/.test(icon);
  const isFilePath = icon && !isUrlLike;
  const { data: fileUrl, isLoading: isFileLoading } = useFile(
    isFilePath ? icon : "",
  );

  if (isLoading || (isFilePath && isFileLoading)) {
    return (
      <Skeleton
        className={cn(
          "rounded-2xl w-16 h-16",
          variant === "default" ? "p-2" : "",
          className,
        )}
      />
    );
  }

  const url = isUrlLike ? icon : fileUrl;
  const fallback = <Icon name="conversion_path" className="text-slate-600" />;

  if (variant === "small") {
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          className,
        )}
      >
        {url
          ? (
            <Avatar
              url={url}
              fallback={fallback}
              fallbackClassName="!bg-transparent"
              className="w-full h-full rounded-none"
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
      {url
        ? (
          <Avatar
            url={url}
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
