import {
  type Prompt,
  PromptValidationSchema,
  useAgentData,
  useAgentRoot,
  usePrompt,
  useUpdatePrompt,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useBlocker, useParams } from "react-router";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { trackEvent } from "../../../hooks/analytics.ts";
import { useToolCallListener } from "../../../hooks/use-tool-call-listener.ts";
import {
  AgenticChatProvider,
  createLegacyTransport,
} from "../../chat/provider.tsx";
import { useSetThreadContextEffect } from "../../decopilot/thread-context-provider.tsx";
import { useRouteParams } from "../../canvas/route-params-provider.tsx";
import { Context } from "./context.ts";
import { PromptDetail } from "./form.tsx";

export default function Page() {
  const agentId = WELL_KNOWN_AGENT_IDS.promptAgent;

  // Check for params from RouteParamsProvider (for tab rendering)
  // Fall back to URL params (for direct navigation)
  const routeParams = useRouteParams();
  const urlParams = useParams();
  const _id = routeParams.id || urlParams.id;
  const promptId = _id!;
  const threadId = promptId;

  const {
    data: _prompt,
    isLoading: isLoadingPrompt,
    refetch: refetchPrompt,
  } = usePrompt(promptId);
  const prompt = _prompt || {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    content: "",
    created_at: new Date().toISOString(),
    updated_at: null,
  };
  const { data: _agent, isLoading: isLoadingAgent } = useAgentData(agentId);

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>(prompt);
  const [promptVersion, setPromptVersion] = useState<string | null>(null);

  const form = useForm<Prompt>({
    resolver: zodResolver(PromptValidationSchema),
    defaultValues: {
      id: selectedPrompt.id,
      name: selectedPrompt.name,
      description: selectedPrompt.description,
      content: selectedPrompt.content,
    },
  });

  useEffect(() => {
    if (_prompt) {
      setSelectedPrompt(_prompt);
    }
  }, [_prompt]);

  useEffect(() => {
    form.reset(selectedPrompt);
  }, [selectedPrompt]);

  const updatePrompt = useUpdatePrompt();

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const blocker = useBlocker(numberOfChanges > 0);

  const handleCancel = () => {
    blocker.reset?.();
  };

  const handleDiscard = () => {
    form.reset(prompt);
    blocker.proceed?.();
  };

  const onSubmit = async (data: Prompt) => {
    try {
      // Update the existing integration
      await updatePrompt.mutateAsync({
        id: prompt.id,
        data,
      });

      trackEvent("prompt_update", {
        success: true,
        data,
      });

      form.reset(data);
    } catch (error) {
      console.error(`Error updating prompt:`, error);

      trackEvent("prompt_create", {
        success: false,
        error,
        data,
      });
    }
  };

  const handleRestoreVersion = async () => {
    await updatePrompt.mutateAsync({
      id: prompt.id,
      data: {
        name: selectedPrompt.name,
        content: selectedPrompt.content,
      },
    });
    setPromptVersion(null);
  };

  // Note: Removed useUpdateAgentCache usage - agent instructions are now managed
  // via AgentProvider in the new architecture. The prompt ID context should be
  // passed via chat overrides instead of modifying cached agent data.

  const agentRoot = useAgentRoot(agentId);

  // Set up thread context with rules and tools
  const threadContextItems = useMemo(
    () => [
      {
        id: crypto.randomUUID(),
        type: "rule" as const,
        text: `You are editing the prompt with id: ${promptId}.`,
      },
      {
        id: crypto.randomUUID(),
        type: "toolset" as const,
        integrationId: "i:prompt-management",
        enabledTools: ["PROMPTS_GET", "PROMPTS_UPDATE"],
      },
    ],
    [promptId],
  );

  useSetThreadContextEffect(threadContextItems);

  // Listen for tool calls to refresh data
  useToolCallListener((toolCall) => {
    if (toolCall.toolName === "PROMPTS_UPDATE") {
      refetchPrompt();
    }
  });

  // Show loading state while agent or prompt is loading
  if (isLoadingAgent || isLoadingPrompt) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  // Show error state if agent is not available
  if (!_agent) {
    console.error("[LegacyPromptDetail] Agent data not available", {
      agentId,
      hasAgent: !!_agent,
      isLoadingAgent,
    });
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Failed to load agent data
      </div>
    );
  }

  const transport = useMemo(
    () => createLegacyTransport(threadId, agentId, agentRoot),
    [threadId, agentId, agentRoot],
  );

  return (
    <>
      <AgenticChatProvider
        agentId={agentId}
        threadId={threadId}
        agent={_agent}
        transport={transport}
        uiOptions={{
          showEditAgent: false,
        }}
      >
        <Context.Provider
          value={{
            form,
            prompt: selectedPrompt,
            setSelectedPrompt,
            onSubmit,
            promptVersion,
            setPromptVersion,
            handleRestoreVersion,
            handleDiscard,
            handleCancel,
            blocker,
          }}
        >
          <PromptDetail />
        </Context.Provider>
      </AgenticChatProvider>
    </>
  );
}
