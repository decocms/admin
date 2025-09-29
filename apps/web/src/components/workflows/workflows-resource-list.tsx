import { ResourcesV2List } from "../resources-v2/list.tsx";

/**
 * Workflows resource list component that renders the ResourcesV2List
 * with the specific integration ID for workflows management
 */
export function WorkflowsResourceList() {
  return (
    <ResourcesV2List
      integrationId="i:workflows-management"
      resourceName="workflow"
    />
  );
}

export default WorkflowsResourceList;
