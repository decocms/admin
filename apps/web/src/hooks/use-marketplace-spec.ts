// deno-lint-ignore no-external-import-restrictions
import type { Integration } from "@deco/sdk";
import { useMarketplaceIntegrations } from "@deco/sdk";
import { useMemo } from "react";
import {
  adaptDecoToMarketplace,
  type DecoIntegration,
  type MarketplaceIntegration,
} from "../components/integrations/marketplace-adapter.ts";

interface MarketplaceResult {
  integrations: MarketplaceIntegration[];
}

/**
 * Detecta se integração está em formato Deco (antigo) ou MCP Spec (novo)
 *
 * Deco: tem appName, friendlyName, ou provider
 * MCP: tem _meta com namespace oficial ou estrutura MCP completa
 */
function isDecoFormat(
  integration: Integration,
): integration is DecoIntegration {
  const decoFields = integration as Partial<DecoIntegration>;
  const hasAppName = decoFields.appName !== undefined;
  const hasFriendlyName = decoFields.friendlyName !== undefined;
  const hasProvider =
    decoFields.provider !== undefined && !isOfficialMCPRegistry(integration);

  return hasAppName || hasFriendlyName || hasProvider;
}

/**
 * Checks if integration has official MCP registry metadata
 */
function isOfficialMCPRegistry(integration: Integration): boolean {
  const metaObj = (integration as Record<string, unknown>)?._meta;
  if (!metaObj || typeof metaObj !== "object") return false;

  // Check for official MCP registry namespace
  const metaDict = metaObj as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(
    metaDict,
    "io.modelcontextprotocol.registry/official",
  );
}

/**
 * Hook wrapper que automaticamente detecta origem e adapta se necessário
 *
 * Suporta:
 * - Deco Backend: adapta para MCP Spec
 * - MCP Oficial: passa direto (já é MCP Spec)
 * - Híbrido: adapta só o que precisar
 *
 * @example
 * const { data } = useMarketplaceSpec();
 * // data.integrations é sempre MCP Spec compliant
 */
export function useMarketplaceSpec() {
  const { data, isLoading, isError, error } = useMarketplaceIntegrations();

  const adaptedData = useMemo<MarketplaceResult>(() => {
    if (!data?.integrations) {
      return { integrations: [] };
    }

    return {
      integrations: data.integrations.map((integration) => {
        if (isDecoFormat(integration)) {
          return adaptDecoToMarketplace(integration);
        }

        // MCP Registry apps are used as-is
        // Keep @marketplace/appId format - don't normalize
        return integration as MarketplaceIntegration;
      }),
    };
  }, [data]);

  return {
    data: adaptedData,
    isLoading: isLoading ?? false,
    isError: isError ?? false,
    error: error ?? undefined,
  };
}
