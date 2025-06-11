import { useMemo } from "react";
import { type Agent, useCreateKnowledge, useIntegrations } from "@deco/sdk";

const DEFAULT_DIMENSION = 1536;
const convertUUIDToValidAlphanumeric = (uuid: string) =>
  uuid.replaceAll("-", "");

export const useAgentKnowledgeIntegration = (
  { id: idProp }: Agent,
) => {
  const id = useMemo(() => convertUUIDToValidAlphanumeric(idProp), [idProp]);
  const knowledgeIntegrationId = useMemo(() => `i:knowledge-base-${id}`, [id]);
  const integrations = useIntegrations();
  const knowledgeIntegration = useMemo(
    () =>
      integrations.data?.find((integration) =>
        integration.id === knowledgeIntegrationId
      ),
    [knowledgeIntegrationId, integrations],
  );

  const createKnowledge = useCreateKnowledge();

  const createAgentKnowledge = async () => {
    if (knowledgeIntegration) {
      return { name: id, dimmension: DEFAULT_DIMENSION };
    }
    const kb = await createKnowledge.mutateAsync({ name: id });
    integrations.refetch();

    // Add the knowledge_base_search tool at agent

    return kb;
  };

  return {
    integration: knowledgeIntegration,
    createAgentKnowledge,
  };
};
