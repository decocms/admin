import { useMemo } from "react";
import { useMatches } from "react-router";
import { useDocumentMetadata } from "./use-document-metadata.ts";

interface RouteHandle {
  title?: string;
}

interface UseEntityDocumentTitleOptions<T> {
  entity: T | undefined;
  entitySlug: string | undefined;
  getEntityName: (entity: T, slug: string | undefined) => string;
  pathSliceIndex: number;
  defaultPageName: string;
}

/**
 * Hook genérico que define o título do documento baseado em uma entidade e página atual
 * Formato: "Entity Name › Page Name"
 *
 * Usa a propriedade handle do React Router para obter o título da página
 */
export function useEntityDocumentTitle<T>({
  entity,
  entitySlug,
  getEntityName,
  pathSliceIndex,
  defaultPageName,
}: UseEntityDocumentTitleOptions<T>) {
  const matches = useMatches();

  // Extrai o nome da página das rotas
  const pageName = useMemo(() => {
    // Primeiro, tenta obter o título do handle da rota
    for (let i = matches.length - 1; i >= 0; i--) {
      const handle = matches[i].handle as RouteHandle | undefined;
      if (handle?.title) {
        return handle.title;
      }
    }

    // Fallback: extrai o path da última correspondência
    const lastMatch = matches[matches.length - 1];
    if (lastMatch?.pathname) {
      const parts = lastMatch.pathname.split("/").filter(Boolean);
      if (parts.length < pathSliceIndex + 1) return defaultPageName;

      const pagePath = parts.slice(pathSliceIndex).join("/");

      if (pathSliceIndex === 1) {
        return pagePath;
      }

      // Fallback: capitaliza a primeira parte do path
      const firstPart = pagePath.split("/")[0];
      return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
    }

    return defaultPageName;
  }, [matches, pathSliceIndex, defaultPageName]);

  const title = useMemo(() => {
    const entityName = getEntityName(entity as T, entitySlug);
    if (!entityName) return "deco";
    if (pageName === defaultPageName) return entityName;
    return `${entityName} › ${pageName}`;
  }, [entity, entitySlug, getEntityName, pageName, defaultPageName]);

  useDocumentMetadata({ title });
}
