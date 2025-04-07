import { useRuntime } from "@deco/sdk/hooks";
import { useCallback } from "react";

/**
 * Adds the right context to the pathname, i.e.
 *
 * If you are on the context of /~, it will add the /~ to it
 * If you are on the context of /shared/<teadId>, it will add the /shared/teamId to it
 */
export const useBasePath = () => {
  const { state: { context } } = useRuntime();

  const withBasePath = useCallback(
    (path: string) => {
      const root = context?.root ?? "";
      const rootWithStartingSlash = root.startsWith("/") ? root : `/${root}`;
      const pathWithStartingSlash = path.startsWith("/") ? path : `/${path}`;

      return `${rootWithStartingSlash}${pathWithStartingSlash}`;
    },
    [context],
  );

  return withBasePath;
};
