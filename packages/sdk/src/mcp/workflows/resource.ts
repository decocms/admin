import { DeconfigResource } from "../deconfig/deconfig-resource.ts";

export const RESOURCE_NAME = "workflow";

export const WorkflowResource = DeconfigResource.define({
  directory: "/src/workflows",
  resourceName: RESOURCE_NAME,
});
