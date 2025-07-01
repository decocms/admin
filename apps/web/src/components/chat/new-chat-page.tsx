import { SDKProvider, type Workspace, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { useUser } from "../../hooks/use-user.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { AppSidebar } from "../sidebar/index.tsx";
import { PromptSuggestions } from "./prompt-suggestions.tsx";
import { SlashCommandAutocomplete } from "./slash-command-autocomplete.tsx";
import { ToolChip } from "./tool-chip.tsx";
import { WithWorkspaceTheme } from "../theme.tsx";
import RegisterActivity from "../common/register-activity.tsx";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { ModelSelector } from "./model-selector.tsx";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { ChatProvider, useChatContext } from "./context.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { Chat } from "../agent/chat.tsx";
import type { Tab } from "../dock/index.tsx";

// Definindo o estilo do gradiente animado
const gradientKeyframes = `
@keyframes gradientMove {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes glowPulse {
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
}
`;



// Chat input component with integrations button
function NewChatInput({ showSuggestions = true }: { showSuggestions?: boolean }) {
  const [inputValue, setInputValue] = useState("");
  const { preferences, setPreferences } = useUserPreferences();
  const { chat } = useChatContext();
  const textareaRef = useRef<HTMLInputElement>(null);
  
  // Slash command autocomplete state
  const [showSlashAutocomplete, setShowSlashAutocomplete] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashPosition, setSlashPosition] = useState({ top: 0, left: 0 });
  const [slashStartIndex, setSlashStartIndex] = useState(-1);
  
  // Selected tools state
  const [selectedTools, setSelectedTools] = useState<Array<{
    id: string;
    name: string;
    icon?: string;
  }>>([]);
  
  const handlePromptSelect = (prompt: string) => {
    setInputValue(prompt);
  };

  // Handle input changes and detect slash commands
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    
    setInputValue(value);
    
    // Look for slash command
    const beforeCursor = value.slice(0, cursorPosition);
    const lastSlashIndex = beforeCursor.lastIndexOf('/');
    
    // Check if we have a slash command
    if (lastSlashIndex !== -1) {
      const afterSlash = beforeCursor.slice(lastSlashIndex + 1);
      
      // Check if it's a valid slash command (no spaces before slash in current word)
      const beforeSlash = beforeCursor.slice(0, lastSlashIndex);
      const isValidSlash = beforeSlash.length === 0 || beforeSlash.match(/\s$/);
      
      if (isValidSlash && !afterSlash.includes(' ')) {
        // Show autocomplete
        setSlashQuery(afterSlash);
        setSlashStartIndex(lastSlashIndex);
        setShowSlashAutocomplete(true);
        
        // Calculate position for autocomplete
        if (e.target) {
          const rect = e.target.getBoundingClientRect();
          setSlashPosition({
            top: rect.bottom + 5,
            left: rect.left,
          });
        }
      } else {
        setShowSlashAutocomplete(false);
      }
    } else {
      setShowSlashAutocomplete(false);
    }
  };

  // Handle slash command selection
  const handleSlashSelect = (item: any) => {
    // Add tool to selected tools if not already added
    const isAlreadySelected = selectedTools.some(tool => tool.id === item.id);
    if (!isAlreadySelected) {
      setSelectedTools(prev => [...prev, {
        id: item.id,
        name: item.name,
        icon: item.icon,
      }]);
    }
    
    // Remove the slash command from input
    const beforeSlash = inputValue.slice(0, slashStartIndex);
    const afterQuery = inputValue.slice(slashStartIndex + 1 + slashQuery.length);
    const newValue = `${beforeSlash}${afterQuery}`.trim();
    setInputValue(newValue);
    setShowSlashAutocomplete(false);
    
    // Focus back to input
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };
  
  // Handle tool removal
  const handleToolRemove = (toolId: string) => {
    setSelectedTools(prev => prev.filter(tool => tool.id !== toolId));
  };

  // Handle integrations button click (inserts slash)
  const handleIntegrationsClick = () => {
    const currentValue = inputValue;
    const newValue = currentValue + (currentValue && !currentValue.endsWith(' ') ? ' /' : '/');
    setInputValue(newValue);
    
    // Focus input and trigger slash detection
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const length = newValue.length;
        textareaRef.current.setSelectionRange(length, length);
        
        // Manually trigger the slash detection
        const fakeEvent = {
          target: { 
            value: newValue, 
            selectionStart: length,
            getBoundingClientRect: () => textareaRef.current!.getBoundingClientRect()
          }
        } as any;
        handleInputChange(fakeEvent);
      }
    }, 0);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (inputValue.trim()) {
      // Create message content with tool context
      let messageContent = inputValue;
      
      // If tools are selected, include them in the message context
      if (selectedTools.length > 0) {
        const toolsContext = selectedTools.map(tool => `@${tool.name}`).join(' ');
        messageContent = `${toolsContext} ${inputValue}`.trim();
      }
      
      // Enviar mensagem usando o contexto do chat
      await chat.append({
        role: "user",
        content: messageContent
      });
      
      // Limpar o input e ferramentas após enviar
      setInputValue("");
      setSelectedTools([]);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[800px] mx-auto">
      {/* Chat Input Container */}
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-3 relative">
        {/* Gradient border effect - now with animation */}
        <style>{gradientKeyframes}</style>
        
        {/* External glow effect */}
        <div 
          className="absolute -top-[3px] -left-[1px] -right-[1px] h-[5px] pointer-events-none z-[-1]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 193, 22, 0.2) 15%, rgba(255, 193, 22, 0.9) 25%, rgba(208, 236, 26, 0.9) 40%, rgba(165, 149, 255, 0.9) 60%, rgba(165, 149, 255, 0.2) 85%, transparent 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradientMove 3s ease infinite',
            borderRadius: '10px 10px 0 0',
            filter: 'blur(3px)',
          }}
        />
        
        {/* Secondary glow for better diffusion */}
        <div 
          className="absolute -top-[5px] -left-[2px] -right-[2px] h-[8px] pointer-events-none z-[-1]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 193, 22, 0.1) 15%, rgba(255, 193, 22, 0.5) 25%, rgba(208, 236, 26, 0.5) 40%, rgba(165, 149, 255, 0.5) 60%, rgba(165, 149, 255, 0.1) 85%, transparent 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradientMove 3s ease infinite, glowPulse 4s ease infinite',
            borderRadius: '10px 10px 0 0',
            filter: 'blur(6px)',
          }}
        />
        
        {/* Tertiary glow for maximum diffusion */}
        <div 
          className="absolute -top-[8px] -left-[3px] -right-[3px] h-[12px] pointer-events-none z-[-1]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 193, 22, 0.05) 20%, rgba(255, 193, 22, 0.3) 30%, rgba(208, 236, 26, 0.3) 45%, rgba(165, 149, 255, 0.3) 55%, rgba(165, 149, 255, 0.05) 80%, transparent 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradientMove 3s ease infinite',
            borderRadius: '12px 12px 0 0',
            filter: 'blur(8px)',
          }}
        />
        
        {/* Selected Tools */}
        {selectedTools.length > 0 && (
          <div className="mb-3 px-3 pt-3 flex flex-wrap gap-2">
            {selectedTools.map((tool) => (
              <ToolChip
                key={tool.id}
                name={tool.name}
                icon={tool.icon}
                onRemove={() => handleToolRemove(tool.id)}
              />
            ))}
          </div>
        )}

        {/* Main Input Area */}
        <div className="mb-3">
          <Input
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Ask deco.chat or write '/' for tools and more..."
            className="border-0 p-3 text-sm bg-transparent focus-visible:ring-0 placeholder:text-[#78716C]"
          />
        </div>
        
        {/* Footer with buttons */}
        <div className="flex justify-between items-center">
          {/* Left side - Integrations button */}
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-10 px-3 gap-2 text-[#71717A] hover:bg-gray-50"
              onClick={handleIntegrationsClick}
              type="button"
            >
              <Icon name="linked_services" size={16} />
              <span>Integrations</span>
            </Button>
          </div>
          
          {/* Right side - Model selector and action buttons */}
          <div className="flex gap-2 items-center">
            {/* Model selector */}
            <div className="h-10 flex items-center">
              <ModelSelector 
                model={preferences.defaultModel}
                onModelChange={(modelId) => {
                  setPreferences({ ...preferences, defaultModel: modelId });
                }}
                variant="borderless"
                side="bottom"
              />
            </div>
            
            {/* Attach button */}
            <Button variant="ghost" size="icon" className="h-10 w-10 text-[#71717A] hover:bg-gray-50">
              <Icon name="attach_file" size={16} />
            </Button>
            
            {/* Mic button */}
            <Button variant="ghost" size="icon" className="h-10 w-10 text-[#71717A] hover:bg-gray-50">
              <Icon name="mic" size={16} />
            </Button>
            
            {/* Send button */}
            <Button type="submit" size="icon" className="h-10 w-10 bg-[#292524] hover:bg-[#1C1917]">
              <Icon name="send" size={16} />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Prompt Suggestions with Modal Functionality - only shown in empty state */}
      {showSuggestions && <PromptSuggestions onPromptSelect={handlePromptSelect} />}
      
      {/* Slash Command Autocomplete */}
      <SlashCommandAutocomplete
        isVisible={showSlashAutocomplete}
        position={slashPosition}
        query={slashQuery}
        onSelect={handleSlashSelect}
        onClose={() => setShowSlashAutocomplete(false)}
      />
    </form>
  );
}

// Breadcrumb component for New Chat - now using DefaultBreadcrumb
function NewChatBreadcrumb() {
  return (
    <DefaultBreadcrumb 
      items={[{
        label: (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#A8A29E] flex items-center justify-center border border-[#78716C]/10 shadow-sm">
              <Icon name="edit_square" size={14} />
            </div>
            <span className="text-sm font-medium text-[#292524]">New chat</span>
          </div>
        )
      }]}
    />
  );
}

// Empty state component
function EmptyStateContent() {
  const user = useUser();
  const firstName = user?.name?.split(' ')[0] || 'Leandro';
  
  return (
    <div className="h-full bg-white border md:rounded-xl md:shadow-md relative overflow-hidden">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-8 p-6 pt-24 h-full">
        {/* Welcome message */}
        <div className="text-center">
          <h1 className="text-3xl font-medium text-[#292524] mb-2">
            Hey, {firstName}! 
          </h1>
          <p className="text-3xl text-[#78716C]">
            What will you get done today?
          </p>
        </div>
        
        {/* Chat Input */}
        <NewChatInput />
      </div>
    </div>
  );
}

// Main New Chat Page Component
function NewChatPageContent() {
  const { chat } = useChatContext();
  const hasMessages = chat.messages.length > 0;
  
  if (hasMessages) {
    // Use existing Chat component when there are messages
    return <Chat />;
  }

  // For empty state, use PageLayout with custom tab
  const tabs: Record<string, Tab> = {
    newChat: {
      title: "New Chat",
      Component: EmptyStateContent,
      initialOpen: true,
      active: true,
    },
  };

  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={<NewChatBreadcrumb />}
    />
  );
}

// Main exported component with proper providers
export default function NewChatPage() {
  const {
    value: defaultOpen,
    update: setDefaultOpen,
  } = useLocalStorage({ key: "deco-chat-sidebar", defaultValue: true });
  const [open, setOpen] = useState(defaultOpen);
  const { teamSlug } = useParams();
  const user = useUser();
  const threadId = crypto.randomUUID();

  const rootContext: Workspace = teamSlug
    ? `shared/${teamSlug}`
    : `users/${user?.id}`;

  return (
    <SDKProvider workspace={rootContext}>
      <WithWorkspaceTheme>
        <SidebarProvider
          open={open}
          onOpenChange={(open: boolean) => {
            setDefaultOpen(open);
            setOpen(open);
          }}
          className="h-full bg-sidebar"
          style={{
            "--sidebar-width": "16rem",
            "--sidebar-width-mobile": "14rem",
          } as Record<string, string>}
        >
          <AppSidebar />
          <SidebarInset className="h-full flex-col bg-sidebar">
            <ChatProvider
              agentId={WELL_KNOWN_AGENT_IDS.teamAgent}
              threadId={threadId}
            >
              <NewChatPageContent />
            </ChatProvider>
          </SidebarInset>
          <RegisterActivity teamSlug={teamSlug} />
          <Toaster />
        </SidebarProvider>
      </WithWorkspaceTheme>
    </SDKProvider>
  );
} 