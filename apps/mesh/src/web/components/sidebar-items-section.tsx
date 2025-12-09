import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useLiveSuspenseQuery } from "@tanstack/react-db";
import { useNavigate } from "@tanstack/react-router";
import { Suspense } from "react";
import type { SidebarItemEntity } from "../hooks/use-sidebar-items-collection";
import { useSidebarItemsCollection } from "../hooks/use-sidebar-items-collection";

/**
 * Individual sidebar item
 */
function SidebarItemListItem({ item }: { item: SidebarItemEntity }) {
  const navigate = useNavigate();
  const sidebarItemsCollection = useSidebarItemsCollection();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="w-full pr-2 group/item relative cursor-pointer"
        onClick={() => {
          navigate({ to: item.url });
        }}
      >
        <div className="flex-1 min-w-0 flex flex-col items-start">
          <span className="truncate text-sm w-full">{item.title}</span>
        </div>
        <Icon
          name="close"
          size={16}
          className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            sidebarItemsCollection.delete(item.id);
          }}
        />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * Sidebar items section content - renders above Recent Threads
 * Only shows when there are pinned sidebar items
 */
function SidebarItemsSectionContent() {
  const sidebarItemsCollection = useSidebarItemsCollection();
  const { data: items } = useLiveSuspenseQuery(
    (q) =>
      q
        .from({ item: sidebarItemsCollection })
        .orderBy(({ item }) => item?.title, "asc"),
    [sidebarItemsCollection],
  );

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <>
      <SidebarMenuItem>
        <div className="px-2 py-0 text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>Pinned Views</span>
        </div>
      </SidebarMenuItem>
      {items.map((item) => (
        <SidebarItemListItem key={item.id} item={item} />
      ))}
    </>
  );
}

/**
 * Skeleton for loading sidebar item entries
 */
function SidebarItemSkeleton() {
  return (
    <SidebarMenuItem>
      <div className="flex items-center gap-2 px-4 py-2">
        <Skeleton className="h-4 flex-1" />
      </div>
    </SidebarMenuItem>
  );
}

/**
 * Sidebar items section - renders above Recent Threads
 */
export function SidebarItemsSection() {
  return (
    <Suspense
      fallback={
        <>
          <SidebarMenuItem>
            <div className="px-2 py-0 text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span>Pinned Views</span>
            </div>
          </SidebarMenuItem>
          <SidebarItemSkeleton />
          <SidebarItemSkeleton />
        </>
      }
    >
      <SidebarItemsSectionContent />
    </Suspense>
  );
}

