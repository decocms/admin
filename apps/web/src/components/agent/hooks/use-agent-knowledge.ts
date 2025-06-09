import { useMemo } from "react";
import {
  type Agent,
  useCreateKnowledge,
  useIntegration,
  useIntegrations,
} from "@deco/sdk";

const DEFAULT_DIMENSION = 1536;
const convertUUIDToValidAlphanumeric = (uuid: string) =>
  uuid.replaceAll("-", "");

export const useAgentKnowledgeIntegration = (
  { id: idProp }: Pick<Agent, "id">,
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
  // const knowledgeIntegration = useIntegration(knowledgeIntegrationId);

  const createKnowledge = useCreateKnowledge();

  const createAgentKnowledge = async () => {
    if (knowledgeIntegration) {
      return { name: id, dimmension: DEFAULT_DIMENSION };
    }
    const kb = await createKnowledge.mutateAsync({ name: id });
    // await knowledgeIntegration.refetch();
    integrations.refetch();

    return kb;
  };

  return {
    integration: knowledgeIntegration,
    createAgentKnowledge,
  };
};
