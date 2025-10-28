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
          // Get the actual value, unwrapping TypeScript assertions like "as const"
          let valueNode = node.value;
          if (
            valueNode?.type === "TSAsExpression" ||
            valueNode?.type === "TSTypeAssertion"
          ) {
            valueNode = valueNode.expression;
          }

          // Check for inline array values
          if (valueNode?.type === "ArrayExpression") {
            context.report({
              node: node.value,
              message:
                "queryKey must use the centralized KEYS constant instead of inline arrays. Replace with KEYS.methodName(...).",
            });
          }

          // Check for non-KEYS constants
          if (
            valueNode?.type === "CallExpression" &&
            valueNode.callee?.type === "MemberExpression"
          ) {
            const objectName = valueNode.callee.object?.name;
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
            (prop) =>
              prop.key.name === "queryKey" || prop.key.value === "queryKey",
          );

          if (!queryKeyProp) return;

          // Get the actual value, unwrapping TypeScript assertions like "as const"
          let valueNode = queryKeyProp.value;
          if (
            valueNode?.type === "TSAsExpression" ||
            valueNode?.type === "TSTypeAssertion"
          ) {
            valueNode = valueNode.expression;
          }

          // Check for inline arrays
          if (valueNode?.type === "ArrayExpression") {
            context.report({
              node: queryKeyProp.value,
              message:
                "queryKey must use the centralized KEYS constant instead of inline arrays. Replace with KEYS.methodName(...).",
            });
          }

          // Check for non-KEYS constants
          if (
            valueNode?.type === "CallExpression" &&
            valueNode.callee?.type === "MemberExpression"
          ) {
            const objectName = valueNode.callee.object?.name;
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
