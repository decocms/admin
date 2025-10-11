import { type ReactNode, useEffect } from "react";
import { useSearchParams } from "react-router";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";
import { ResourcesV2List } from "../resources-v2/list.tsx";

/**
 * Views resource list component that renders the ResourcesV2List
 * with the specific integration ID for views management
 */
export function ViewsResourceList({
  headerSlot,
}: {
  headerSlot?: ReactNode;
} = {}) {
  const [searchParams] = useSearchParams();
  const { setOpen: setDecopilotOpen } = useDecopilotOpen();

  // Automatically open Decopilot if openDecopilot query param is present
  useEffect(() => {
    const openDecopilot = searchParams.get("openDecopilot") === "true";
    if (openDecopilot) {
      setDecopilotOpen(true);
    }
  }, [searchParams, setDecopilotOpen]);

  return (
    <ResourcesV2List
      integrationId="i:views-management"
      resourceName="view"
      headerSlot={headerSlot}
    />
  );
}

export default ViewsResourceList;
