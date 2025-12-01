import { Card } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { UserIndicator } from "./user-indicator.tsx";
import type { z } from "zod";
import type { BaseCollectionEntity } from "@decocms/bindings/collections";
import { ZodString } from "zod";

interface CollectionCardProps<T extends BaseCollectionEntity> {
  item: T;
  schema: z.AnyZodObject;
  readOnly?: boolean;
  onAction: (action: "open" | "delete" | "duplicate", item: T) => void;
}

function findImageField(
  schema: z.AnyZodObject,
  item: unknown,
): string | undefined {
  const shape = schema.shape;

  // 1. Look for ZodString with kind === "url"
  for (const key in shape) {
    const fieldSchema = shape[key];
    if (fieldSchema instanceof ZodString) {
      // @ts-ignore - accessing internal checks
      const hasUrlCheck = fieldSchema._def.checks.some(
        (check: { kind: string }) => check.kind === "url",
      );
      if (
        hasUrlCheck &&
        item &&
        typeof item === "object" &&
        key in item &&
        (item as Record<string, unknown>)[key]
      ) {
        return (item as Record<string, string>)[key];
      }
    }
  }

  // 2. Heuristic: Check for common image field names
  const imageFields = [
    "image",
    "img",
    "avatar",
    "icon",
    "logo",
    "thumbnail",
    "cover",
  ];
  for (const field of imageFields) {
    if (
      item &&
      typeof item === "object" &&
      field in item &&
      typeof (item as Record<string, unknown>)[field] === "string"
    ) {
      return (item as Record<string, string>)[field];
    }
  }

  return undefined;
}

export function CollectionCard<T extends BaseCollectionEntity>({
  item,
  schema,
  readOnly,
  onAction,
}: CollectionCardProps<T>) {
  const imageUrl = findImageField(schema, item);
  const description =
    item &&
    typeof item === "object" &&
    "description" in item &&
    typeof (item as Record<string, unknown>).description === "string"
      ? (item as Record<string, string>).description
      : undefined;

  return (
    <Card className="group relative flex flex-col overflow-hidden hover:shadow-md transition-shadow bg-card border-border/50">
      {imageUrl && (
        <div className="aspect-video w-full overflow-hidden bg-muted/20 border-b border-border/50">
          <img
            src={imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}

      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3
              className="font-semibold text-base leading-tight truncate"
              title={item.title}
            >
              {item.title}
            </h3>
            {description && (
              <p
                className="text-sm text-muted-foreground line-clamp-2 mt-1"
                title={description}
              >
                {description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 -mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Icon name="more_vert" size={16} />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAction("open", item)}>
                <Icon name="visibility" className="mr-2 h-4 w-4" />
                Open
              </DropdownMenuItem>
              {!readOnly && (
                <>
                  <DropdownMenuItem onClick={() => onAction("duplicate", item)}>
                    <Icon name="content_copy" className="mr-2 h-4 w-4" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onAction("delete", item)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Icon name="delete" className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
          <UserIndicator userId={item.updated_by || item.created_by} />
          <span>
            {new Date(item.updated_at || item.created_at).toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
              },
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}
