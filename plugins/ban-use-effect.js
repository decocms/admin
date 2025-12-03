/**
 * Lint plugin to ban usages of useEffect.
 */

const noUseEffectRule = {
  create(context) {
    return {
      Identifier(node) {
        if (node.name === "useEffect") {
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
            message:
              "useEffect is not allowed. Please use alternative approaches.",
          });
        }
      },

      MemberExpression(node) {
        // Verify property is an Identifier before accessing .name
        if (node.property.type !== "Identifier" || node.property.name !== "useEffect") {
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
            message:
              "React.useEffect is not allowed. Please use alternative approaches.",
          });
        }
      },
    };
  },
};

const plugin = {
  meta: {
    name: "ban-use-effect",
  },
  rules: {
    "ban-use-effect": noUseEffectRule,
  },
};

export default plugin;
