/**
 * Hooks para integração com o sistema de tools/integrações.
 *
 * Estes hooks conectam a UI com as tools do server que fazem interface
 * com as integrações INTEGRATIONS, REGISTRY e APIKEYS.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/rpc";

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
  outputSchema?: any;
}
export interface Integration {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tools?: Tool[];
}

// Tipos base para as tools
interface InstalledTool {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  access?: any;
}

interface AvailableTool {
  id: string;
  workspace: string;
  scopeId: string;
  scopeName: string;
  appName: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
}

interface RegistryScope {
  id: string;
  scopeName: string;
  workspace: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook para listar tools instaladas no workspace atual
 */
export const useInstalledTools = () => {
  return useQuery({
    queryKey: ["installed-tools"],
    queryFn: async () => {
      const result = await client.LIST_INSTALLED_INTEGRATIONS({});
      return result;
    },
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    retry: 2,
  });
};

/**
 * Hook para listar tools disponíveis para instalação no registry
 */
export const useAvailableTools = (search?: string) => {
  return useQuery({
    queryKey: ["available-tools", search],
    queryFn: async () => {
      const result = await client.LIST_REGISTRY_APPS({
        search: search || undefined,
      });
      return result;
    },
    enabled: true,
    staleTime: 10 * 60 * 1000, // Cache por 10 minutos
    retry: 2,
  });
};

/**
 * Hook para obter detalhes de uma integração específica
 */
export const useIntegrationDetails = (integrationId: string) => {
  return useQuery({
    queryKey: ["integration-details", integrationId],
    queryFn: async () => {
      const result = await client.GET_INTEGRATION_DETAILS({
        integrationId,
      });
      return result;
    },
    enabled: !!integrationId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
};

/**
 * Hook para chamar/executar uma tool de integração
 */
export const useCallIntegrationTool = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      params,
    }: {
      id?: string;
      params: Record<string, any>;
    }) => {
      const result = await client.CALL_INTEGRATION_TOOL({
        id,
        params,
      });
      return result;
    },
    onSuccess: () => {
      // Invalidar cache de tools instaladas após uso
      queryClient.invalidateQueries({ queryKey: ["installed-tools"] });
    },
    onError: (error) => {
      console.error("Error calling integration tool:", error);
    },
  });
};

/**
 * Hook para listar escopos disponíveis no registry
 */
export const useRegistryScopes = () => {
  return useQuery({
    queryKey: ["registry-scopes"],
    queryFn: async () => {
      const result = await client.LIST_REGISTRY_SCOPES({});
      return result;
    },
    staleTime: 30 * 60 * 1000, // Cache por 30 minutos
    retry: 2,
  });
};

/**
 * Hook personalizado para filtrar tools instaladas por critério
 */
export const useFilteredInstalledTools = (filter?: {
  hasAuth?: boolean;
  enabled?: boolean;
  search?: string;
}) => {
  const { data, ...queryResult } = useInstalledTools();

  const filteredTools =
    data?.success && data.integrations
      ? data.integrations.filter((tool: InstalledTool) => {
          if (filter?.search) {
            const searchLower = filter.search.toLowerCase();
            const matchesSearch =
              tool.name.toLowerCase().includes(searchLower) ||
              tool.description?.toLowerCase().includes(searchLower);
            if (!matchesSearch) return false;
          }

          // Outros filtros podem ser adicionados aqui
          return true;
        })
      : [];

  return {
    data: {
      ...data,
      integrations: filteredTools,
    },
    ...queryResult,
  };
};

/**
 * Hook personalizado para filtrar tools disponíveis por critério
 */
export const useFilteredAvailableTools = (filter?: {
  scope?: string;
  search?: string;
}) => {
  const { data, ...queryResult } = useAvailableTools(filter?.search);

  const filteredTools =
    data?.success && data.apps
      ? data.apps.filter((tool: AvailableTool) => {
          if (filter?.scope && tool.scopeName !== filter.scope) {
            return false;
          }

          return true;
        })
      : [];

  return {
    data: {
      ...data,
      apps: filteredTools,
    },
    ...queryResult,
  };
};

/**
 * Hook principal para listar integrations com tools
 * Usa LIST_INSTALLED_INTEGRATIONS e retorna formato compatível
 *
 * Optimizations:
 * - Longer stale time (10min) to reduce refetches
 * - Removed select function - data is already in correct format from API
 * - Structural sharing for better memoization
 * - Return early to avoid unnecessary processing
 */
export const useIntegrations = () => {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      // @ts-ignore - Will be typed after gen:self
      const result = await client.LIST_INSTALLED_INTEGRATIONS({});

      if (result.success && result.integrations) {
        // Ensure tools array exists for each integration
        // Do this ONCE in queryFn instead of on every render in select
        const normalized = result.integrations.map(
          (integration: Integration) => {
            // Only create new object if tools is missing
            if (!integration.tools) {
              return { ...integration, tools: [] };
            }
            return integration;
          },
        );

        return normalized as Integration[];
      }

      return [];
    },
    staleTime: 10 * 60 * 1000, // Cache 10 min (increased from 5)
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 min after becoming unused
    retry: 2,
    // Enable structural sharing to prevent unnecessary re-renders
    structuralSharing: true,
    // Disable refetch on window focus to reduce API calls
    refetchOnWindowFocus: false,
  });
};

// Exportar types para uso em outros componentes
export type { InstalledTool, AvailableTool, RegistryScope };
