import { useProjectSidebarItems } from "@/web/hooks/use-project-sidebar-items";
import { NavigationSidebar } from "@deco/ui/components/navigation-sidebar.tsx";
import { ThreadsSidebarSection } from "@/web/components/threads-sidebar";
import { Suspense } from "react";

export function MeshSidebar() {
  const sidebarItems = useProjectSidebarItems();

  return (
    <NavigationSidebar
      navigationItems={sidebarItems}
      additionalContent={
        <Suspense fallback={null}>
          <ThreadsSidebarSection />
        </Suspense>
      }
    />
  );
}
