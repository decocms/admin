import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ALLOWANCES } from "../../../constants.ts";
import { openPreviewPanel, toIframeProps } from "../utils/preview.ts";

interface PreviewProps {
  title?: string;
  content: string;
  className?: string;
}

const IMAGE_REGEXP = /\.png|\.jpg|\.jpeg|\.gif|\.webp/;

export function Preview({ content, title, className }: PreviewProps) {
  const iframeProps = toIframeProps(content);
  const isImageLike = iframeProps.src && IMAGE_REGEXP.test(iframeProps.src);

  const handleExpand = () => {
    openPreviewPanel(
      `preview-${title?.toLowerCase().replace(/\s+/g, "-")}`,
      content,
      title || "Preview",
    );
  };

  return (
    <div
      className={cn(
        "relative w-max flex flex-col rounded-lg mb-4 p-1",
        className,
      )}
    >
      <div className="flex items-center justify-between p-2 pr-0">
        <div className="flex items-center gap-2">
          <Icon name="draft" className="text-sm text-muted-foreground" />
          <p className="text-sm font-medium tracking-tight">
            {title || "Preview"}
          </p>
        </div>
        <Button
          onClick={handleExpand}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted"
          aria-label="Expand preview"
        >
          <Icon
            name="expand_content"
            className="text-sm text-muted-foreground"
          />
        </Button>
      </div>

      <div className="w-max relative h-[420px] min-h-0 aspect-[4/5]">
        {isImageLike
          ? (
            <img
              src={iframeProps.src}
              alt={title || "Preview"}
              className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
            />
          )
          : (
            <iframe
              {...iframeProps}
              className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
              title={title || "Preview content"}
              allow={ALLOWANCES}
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          )}
      </div>
    </div>
  );
}
