/**
 * Create accessibilty tools for MCP tools.
 *
 * This is used to control access to MCP tools.
 *
 * @usage
 *    If setAccess is called with false once, it will reeturn false for all subsequent calls.
 *    If setAccess is called with true, it will return true for all subsequent calls.
 *    If setAccess is not called, it will return false.
 *
 * @example
 *    const authTools = createAuthTools();
 *
 *    authTools.canAccess(); // false
 *
 *    authTools.setAccess(true);
 *    authTools.canAccess(); // true
 *
 *    authTools.setAccess(false);
 *    authTools.canAccess(); // false
 *
 *    authTools.setAccess(true);
 *    authTools.canAccess(); // false
 */
export const createAuthTools = () => {
  let setOnce = false;
  let canAccess = true;

  return {
    setAccess: (access: boolean) => {
      canAccess &&= access;
      setOnce = true;
    },
    canAccess: () => canAccess && setOnce,
    reset: () => {
      setOnce = false;
      canAccess = true;
    },
  };
};

export type AuthTools = ReturnType<typeof createAuthTools>;
