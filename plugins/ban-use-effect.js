/**
 * Lint plugin to ban usages of useEffect in .tsx files within the apps/mesh project.
 */

const noUseEffectRule = {
  create(context) {
    return {
      Identifier(node) {
        const filename = context.filename || "";
        // Only apply to .tsx files inside apps/mesh
        if (!filename.includes("apps/mesh") || !filename.endsWith(".tsx")) {
          return;
        }

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
              "useEffect is not allowed in @mesh .tsx files. Please use alternative approaches.",
          });
        }
      },

      MemberExpression(node) {
        const filename = context.filename || "";
        // Only apply to .tsx files inside apps/mesh
        if (!filename.includes("apps/mesh") || !filename.endsWith(".tsx")) {
          return;
        }

        if (
          node.object.name === "React" &&
          node.property.name === "useEffect"
        ) {
          context.report({
            node,
            message:
              "React.useEffect is not allowed in @mesh .tsx files. Please use alternative approaches.",
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
