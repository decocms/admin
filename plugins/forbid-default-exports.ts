const plugin: Deno.lint.Plugin = {
  name: "forbid-default-exports",
  rules: {
    "no-default-export": {
      create(context) {
        return {
          ExportDefaultDeclaration(node) {
            context.report({
              node,
              message:
                "Default exports are not allowed. Use named exports instead (e.g., 'export { myFunction }' or 'export function myFunction() {}').",
            });
          },
        };
      },
    },
  },
};

// deno-lint-ignore forbid-default-exports/no-default-export
export default plugin; 