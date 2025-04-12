import {
  DEFAULT_REASONING_MODEL,
  Integration,
  listTools,
  useCreateAgent,
  useFetchIntegration,
} from "@deco/sdk";
import { useState } from "react";

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