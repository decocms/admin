import { useCallback } from "react";
import { useGlobalState } from "../stores/global.tsx";

/**
 * Adds the right context to the pathname, i.e.
 *
 * If you are on the context of /~, it will add the /~ to it
 * If you are on the context of /shared/<teadId>, it will add the /shared/teamId to it
 */
export const useBasePath = () => {
  const { state: { context } } = useGlobalState();

  const withBasePath = useCallback(
    (path: string) => {
      const slug = context?.slug ?? "";
      const rootWithStartingSlash = slug.startsWith("/") ? slug : `/${slug}`;
      const pathWithStartingSlash = path.startsWith("/") ? path : `/${path}`;

      return `${rootWithStartingSlash}${pathWithStartingSlash}`
        .replace(/\/$/g, ""); // removes ending slash
    },
    [context],
  );

  return withBasePath;
};
