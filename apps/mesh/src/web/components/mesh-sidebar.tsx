import { useProjectSidebarItems } from "@/web/lib/hooks/project-sidebar-items";
import { NavigationSidebar } from "@deco/ui/components/navigation-sidebar.tsx";

export function MeshSidebar() {
  const sidebarItems = useProjectSidebarItems();
  return <NavigationSidebar navigationItems={sidebarItems} />;
}
