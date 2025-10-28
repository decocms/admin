/**
 * Lint plugin to enforce the use of the centralized KEYS constant
 * instead of inline array literals or other constants for queryKey properties.
 *
 * This rule ensures all queryKey values use KEYS factory functions.
 * ✅ KEYS.tool(locator, uri)
 * ✅ KEYS.resources(locator, integrationId, resourceName)
 * ❌ ["tool", locator, uri]
 * ❌ resourceKeys.tool(locator, uri)
 * ❌ otherConstant.method(...)
 */

const enforceQueryKeyConstantsRule = {
  create(context) {
    return {
      Property(node) {
        // Check for queryKey properties
        if (node.key.name === "queryKey" || node.key.value === "queryKey") {
          // Check for inline array values
          if (node.value?.type === "ArrayExpression") {
            context.report({
              node: node.value,
              message:
                "queryKey must use the centralized KEYS constant instead of inline arrays. Replace with KEYS.methodName(...).",
            });
          }

          // Check for non-KEYS constants
          if (
            node.value?.type === "CallExpression" &&
            node.value.callee?.type === "MemberExpression"
          ) {
            const objectName = node.value.callee.object?.name;
            if (objectName && objectName !== "KEYS") {
              context.report({
                node: node.value,
                message: `queryKey must use the centralized KEYS constant. Replace ${objectName} with KEYS.`,
              });
            }
          }
        }
      },

      CallExpression(node) {
        // Check for invalidateQueries, refetchQueries, and similar methods
        if (
          (node.callee.property?.name === "invalidateQueries" ||
            node.callee.property?.name === "refetchQueries" ||
            node.callee.property?.name === "setQueryData" ||
            node.callee.property?.name === "getQueryData") &&
          node.arguments[0]?.type === "ObjectExpression"
        ) {
          const queryKeyProp = node.arguments[0].properties.find(
            (prop) => prop.key.name === "queryKey" || prop.key.value === "queryKey"
          );

          if (!queryKeyProp) return;

          // Check for inline arrays
          if (queryKeyProp.value?.type === "ArrayExpression") {
            context.report({
              node: queryKeyProp.value,
              message:
                "queryKey must use the centralized KEYS constant instead of inline arrays. Replace with KEYS.methodName(...).",
            });
          }

          // Check for non-KEYS constants
          if (
            queryKeyProp.value?.type === "CallExpression" &&
            queryKeyProp.value.callee?.type === "MemberExpression"
          ) {
            const objectName = queryKeyProp.value.callee.object?.name;
            if (objectName && objectName !== "KEYS") {
              context.report({
                node: queryKeyProp.value,
                message: `queryKey must use the centralized KEYS constant. Replace ${objectName} with KEYS.`,
              });
            }
          }
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "enforce-query-key-constants",
  },
  rules: {
    "enforce-query-key-constants": enforceQueryKeyConstantsRule,
  },
};

export default plugin;
