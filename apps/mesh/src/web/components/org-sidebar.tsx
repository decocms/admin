import { useNavigate, useParams } from "@tanstack/react-router";
import {
  NavigationSidebar,
  type NavigationSidebarItem,
} from "@deco/ui/components/navigation-sidebar.tsx";

/**
 * Mesh-specific sidebar configuration.
 * This will eventually be replaced by a project-based system where
 * the /:org route renders a well-known "org-admin" project with views.
 */
export function MeshSidebar() {
  const navigate = useNavigate();
  const { org } = useParams({ strict: false });

  const navigationItems: NavigationSidebarItem[] = [
    {
      key: "mcps",
      label: "MCPs",
      icon: "grid_view",
      onClick: () =>
        navigate({ to: "/$org/connections", params: { org: org ?? "" } }),
    },
    {
      key: "members",
      label: "Members",
      icon: "group",
      onClick: () =>
        navigate({ to: "/$org/members", params: { org: org ?? "" } }),
    },
  ];

  return <NavigationSidebar navigationItems={navigationItems} />;
}
