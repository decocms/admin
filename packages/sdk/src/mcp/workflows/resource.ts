import { DeconfigResource } from "../deconfig/deconfig-resource.ts";
import { WorkflowDefinitionSchema } from "./workflow-schemas.ts";

export const RESOURCE_NAME = "workflow";

export const WorkflowResource = DeconfigResource.define({
  directory: "/src/workflows",
  resourceName: RESOURCE_NAME,
  schema: WorkflowDefinitionSchema,
});
