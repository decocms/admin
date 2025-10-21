import {
  type Agent,
  useCreateAgent as useCreateAgentSDK,
  useUpdateThreadMessages,
} from "@deco/sdk";
import { useFocusChat } from "../components/agents/hooks.ts";
import { trackEvent } from "./analytics.ts";

export const useCreateAgent = () => {
  const createAgent = useCreateAgentSDK();
  const updateThreadMessages = useUpdateThreadMessages();
  const focusEditAgent = useFocusChat();

  const create = async (
    agent: Partial<Agent>,
    { eventName }: { eventName?: string },
  ) => {
    const createdAgent = await createAgent.mutateAsync(agent);
    updateThreadMessages(createdAgent.id);
    // Replace history when creating from well-known agent to avoid back button going to template
    const isFromWellKnown = eventName === "agent_create_from_well_known";
    focusEditAgent(createdAgent.id, crypto.randomUUID(), { 
      history: false,
      replace: isFromWellKnown,
    });
    trackEvent(eventName || "agent_create", {
      success: true,
      data: agent,
    });
  };

  return create;
};
