import { NotFoundError, useAgent, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useFocusChat } from "../agents/hooks.ts";
import { AgentAvatar } from "../common/avatar/index.tsx";
import { useChatContext } from "./context.tsx";
import { PromptSuggestions } from "./prompt-suggestions.tsx";



// Chat input component with integrations button
function NewChatInput() {
  const [inputValue, setInputValue] = useState("");
  
  const handlePromptSelect = (prompt: string) => {
    setInputValue(prompt);
  };
  
  return (
    <div className="w-full max-w-[800px] mx-auto">
      {/* Chat Input Container */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-3">
        {/* Main Input Area */}
        <div className="mb-3">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask deco.chat or write '/' for tools and more..."
            className="border-0 p-3 text-sm bg-transparent focus-visible:ring-0 placeholder:text-[#78716C]"
          />
        </div>
        
        {/* Gradient separator line */}
        <div 
          className="h-px w-full mb-3"
          style={{
            background: 'linear-gradient(90deg, rgba(255, 193, 22, 0.3) 0%, rgba(208, 236, 26, 1) 25%, rgba(165, 149, 255, 1) 75%, rgba(255, 255, 255, 0.3) 100%)'
          }}
        />
        
        {/* Footer with buttons */}
        <div className="flex justify-between items-center">
          {/* Left side - Integrations button */}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-10 px-3 gap-2 text-[#71717A] hover:bg-gray-50">
              <div className="w-6 h-6 rounded-md bg-[#133918] flex items-center justify-center">
                <Icon name="link" size={14} />
              </div>
              <span>Integrations</span>
            </Button>
          </div>
          
          {/* Right side - Model selector and action buttons */}
          <div className="flex gap-2 items-center">
            {/* Model selector */}
            <Button variant="ghost" size="sm" className="h-10 px-3 gap-2 text-[#78716C] hover:bg-gray-50">
              <div className="w-4 h-4 rounded bg-[#D77655] flex items-center justify-center">
                <div className="w-3 h-3 bg-[#D77655] rounded-sm"></div>
              </div>
              <span>Claude 3.5 Sonnet</span>
              <Icon name="keyboard_arrow_down" size={16} />
            </Button>
            
            {/* Attach button */}
            <Button variant="ghost" size="icon" className="h-10 w-10 text-[#71717A] hover:bg-gray-50">
              <Icon name="attach_file" size={20} />
            </Button>
            
            {/* Mic button */}
            <Button variant="outline" size="icon" className="h-10 w-6 text-[#71717A] border-[#E7E5E4] hover:bg-gray-50">
              <Icon name="mic" size={16} />
            </Button>
            
            {/* Send button */}
            <Button size="icon" className="h-10 w-10 bg-[#292524] hover:bg-[#1C1917]">
              <Icon name="send" size={16} />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Prompt Suggestions with Modal Functionality */}
      <PromptSuggestions onPromptSelect={handlePromptSelect} />
    </div>
  );
}

export function EmptyState() {
  const { agentId } = useChatContext();

  // For Team Agent (main deco.chat agent), show the new design
  if (agentId === WELL_KNOWN_AGENT_IDS.teamAgent) {
    return (
      <div className="h-full flex flex-col">
        {/* Main container with background gradient effect */}
        <div className="flex-1 bg-white border border-[#E7E5E4] rounded-xl mx-4 mb-4 relative overflow-hidden">
          {/* Background gradient blur effect */}
          <div 
            className="absolute top-24 left-32 w-[551px] h-7 blur-[12px] opacity-80"
            style={{
              background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, #FFC116 25%, #D0EC1A 50%, #A595FF 75%, rgba(255, 255, 255, 0.1) 100%)'
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-8 p-6 pt-24">
            {/* Welcome message */}
            <div className="text-center">
              <h1 className="text-3xl font-medium text-[#292524] mb-2">
                Hey, Leandro! 
              </h1>
              <p className="text-3xl text-[#78716C]">
                What will you get done today?
              </p>
          </div>
            
            {/* Chat Input */}
            <NewChatInput />
          </div>
        </div>
      </div>
    );
  }

  // For specific agents, keep the existing behavior
  return (
    <ErrorBoundary
      fallback={<EmptyState.Fallback />}
      shouldCatch={(e) => e instanceof NotFoundError}
    >
      <Suspense fallback={<EmptyState.Skeleton />}>
        <EmptyState.UI />
      </Suspense>
    </ErrorBoundary>
  );
}

EmptyState.Fallback = () => {
  return null;
};

EmptyState.Skeleton = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center animate-pulse gap-4 py-10">
      <div className="bg-muted w-2/3 rounded-xl h-10 ml-auto" />
      <div className="bg-muted w-2/3 rounded-xl h-10 mr-auto" />
      <div className="bg-muted w-2/3 rounded-xl h-10 ml-auto" />
    </div>
  );
};

EmptyState.UI = () => {
  const { agentId, uiOptions } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const editAgent = useFocusChat();

  return (
    <div className="h-full flex flex-col justify-between py-12">
      <div className="flex flex-col items-center justify-center max-w-2xl mx-auto p-4 duration-300 transition-all">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center ">
            <AgentAvatar
              name={agent?.name}
              avatar={agent?.avatar}
              className="rounded-xl"
            />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-medium text-foreground">
                {agent?.name
                  ? agent.name
                  : "Tell me who I am and how I should be"}
              </h2>
            </div>
            <p className="text-muted-foreground mx-6 text-center">
              {agent?.description ?? "The more you share, the better I get."}
            </p>
            {uiOptions.showEditAgent && (
              <Button
                variant="outline"
                onClick={() => editAgent(agentId, crypto.randomUUID())}
              >
                <Icon name="tune" size={16} />
                Edit agent
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
