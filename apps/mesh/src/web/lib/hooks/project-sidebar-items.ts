import { useProjectContext } from "@/web/providers/project-context-provider";
import { NavigationSidebarItem } from "@deco/ui/components/navigation-sidebar.js";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Locator, ProjectLocator } from "../locator";
import { useNavigate } from "@tanstack/react-router";
import { KEYS } from "../query-keys";

async function getProjectSidebarItems({
  locator,
  navigate,
}: {
  locator: ProjectLocator;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { org } = Locator.parse(locator);
  const isOrgAdminProject = Locator.isOrgAdminProject(locator);

  const KNOWN_ORG_ADMIN_SIDEBAR_ITEMS: NavigationSidebarItem[] = [
    {
      key: "mcps",
      label: "MCPs",
      icon: "grid_view",
      onClick: () => navigate({ to: "/$org/mcps", params: { org: org ?? "" } }),
    },
    {
      key: "members",
      label: "Members",
      icon: "group",
      onClick: () =>
        navigate({ to: "/$org/members", params: { org: org ?? "" } }),
    },
    {
      key: "settings",
      label: "Settings",
      icon: "settings",
      onClick: () =>
        navigate({ to: "/$org/settings", params: { org: org ?? "" } }),
    },
  ];

  const navigationItems: NavigationSidebarItem[] = isOrgAdminProject
    ? KNOWN_ORG_ADMIN_SIDEBAR_ITEMS
    : [];

  return Promise.resolve(navigationItems);
}

export function useProjectSidebarItems() {
  const { locator } = useProjectContext();
  const navigate = useNavigate();

  const { data: sidebarItems } = useSuspenseQuery({
    queryKey: KEYS.sidebarItems(locator),
    queryFn: () => getProjectSidebarItems({ locator, navigate }),
  });

  return sidebarItems;
}
