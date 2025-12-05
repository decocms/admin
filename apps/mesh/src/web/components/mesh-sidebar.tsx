import { useProjectSidebarItems } from "@/web/hooks/use-project-sidebar-items";
import { NavigationSidebar } from "@deco/ui/components/navigation-sidebar.tsx";
import { ThreadsSidebarSection } from "@/web/components/threads-sidebar";
import { ErrorBoundary } from "@/web/components/error-boundary";
import { Suspense } from "react";

export function MeshSidebar() {
  const sidebarItems = useProjectSidebarItems();

  return (
    <NavigationSidebar
      navigationItems={sidebarItems}
      additionalContent={
        <ErrorBoundary>
          <Suspense fallback={null}>
            <ThreadsSidebarSection />
          </Suspense>
        </ErrorBoundary>
      }
    />
  );
}
