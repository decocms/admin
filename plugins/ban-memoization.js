/**
 * Lint plugin to ban usages of useMemo and useCallback.
 */

const noMemoizationRule = {
  create(context) {
    return {
      Identifier(node) {
        if (node.name === "useMemo" || node.name === "useCallback") {
          // Skip if this identifier is part of an import declaration
          let parent = node.parent;
          while (parent) {
            if (
              parent.type === "ImportSpecifier" ||
              parent.type === "ImportDefaultSpecifier" ||
              parent.type === "ImportNamespaceSpecifier"
            ) {
              return; // Allow imports
            }
            parent = parent.parent;
          }

          context.report({
            node,
            message: `${node.name} is not allowed. React Compiler handles memoization automatically.`,
          });
        }
      },

      MemberExpression(node) {
        // Verify property is an Identifier before accessing .name
        if (node.property.type !== "Identifier") {
          return;
        }

        const propertyName = node.property.name;
        if (propertyName !== "useMemo" && propertyName !== "useCallback") {
          return;
        }

        // Walk nested MemberExpressions to find the left-most object
        let object = node.object;
        while (object.type === "MemberExpression") {
          object = object.object;
        }

        // Verify the final object is an Identifier with name === 'React'
        if (object.type === "Identifier" && object.name === "React") {
          context.report({
            node,
            message: `React.${propertyName} is not allowed. React Compiler handles memoization automatically.`,
          });
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "ban-memoization",
  },
  rules: {
    "ban-memoization": noMemoizationRule,
  },
};

export default plugin;
