/**
 * Middleware Composition Utilities
 *
 * Shared utilities for composing middleware pipelines.
 * Used across MCP server implementations.
 */

/**
 * Compose middlewares into a single function
 * Pattern from @deco/sdk/mcp/middlewares.ts
 *
 * @example
 * ```ts
 * const pipeline = compose(middleware1, middleware2, middleware3);
 * const result = await pipeline(request, finalHandler);
 * ```
 */
export const compose = <TRequest, TResponse>(
  ...middlewares: ((
    req: TRequest,
    next: () => Promise<TResponse>,
  ) => Promise<TResponse>)[]
) => {
  return function composedResolver(
    request: TRequest,
    finalHandler: () => Promise<TResponse>,
  ) {
    const dispatch = (i: number): Promise<TResponse> => {
      const middleware = middlewares[i];
      if (!middleware) {
        return finalHandler();
      }
      const next = () => dispatch(i + 1);
      return middleware(request, next);
    };
    return dispatch(0);
  };
};
