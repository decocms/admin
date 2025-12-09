import { type Collection, createCollection } from "@tanstack/db";
import { useProjectContext } from "../providers/project-context-provider";
import { createCollectionWithSync } from "./create-collection-with-sync";
import { createToolCaller } from "../../tools/client";
import type { SidebarItem } from "../../storage/types";

/**
 * Sidebar item entity with id for TanStack DB collection
 */
export interface SidebarItemEntity extends SidebarItem {
  id: string;
}

const sidebarItemsCollectionCache = {
  key: "",
  value: null as Collection<SidebarItemEntity, string> | null,
};

/**
 * Get or create a sidebar items collection instance for the current organization.
 * Collections are cached to ensure singleton-like behavior per org.
 *
 * @returns A TanStack DB collection instance for sidebar items
 */
export function useSidebarItemsCollection(): Collection<
  SidebarItemEntity,
  string
> {
  const { org } = useProjectContext();

  if (!org.id) {
    throw new Error("Organization ID is required for sidebar items collection");
  }

  const key = `org-${org.id}:sidebar-items`;

  if (sidebarItemsCollectionCache.key !== key) {
    sidebarItemsCollectionCache.key = key;
    sidebarItemsCollectionCache.value = createCollection<SidebarItemEntity, string>(
      createCollectionWithSync<SidebarItemEntity, string>({
        id: key,
        getKey: (item: SidebarItemEntity) => item.id,

        sync: {
          rowUpdateMode: "full",
          sync: ({ begin, write, commit, markReady }) => {
            let isActive = true;

            async function initialSync() {
              try {
                const toolCaller = createToolCaller();
                const settings = (await toolCaller("ORGANIZATION_SETTINGS_GET", {
                  organizationId: org.id,
                })) as { sidebar_items?: SidebarItem[] | null };

                if (!isActive) {
                  return;
                }

                begin();
                const sidebarItems = settings.sidebar_items || [];
                for (const item of sidebarItems) {
                  // Generate a stable ID from the item properties
                  const id = `${item.connectionId}-${item.url}`;
                  write({
                    type: "insert",
                    value: {
                      ...item,
                      id,
                    },
                  });
                }
                commit();
              } catch (error) {
                console.error("Initial sync failed for sidebar items:", error);
              } finally {
                markReady();
              }
            }

            initialSync();

            // Return cleanup function
            return () => {
              isActive = false;
            };
          },
        },

        // Persistence handler for inserts
        onInsert: async ({ transaction }) => {
          const toolCaller = createToolCaller();
          const currentSettings = (await toolCaller("ORGANIZATION_SETTINGS_GET", {
            organizationId: org.id,
          })) as { sidebar_items?: SidebarItem[] | null };

          const currentItems = currentSettings.sidebar_items || [];
          const newItems = transaction.mutations.map(({ modified }) => ({
            title: modified.title,
            url: modified.url,
            connectionId: modified.connectionId,
          }));

          const updatedItems = [...currentItems, ...newItems];

          await toolCaller("ORGANIZATION_SETTINGS_UPDATE", {
            organizationId: org.id,
            sidebar_items: updatedItems,
          });

          return transaction.mutations.map(({ modified }) => modified);
        },

        // Persistence handler for updates
        onUpdate: async ({ transaction }) => {
          const toolCaller = createToolCaller();
          const currentSettings = (await toolCaller("ORGANIZATION_SETTINGS_GET", {
            organizationId: org.id,
          })) as { sidebar_items?: SidebarItem[] | null };

          const currentItems = currentSettings.sidebar_items || [];
          const updatedItems = currentItems.map((item) => {
            const mutation = transaction.mutations.find(
              ({ key }) => `${item.connectionId}-${item.url}` === key,
            );
            if (mutation) {
              return {
                title: mutation.modified.title,
                url: mutation.modified.url,
                connectionId: mutation.modified.connectionId,
              };
            }
            return item;
          });

          await toolCaller("ORGANIZATION_SETTINGS_UPDATE", {
            organizationId: org.id,
            sidebar_items: updatedItems,
          });

          return transaction.mutations.map(({ modified }) => modified);
        },

        // Persistence handler for deletes
        onDelete: async ({ transaction }) => {
          const toolCaller = createToolCaller();
          const currentSettings = (await toolCaller("ORGANIZATION_SETTINGS_GET", {
            organizationId: org.id,
          })) as { sidebar_items?: SidebarItem[] | null };

          const currentItems = currentSettings.sidebar_items || [];
          const deletedIds = new Set(
            transaction.mutations.map(({ key }) => key),
          );

          const updatedItems = currentItems.filter(
            (item) => !deletedIds.has(`${item.connectionId}-${item.url}`),
          );

          await toolCaller("ORGANIZATION_SETTINGS_UPDATE", {
            organizationId: org.id,
            sidebar_items: updatedItems,
          });

          // Return deleted items for sync
          return transaction.mutations.map(({ key }) => {
            const deletedItem = currentItems.find(
              (item) => `${item.connectionId}-${item.url}` === key,
            );
            if (!deletedItem) {
              throw new Error(`Deleted item not found: ${key}`);
            }
            return {
              id: key,
              title: deletedItem.title,
              url: deletedItem.url,
              connectionId: deletedItem.connectionId,
            };
          });
        },
      }),
    );
  }

  return sidebarItemsCollectionCache.value!;
}


