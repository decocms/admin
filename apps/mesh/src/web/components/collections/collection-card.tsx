import { Card } from "@deco/ui/components/card.tsx";
import { IntegrationIcon } from "../integration-icon.tsx";
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
}: CollectionCardProps<T>) {
  const iconUrl = findImageField(schema, item);
  const description =
    item &&
    typeof item === "object" &&
    "description" in item &&
    typeof (item as Record<string, unknown>).description === "string"
      ? (item as Record<string, string>).description
      : undefined;

  return (
    <Card className="cursor-pointer transition-colors">
      <div className="flex flex-col gap-4 p-6">
        <IntegrationIcon
          icon={iconUrl}
          name={item.title}
          size="md"
          className="shrink-0 shadow-sm"
        />
        <div className="flex flex-col gap-0">
          <h3 className="text-base font-medium text-foreground truncate">
            {item.title}
          </h3>
          <p className="text-base text-muted-foreground line-clamp-2">
            {description || "No description"}
          </p>
        </div>
      </div>
    </Card>
  );
}
