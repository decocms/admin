import { ResourcesV2List } from "../resources-v2/list.tsx";

/**
 * Tools resource list component that renders the ResourcesV2List
 * with the specific integration ID for tools management
 */
export function ToolsResourceList() {
  return (
    <ResourcesV2List integrationId="i:tools-management" resourceName="tool" />
  );
}

export default ToolsResourceList;
