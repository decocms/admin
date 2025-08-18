import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCurrentTeam, useUpdateTeamTheme, WELL_KNOWN_AGENT_IDS, useWorkspaceWalletBalance, useClaimOnboardingBonus, useProfile } from "@deco/sdk";
import { DECO_CHAT_API } from "@deco/sdk/constants";
import { motion, AnimatePresence } from "framer-motion";
import { AgentProvider } from "../agent/provider.tsx";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { useAgent } from "../agent/provider.tsx";
import { ModelSelectorFigma } from "../chat/model-selector-figma.tsx";

interface ExtractedTheme {
  variables: {
    "--background": string;
    "--foreground": string;
    "--primary": string;
    "--primary-foreground": string;
    "--secondary": string;
    "--secondary-foreground": string;
    "--muted": string;
    "--muted-foreground": string;
    "--accent": string;
    "--accent-foreground": string;
    "--destructive": string;
    "--destructive-foreground": string;
    "--border": string;
    "--input": string;
  };
  isDark: boolean;
}

interface OnboardingState {
  step: "initial" | "chat";
  extractedTheme?: ExtractedTheme;
  themeStatus: "loading" | "ready" | "applied" | "skipped";
  isLoadingTheme: boolean;
  message: string;
  companyName?: string;
  claimedBonus: boolean;
  isLoadingExtraSuggestions: boolean;
  companyContext?: {
    industry?: string;
    description?: string;
    taskSuggestions?: Array<{
      id: string;
      title: string;
      description: string;
      integration?: string;
    }>;
  };
}

interface TaskSuggestion {
  id: string;
  icon?: string;
  iconColor?: string;
  label?: string;
  title: string;
  description?: string;
  integration?: {
    name: string;
    icon: string;
  };
}

function MainChatContent() {
  const { teamSlug } = useParams();
  const { data: team } = useCurrentTeam();
  const { data: profile } = useProfile();
  const { mutateAsync: updateTeamTheme, isPending: isUpdatingTheme } = useUpdateTeamTheme();
  const { chat, agent } = useAgent();
  const walletBalance = useWorkspaceWalletBalance();
  const { mutateAsync: claimBonus, isPending: isClaimingBonus } = useClaimOnboardingBonus();
  
  const [state, setState] = useState<OnboardingState>({
    step: "initial",
    themeStatus: "loading",
    isLoadingTheme: true,
    message: "",
    claimedBonus: localStorage.getItem(`team-${team?.id}-claimed-bonus`) === "true",
    isLoadingExtraSuggestions: false,
  });

  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("claude-3-5-sonnet-20241022");
  
  // Extract domain from team data
  const domain = useMemo(() => {
    return "deco.cx"; // For demo purposes
  }, []);

  // Get user's first name
  const userName = useMemo(() => {
    const fullName = profile?.metadata?.full_name || "there";
    return fullName.split(" ")[0];
  }, [profile?.metadata?.full_name]);
  
  // Fetch theme on mount
  useEffect(() => {
    async function fetchTheme() {
      const url = `${DECO_CHAT_API}/:root/:slug/workflows/onboarding-theme/start`.replace(":root", "shared").replace(":slug", teamSlug ?? "");
      const requestBody = { domain };
      
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const json = await res.json();
        const extracted = json?.data?.theme as ExtractedTheme | undefined;
        const companyContext = json?.data?.companyContext;
        
        const finalTheme: ExtractedTheme = extracted || {
          variables: {
            "--background": "#ffffff",
            "--foreground": "#292524",
            "--primary": "#292524",
            "--primary-foreground": "#fafaf9",
            "--secondary": "#f5f5f4",
            "--secondary-foreground": "#292524",
            "--muted": "#f5f5f4",
            "--muted-foreground": "#78716c",
            "--accent": "#d0ec1a",
            "--accent-foreground": "#292524",
            "--destructive": "#dc2626",
            "--destructive-foreground": "#fef2f2",
            "--border": "#e7e5e4",
            "--input": "#e7e5e4",
          },
          isDark: false,
        };
        
        setState(prev => ({
          ...prev,
          isLoadingTheme: false,
          themeStatus: "ready",
          extractedTheme: finalTheme,
          message: `I noticed you're with ${domain}! I created a custom theme matching your brand. What do you think?`,
          companyName: json?.data?.companyName || domain,
          companyContext: companyContext || {
            industry: "Technology",
            description: "A modern company focused on digital innovation",
          },
        }));
      } catch (error) {
        console.error("[MAIN_CHAT] fetchTheme:error", error);
        setState(prev => ({
          ...prev,
          isLoadingTheme: false,
          themeStatus: "skipped",
        }));
      }
    }
    
    fetchTheme();
  }, [domain, teamSlug]);
  
  const handleAcceptTheme = async () => {
    if (!state.extractedTheme) return;
    
    try {
      await updateTeamTheme({
        teamId: String(team?.id ?? ""),
        theme: {
          variables: state.extractedTheme.variables,
        },
      });
      
      setState(prev => ({
        ...prev,
        themeStatus: "applied",
        isLoadingExtraSuggestions: true,
      }));

      // Simulate loading extra suggestions
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          isLoadingExtraSuggestions: false,
        }));
      }, 1500);
    } catch (error) {
      console.error("[MAIN_CHAT] handleAcceptTheme:error", error);
    }
  };
  
  const handleSkipTheme = () => {
    setState(prev => ({
      ...prev,
      themeStatus: "skipped",
      isLoadingExtraSuggestions: true,
    }));

    // Simulate loading extra suggestions
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isLoadingExtraSuggestions: false,
      }));
    }, 1500);
  };

  const handleClaimBonus = async () => {
    if (state.claimedBonus || isClaimingBonus) return;
    
    try {
      // Call API to add $2 to wallet
      await claimBonus();
      
      // Mark as claimed in localStorage
      localStorage.setItem(`team-${team?.id}-claimed-bonus`, "true");
      setState(prev => ({
        ...prev,
        claimedBonus: true,
      }));
      
      // Refresh wallet balance
      walletBalance.refetch();
    } catch (error) {
      console.error("Failed to claim bonus:", error);
      // Could show a toast notification here
    }
  };
  
  // Generate suggestions based on theme status
  const suggestions = useMemo<TaskSuggestion[]>(() => {
    const baseSuggestions: TaskSuggestion[] = [];

    // If theme is shown (not applied/skipped), show 4 suggestions
    // If theme is hidden (applied/skipped), show 6 suggestions (2x3 grid)
    const suggestionCount = (state.themeStatus === "ready" || state.themeStatus === "loading") ? 4 : 6;

    // Domain-specific suggestions
    if (state.companyContext?.taskSuggestions && state.companyContext.taskSuggestions.length > 0) {
      return state.companyContext.taskSuggestions.slice(0, suggestionCount).map(suggestion => ({
        id: suggestion.id,
        label: "Suggested task",
        title: suggestion.title,
        integration: suggestion.integration ? {
          name: suggestion.integration,
          icon: getIconForIntegration(suggestion.integration),
        } : undefined,
      }));
    }

    // Default suggestions
    const allSuggestions: TaskSuggestion[] = [
      {
        id: "search-perplexity",
        label: "Suggested task",
        title: "Search ___ on perplexity",
        integration: {
          name: "Perplexity",
          icon: "search",
        },
      },
      {
        id: "sales-data",
        label: "Suggested task",
        title: "Search sales data for deco's store",
        integration: {
          name: "Integration",
          icon: "hub",
        },
      },
      {
        id: "linkedin-image",
        label: "Suggested task",
        title: "Generate image for LinkedIn",
        integration: {
          name: "LinkedIn",
          icon: "image",
        },
      },
      {
        id: "analyze-data",
        label: "Suggested task",
        title: "Analyze my data and find new trends",
        integration: {
          name: "Sheets",
          icon: "table_chart",
        },
      },
      {
        id: "customer-support",
        label: "Suggested task",
        title: "Build a Customer Support Agent",
        integration: {
          name: "Slack",
          icon: "chat",
        },
      },
      {
        id: "content-creator",
        label: "Suggested task",
        title: "Content Creation Agent",
        integration: {
          name: "WordPress",
          icon: "article",
        },
      },
    ];

    return allSuggestions.slice(0, suggestionCount);
  }, [state.themeStatus, state.companyContext]);
  
  function getIconForIntegration(integration: string): string {
    const iconMap: Record<string, string> = {
      "Google Sheets": "table_chart",
      "Sheets": "table_chart",
      "Slack": "chat",
      "HubSpot": "hub",
      "LinkedIn": "work",
      "Perplexity": "search",
      "Integration": "extension",
      "WordPress": "article",
    };
    return iconMap[integration] || "extension";
  }

  // Check if we should show chat messages
  const showChatMessages = chat.messages.length > 0 || state.step === "chat";
  
  // Hide suggestions and show chat when user starts typing
  const handleSendMessage = () => {
    if (inputValue.trim()) {
      chat.append({
        role: "user",
        content: inputValue.trim(),
      });
      setInputValue("");
      setState(prev => ({ ...prev, step: "chat" }));
    }
  };

  const handleSuggestionClick = (suggestion: TaskSuggestion) => {
    chat.append({
      role: "user",
      content: suggestion.title,
    });
    setState(prev => ({ ...prev, step: "chat" }));
  };

  if (showChatMessages) {
    return (
      <div className="flex flex-col h-full max-w-[740px] mx-auto px-4">
        <div className="flex-1 overflow-y-auto py-8">
          <ChatMessages />
        </div>
        <div className="shrink-0 pb-6">
          <ChatInput />
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center px-4 pt-6 pb-0">
        <div className="w-full max-w-[740px] flex flex-col gap-8">
          {/* Header */}
          <motion.div 
            className="text-center flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-normal text-stone-800">
                Welcome, {userName}
              </h1>
              <p className="text-2xl font-normal text-stone-500">
                Where should we begin?
              </p>
            </div>
            
            {/* Claim $2 Button */}
            {!state.claimedBonus && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClaimBonus}
                disabled={isClaimingBonus}
                className="rounded-xl px-6 py-1.5 border-stone-200 text-stone-800"
              >
                {isClaimingBonus ? "Claiming..." : "Claim $2"}
              </Button>
            )}
          </motion.div>
          
          {/* Content Grid */}
          <div className="grid grid-cols-[300px_1fr_1fr] grid-rows-[1fr_200px] gap-2 h-[416px]">
            {/* Theme Card - Takes full height of left column */}
            {(state.themeStatus === "ready" || state.themeStatus === "loading") && (
              <motion.div
                className="row-span-2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="h-full bg-stone-100 border-0 p-6 flex flex-col rounded-3xl">
                  <div className="flex flex-col gap-4 flex-1">
                    <h3 className="text-lg font-medium text-stone-800">Update your theme</h3>
                    <p className="text-sm text-stone-500 leading-relaxed">
                      {state.isLoadingTheme 
                        ? "Analyzing your website colors..." 
                        : state.message}
                    </p>
                    
                    {!state.isLoadingTheme && state.extractedTheme && (
                      <>
                        {/* Color Preview */}
                        <div className="flex gap-0 items-center">
                          {[
                            "#78716c", // stone-500
                            "#292524", // stone-800
                            "#e7e5e4", // stone-200
                            "#fafaf9", // stone-50
                            "#f5f5f4", // stone-100
                            "#d0ec1a", // accent
                            "#dc2626", // red-600
                            "#fef2f2", // red-50
                          ].map((color, i) => (
                            <div 
                              key={i}
                              className="w-6 h-6 rounded-[9px] border border-black/10 -mr-1.5 relative z-10"
                              style={{ 
                                backgroundColor: color,
                                zIndex: 8 - i 
                              }}
                            />
                          ))}
                        </div>
                        
                        {/* Mini Preview */}
                        <div className="flex-1 relative rounded-t-[15px] overflow-hidden border border-stone-200/20 shadow-2xl">
                          <div 
                            className="absolute inset-0 bg-stone-50"
                          >
                            {/* Mini app preview */}
                            <div className="h-full flex scale-[0.5] origin-top-left" style={{ width: '200%', height: '200%' }}>
                              {/* Sidebar */}
                              <div className="w-[202px] p-4 bg-stone-50">
                                <div className="h-10 w-20 rounded mb-8 bg-stone-800 opacity-20" />
                                {[...Array(8)].map((_, i) => (
                                  <div key={i} className="flex items-center gap-4 p-4 rounded">
                                    <div className="w-4 h-4 rounded-sm bg-stone-800 opacity-20" />
                                    <div className="h-4 w-16 rounded bg-stone-100" />
                                  </div>
                                ))}
                                <div className="flex items-center gap-4 p-4 rounded bg-[#d0ec1a] bg-opacity-50">
                                  <div className="w-4 h-4 rounded-sm bg-[#d0ec1a]" />
                                  <div className="h-4 w-28 rounded bg-[#d0ec1a]" />
                                </div>
                              </div>
                              {/* Main content */}
                              <div className="flex-1 p-4">
                                <div className="h-14 border-b mb-4 border-stone-200">
                                  <div className="h-10 w-40 rounded bg-stone-800 opacity-20" />
                                </div>
                                <div className="flex gap-4">
                                  <div className="flex-1 h-[800px] border rounded-lg bg-white border-stone-200" />
                                  <div className="flex-1 h-[800px] border rounded-lg bg-white border-stone-200" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Actions */}
                  {!state.isLoadingTheme && (
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleSkipTheme}
                        disabled={isUpdatingTheme}
                        className="flex-1 border-stone-200 text-stone-800"
                      >
                        Skip
                      </Button>
                      <Button
                        onClick={handleAcceptTheme}
                        disabled={isUpdatingTheme}
                        className="flex-1 bg-stone-800 text-stone-50"
                      >
                        {isUpdatingTheme ? "Applying..." : "Accept theme"}
                      </Button>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
            
            {/* Suggestions Grid - Adjusts based on theme visibility */}
            {suggestions.map((suggestion, index) => {
              // Calculate grid position based on theme visibility
              let gridClass = "";
              const isThemeVisible = state.themeStatus === "ready" || state.themeStatus === "loading";
              
              if (isThemeVisible) {
                // Theme is visible - 2x2 grid on the right
                const positions = [
                  "col-start-2 row-start-1",
                  "col-start-3 row-start-1", 
                  "col-start-2 row-start-2",
                  "col-start-3 row-start-2",
                ];
                gridClass = positions[index] || "";
              } else {
                // Theme is hidden - 3x2 grid
                const positions = [
                  "col-start-1 row-start-1",
                  "col-start-2 row-start-1",
                  "col-start-3 row-start-1",
                  "col-start-1 row-start-2",
                  "col-start-2 row-start-2",
                  "col-start-3 row-start-2",
                ];
                gridClass = positions[index] || "";
              }

              // Show skeleton for new suggestions when theme is hidden
              const showSkeleton = !isThemeVisible && state.isLoadingExtraSuggestions && (index === 0 || index === 3);
              
              if (showSkeleton) {
                return (
                  <div key={`skeleton-${index}`} className={`${gridClass} bg-stone-100 rounded-3xl p-6`}>
                    <Skeleton className="w-10 h-10 rounded-xl mb-auto" />
                    <div className="space-y-2 mt-auto">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-5 w-full" />
                    </div>
                  </div>
                );
              }
              
              return (
                <motion.button
                  key={suggestion.id}
                  className={`${gridClass} bg-stone-100 hover:bg-stone-100/80 transition-all duration-200 rounded-3xl p-6 text-left group hover:shadow-md flex flex-col justify-between`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {/* Integration Icon */}
                  {suggestion.integration && (
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <Icon 
                        name={suggestion.integration.icon} 
                        className="w-5 h-5 text-stone-800"
                      />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="space-y-2">
                    {suggestion.label && (
                      <p className="text-xs text-stone-500">{suggestion.label}</p>
                    )}
                    <p className="text-lg font-medium leading-tight text-stone-800">
                      {suggestion.title}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Chat Input - Fixed at bottom */}
      <div className="shrink-0 px-4 pb-4">
        <div className="w-full max-w-[600px] mx-auto">
          <Card className="bg-white border border-stone-100 shadow-lg rounded-[20px] p-3">
            <div className="flex flex-col gap-3">
              {/* Input Area - Click anywhere to focus */}
              <div 
                className="min-h-[60px] px-3 py-2 cursor-text"
                onClick={(e) => {
                  const textarea = e.currentTarget.querySelector('textarea');
                  if (textarea) textarea.focus();
                }}
              >
                <textarea
                  placeholder="Ask anything or @ to mention an agent"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full min-h-[40px] border-0 resize-none focus-visible:ring-0 focus:outline-none text-base placeholder:text-stone-500/60 bg-transparent"
                />
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between">
                {/* Left Actions */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Icon name="attach_file" className="w-[18px] h-[18px]" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Icon name="mic" className="w-[18px] h-[18px]" />
                  </Button>
                  
                  {/* Model Selector */}
                  <div className="ml-2">
                    <ModelSelectorFigma 
                      model={selectedModel}
                      onModelChange={setSelectedModel}
                      variant="bordered"
                    />
                  </div>
                </div>
                
                {/* Right Actions */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-10 w-10 border-stone-200">
                    <Icon name="stop" className="w-[18px] h-[18px]" />
                  </Button>
                  <Button 
                    size="icon" 
                    className="h-10 w-10 bg-stone-800 hover:bg-stone-700"
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                  >
                    <Icon name="send" className="w-[18px] h-[18px] text-white" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function MainChat() {
  const { teamSlug } = useParams();
  
  return (
    <AgentProvider
      agentId={WELL_KNOWN_AGENT_IDS.teamAgent}
      threadId={WELL_KNOWN_AGENT_IDS.teamAgent}
      uiOptions={{
        showThreadTools: false,
        showThreadMessages: false,
        showModelSelector: false,
        showAgentVisibility: false,
        showEditAgent: false,
      }}
    >
      <MainChatContent />
    </AgentProvider>
  );
}