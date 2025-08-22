import { useState, useCallback, useEffect } from "react";
import { arrayMove } from "@dnd-kit/sortable";

export interface UnifiedNavItem {
  id: string;
  to: string;
  icon: string | React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  section: "main" | "mcp" | "app";
  hierarchyLevel: number;
  isSubItem: boolean;
  container: "root" | "mcp" | string; // app collections use app name as container
  appName?: string;
  onClick?: () => void;
}

export interface Collection {
  id: string;
  title: string;
  items: UnifiedNavItem[];
  isCollapsible: boolean;
  isCollapsed?: boolean;
  itemOrder: string[]; // Track order of items within collection
}

// Root sidebar structure
export interface SidebarStructure {
  defaultItems: UnifiedNavItem[]; // Default items at root level
  collections: Collection[]; // Collections at root level
  rootOrder: string[]; // Order of root-level items (default items + collection headers)
}

const STORAGE_KEY = "sidebar-nav-order-v2";

export function useUnifiedNavOrder(allNavItems: UnifiedNavItem[]) {
  // Initialize sidebar structure from nav items
  const initializeSidebar = useCallback((items: UnifiedNavItem[]): SidebarStructure => {
    const defaultItems = items.filter(item => item.section === "main");
    const mcpItems = items.filter(item => item.section === "mcp" && item.id !== "mcp-separator");
    
    // Group app items by app name
    const appItems = items.filter(item => item.section === "app");
    const appGroups = appItems.reduce((acc, item) => {
      const appName = item.appName || "unknown";
      if (!acc[appName]) acc[appName] = [];
      acc[appName].push(item);
      return acc;
    }, {} as Record<string, UnifiedNavItem[]>);

    const collections: Collection[] = [
      // MCPs collection
      {
        id: "mcp",
        title: "MCPs",
        items: mcpItems,
        isCollapsible: true,
        isCollapsed: false,
        itemOrder: mcpItems.map(item => item.id),
      },
      // App collections
      ...Object.entries(appGroups).map(([appName, items]) => ({
        id: `app-${appName}`,
        title: appName,
        items,
        isCollapsible: true,
        isCollapsed: false,
        itemOrder: items.map(item => item.id),
      })),
    ];

    const rootOrder = [
      ...defaultItems.map(item => item.id),
      ...collections.map(collection => collection.id)
    ];

    return {
      defaultItems,
      collections,
      rootOrder,
    };
  }, []);

  // Load from localStorage or initialize
  const [sidebarStructure, setSidebarStructure] = useState<SidebarStructure>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with current items to handle new/removed items
        const initialized = initializeSidebar(allNavItems);
        return {
          ...initialized,
          rootOrder: parsed.rootOrder || initialized.rootOrder,
          collections: initialized.collections.map(collection => {
            const savedCollection = parsed.collections?.find((c: any) => c.id === collection.id);
            return {
              ...collection,
              isCollapsed: savedCollection?.isCollapsed ?? collection.isCollapsed,
              itemOrder: savedCollection?.itemOrder || collection.itemOrder,
            };
          }),
        };
      }
    } catch (e) {
      console.warn('Failed to load sidebar order from localStorage:', e);
    }
    return initializeSidebar(allNavItems);
  });

  // Update sidebar structure when nav items change
  useEffect(() => {
    const newStructure = initializeSidebar(allNavItems);
    setSidebarStructure(prev => ({
      ...newStructure,
      rootOrder: prev.rootOrder.filter(id => 
        newStructure.defaultItems.some(item => item.id === id) ||
        newStructure.collections.some(collection => collection.id === id)
      ).concat(
        // Add new items that aren't in the current order
        newStructure.defaultItems.map(item => item.id).filter(id => !prev.rootOrder.includes(id)),
        newStructure.collections.map(collection => collection.id).filter(id => !prev.rootOrder.includes(id))
      ),
      collections: newStructure.collections.map(collection => {
        const prevCollection = prev.collections.find(c => c.id === collection.id);
        return {
          ...collection,
          isCollapsed: prevCollection?.isCollapsed ?? collection.isCollapsed,
          itemOrder: prevCollection?.itemOrder || collection.itemOrder,
        };
      }),
    }));
  }, [allNavItems, initializeSidebar]);

  // Save to localStorage whenever structure changes
  useEffect(() => {
    const toSave = {
      rootOrder: sidebarStructure.rootOrder,
      collections: sidebarStructure.collections.map(c => ({
        id: c.id,
        isCollapsed: c.isCollapsed,
        itemOrder: c.itemOrder,
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [sidebarStructure]);

  // Move items in root order
  const moveRootItem = useCallback((activeId: string, overId: string) => {
    setSidebarStructure(prev => {
      const newRootOrder = arrayMove(
        prev.rootOrder,
        prev.rootOrder.indexOf(activeId),
        prev.rootOrder.indexOf(overId)
      );
      return { ...prev, rootOrder: newRootOrder };
    });
  }, []);

  // Get ordered root items based on rootOrder
  const getOrderedRootItems = useCallback(() => {
    const itemsMap = new Map();
    
    // Add default items to map
    sidebarStructure.defaultItems.forEach(item => {
      itemsMap.set(item.id, { ...item, type: 'default' });
    });
    
    // Add collections to map
    sidebarStructure.collections.forEach(collection => {
      itemsMap.set(collection.id, { ...collection, type: 'collection' });
    });
    
    // Return items in the order specified by rootOrder
    return sidebarStructure.rootOrder.map(id => itemsMap.get(id)).filter(Boolean);
  }, [sidebarStructure]);

  const toggleCollectionCollapse = useCallback((collectionId: string) => {
    setSidebarStructure(prev => ({
      ...prev,
      collections: prev.collections.map(collection => 
        collection.id === collectionId 
          ? { ...collection, isCollapsed: !collection.isCollapsed }
          : collection
      )
    }));
  }, []);

  const moveItemWithinCollection = useCallback((
    collectionId: string, 
    activeId: string, 
    overId: string
  ) => {
    setSidebarStructure(prev => ({
      ...prev,
      collections: prev.collections.map(collection => {
        if (collection.id !== collectionId) return collection;
        
        const newItemOrder = arrayMove(
          collection.itemOrder,
          collection.itemOrder.indexOf(activeId),
          collection.itemOrder.indexOf(overId)
        );
        
        return { ...collection, itemOrder: newItemOrder };
      })
    }));
  }, []);

  const getOrderedCollectionItems = useCallback((collection: Collection) => {
    const itemsMap = new Map(collection.items.map(item => [item.id, item]));
    return collection.itemOrder.map(id => itemsMap.get(id)).filter(Boolean) as UnifiedNavItem[];
  }, []);

  const resetOrder = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSidebarStructure(initializeSidebar(allNavItems));
  }, [allNavItems, initializeSidebar]);

  return {
    sidebarStructure,
    getOrderedRootItems,
    getOrderedCollectionItems,
    moveRootItem,
    moveItemWithinCollection,
    toggleCollectionCollapse,
    resetOrder,
  };
}
