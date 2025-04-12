import {
  DEFAULT_REASONING_MODEL,
  Integration,
  listTools,
  useCreateAgent,
  useFetchIntegration,
  useAgents,
} from "@deco/sdk";
import { useState } from "react";
import { useFocusAgent } from "../../agents/hooks.ts";

export function useCreateExplorerAgent() {
  const { mutateAsync: createAgent } = useCreateAgent();
  const fetchIntegration = useFetchIntegration();
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createExplorerAgent = async (integrationId: string): Promise<string | null> => {
    setIsCreatingAgent(true);
    setError(null);
    
    try {
      // 1. Fetch the integration details
      const integrationData = await fetchIntegration(integrationId);
      console.log("Integration details fetched:", integrationData);
      
      // 2. Use the integration's connection to get its tools
      console.log("Fetching tools using connection:", integrationData.connection);
      const toolsData = await listTools(integrationData.connection);
      console.log("Integration tools fetched:", toolsData);
      
      // 3. Extract tool names from the response
      const toolNames = toolsData.tools.map(tool => tool.name);
      console.log("Available tool names:", toolNames);
      
      // 4. Create the agent with the fetched tools
      const newAgent = await createAgent({
        name: `${integrationData.name} Explorer`,
        id: crypto.randomUUID(),
        avatar: integrationData.icon,
        instructions: `Your goal is to explore the newly installed integration for ${integrationData.name}`,
        // Associate the integration ID with the tools we fetched
        tools_set: { 
          [integrationData.id]: toolNames
        },
        model: DEFAULT_REASONING_MODEL,
        views: [{ url: "", name: "Chat" }],
      });
      
      return newAgent.id;
    } catch (error) {
      console.error("Error in explorer agent creation process:", error);
      const errorMessage = error instanceof Error 
        ? `Failed to create explorer agent: ${error.message}`
        : "Failed to create explorer agent";
      setError(errorMessage);
      return null;
    } finally {
      setIsCreatingAgent(false);
    }
  };
  
  return {
    createExplorerAgent,
    isCreatingAgent,
    error
  };
}

export function useExplorerAgents() {
  const { data: agents = [] } = useAgents();
  const { createExplorerAgent } = useCreateExplorerAgent();
  const focusAgent = useFocusAgent();
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  const goToAgentFor = async (integration: Integration) => {
    setIsRedirecting(true);
    try {
      // TODO: Use a better heuristic when we start naming different integrations
      const expectedAgentName = `${integration.name} Explorer`;
      const existingAgent = agents.find(agent => agent.name === expectedAgentName);
      
      if (existingAgent) {
        // If we found an existing agent, redirect to it with initialMessage
        focusAgent(existingAgent.id, {
          initialMessage: `I want to explore the integration ${integration.name}`
        });
      } else {
        // If no existing agent, create one and then redirect with initialMessage
        const newAgentId = await createExplorerAgent(integration.id);
        if (newAgentId) {
          focusAgent(newAgentId, {
            initialMessage: `I want to explore the integration ${integration.name}`
          });
        }
      }
    } catch (error) {
      console.error("Error while redirecting to explorer agent:", error);
    } finally {
      setIsRedirecting(false);
    }
  };
  
  return {
    goToAgentFor,
    isRedirecting
  };
} 