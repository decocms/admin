import type { Statement } from "@deco/sdk/auth";
import type { AppScope } from "@deco/sdk/hooks";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";

// Default policies required for all integrations
export const DEFAULT_INTEGRATION_POLICIES: Statement[] = [];

export const parseAppScope = (scope: string) => {
  const [bindingName, toolName] = scope.split("::");
  return { bindingName, toolName };
};

/**
 * Extracts the app name (e.g., "@scope/app") from a schema definition that represents a binding/dependency.
 * Used when you already have the property schema (e.g., from schema.properties[propName]).
 */
export const getAppNameFromSchemaDefinition = (
  schemaDefinition: JSONSchema7Definition,
): string | null => {
  if (
    typeof schemaDefinition === "object" &&
    schemaDefinition.properties?.__type
  ) {
    const typeProperty = schemaDefinition.properties.__type;
    if (typeof typeProperty === "object" && "const" in typeProperty) {
      return typeProperty.const as string;
    }
  }
  return null;
};

/**
 * Extracts the app name from a schema by looking up a binding property by name.
 * Used when you have the full schema and need to look up a specific binding.
 */
export const getAppNameFromSchema = (
  schema: JSONSchema7,
  bindingName: string,
): string | undefined => {
  const binding = schema.properties?.[bindingName];
  if (binding) {
    return getAppNameFromSchemaDefinition(binding) ?? undefined;
  }
  return undefined;
};

export interface BindingObject {
  __type: string;
  value: string;
}

export const getBindingObject = (
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
