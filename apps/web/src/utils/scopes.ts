import type { Statement } from "@deco/sdk/auth";
import type { AppScope } from "@deco/sdk/hooks";
import type { JSONSchema7 } from "json-schema";

// Default policies required for all integrations
const DEFAULT_INTEGRATION_POLICIES: Statement[] = [];

const parseAppScope = (scope: string) => {
  const [bindingName, toolName] = scope.split("::");
  return { bindingName, toolName };
};

const getAppNameFromSchema = (schema: JSONSchema7, bindingName: string) => {
  const binding = schema.properties?.[bindingName];
  if (
    typeof binding === "object" &&
    binding !== null &&
    "properties" in binding
  ) {
    const typeProperty = binding.properties?.__type;
    if (
      typeof typeProperty === "object" &&
      typeProperty !== null &&
      "const" in typeProperty
    ) {
      return typeProperty.const as string;
    }
  }
  return undefined;
};

export interface BindingObject {
  __type: string;
  value: string;
}

const getBindingObject = (
  formData: Record<string, unknown>,
  prop: string,
): BindingObject | undefined => {
  if (
    formData?.[prop] &&
    typeof formData[prop] === "object" &&
    "value" in formData[prop] &&
    typeof formData[prop].value === "string"
  ) {
    return formData[prop] as BindingObject;
  }
  return undefined;
};

/**
 * Get all scopes (default + integration-specific) formatted as AppScope objects
 */
export const getAllScopes = (
  scopes: string[],
  schema?: JSONSchema7,
): AppScope[] => {
  return [
    ...new Set([
      ...DEFAULT_INTEGRATION_POLICIES.map((policy) => policy.resource),
      ...scopes,
    ]),
  ].map((scope) => {
    const { bindingName, toolName } = parseAppScope(scope);
    return {
      name: toolName ?? scope,
      app:
        schema && bindingName
          ? getAppNameFromSchema(schema, bindingName)
          : undefined,
    };
  });
};

/**
 * Create policy statements from scopes and form data
 */
export const createPolicyStatements = (
  scopes: string[],
  formData: Record<string, unknown>,
): Statement[] => {
  return [
    ...DEFAULT_INTEGRATION_POLICIES,
    ...scopes.map((scope: string): Statement => {
      const { bindingName, toolName } = parseAppScope(scope);
      const binding = getBindingObject(formData, bindingName);
      const integrationId = binding?.value;
      return {
        effect: "allow" as const,
        resource: toolName ?? scope,
        ...(integrationId
          ? {
              matchCondition: {
                resource: "is_integration",
                integrationId,
              },
            }
          : {}),
      };
    }),
  ];
};
