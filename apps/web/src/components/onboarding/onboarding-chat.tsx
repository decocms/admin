import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useCurrentTeam, useUpdateTeamTheme, useProfile } from "@deco/sdk";
import { DECO_CHAT_API } from "@deco/sdk/constants";
import { cn } from "@deco/ui/lib/utils.ts";
import { motion, AnimatePresence } from "framer-motion";

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
  step: "theme" | "suggestions" | "chat";
  extractedTheme?: ExtractedTheme;
  themeApplied: boolean;
  isLoadingTheme: boolean;
  message: string;
  companyName?: string;
  isLoadingSuggestions?: boolean;
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
  icon: string;
  iconColor?: string;
  title: string;
  description: string;
  integration?: {
    name: string;
    icon: string;
  };
}

export function OnboardingChat() {
  const { teamSlug } = useParams();
  const { data: team } = useCurrentTeam();
  const { data: profile } = useProfile();
  const { mutateAsync: updateTeamTheme, isPending: isUpdatingTheme } = useUpdateTeamTheme();
  
  const [state, setState] = useState<OnboardingState>({
    step: "theme",
    themeApplied: false,
    isLoadingTheme: true,
    message: "",
  });
  
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  
  // Extract domain from team data
  const domain = useMemo(() => {
    // For demo purposes, we'll use deco.cx
    // In production, this would come from team settings
    return "deco.cx"; // team?.domain || "deco.cx";
  }, []);
  
  // Fetch theme on mount
  useEffect(() => {
    async function fetchTheme() {
      const url = `${DECO_CHAT_API}/:root/:slug/workflows/onboarding-theme/start`.replace(":root", "shared").replace(":slug", teamSlug ?? "");
      const requestBody = { domain };
      
      console.log("[ONBOARDING_CHAT] fetchTheme:start", { domain, teamSlug });
      
      try {
        // Call API to kick off workflow (currently calls tool under the hood)
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        
        console.log("[ONBOARDING_CHAT] fetchTheme:response", { status: res.status, ok: res.ok });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const json = await res.json().catch((parseError) => {
          console.error("[ONBOARDING_CHAT] fetchTheme:json-parse-error", parseError);
          return {} as any;
        });
        
        const extracted = (json as any)?.data?.theme as ExtractedTheme | undefined;
        const companyContext = (json as any)?.data?.companyContext;
        console.log("[ONBOARDING_CHAT] fetchTheme:extracted", { 
          theme: extracted, 
          isDark: extracted?.isDark,
          primaryColor: extracted?.variables?.["--primary"],
          companyContext
        });
        
        const finalTheme: ExtractedTheme = extracted || {
          variables: {
            "--background": "#ffffff",
            "--foreground": "#292524",
            "--primary": "#292524",
            "--primary-foreground": "#ffffff",
            "--secondary": "#f5f5f4",
            "--secondary-foreground": "#292524",
            "--muted": "#f5f5f4",
            "--muted-foreground": "#78716c",
            "--accent": "#d0ec1a",
            "--accent-foreground": "#292524",
            "--destructive": "#dc2626",
            "--destructive-foreground": "#ffffff",
            "--border": "#e7e5e4",
            "--input": "#e7e5e4",
          },
          isDark: false,
        };
        
        console.log("[ONBOARDING_CHAT] fetchTheme:success", { 
          domain, 
          isDark: finalTheme.isDark,
          colors: Object.keys(finalTheme.variables).length 
        });
        
        // Log the complete generated theme without fallbacks
        console.log("[ONBOARDING_CHAT] COMPLETE_GENERATED_THEME:", {
          totalVariables: Object.keys(finalTheme.variables).length,
          variables: finalTheme.variables,
          isDark: finalTheme.isDark,
          message: (json as any).data?.message,
          companyName: (json as any).data?.companyName,
          favicon: (json as any).data?.favicon
        });
        
        // Log each variable for easy inspection
        console.log("[ONBOARDING_CHAT] THEME_VARIABLES_BREAKDOWN:");
        Object.entries(finalTheme.variables).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
        
        setState(prev => ({
          ...prev,
          isLoadingTheme: false,
          extractedTheme: finalTheme,
          message: `I noticed you're with ${domain}! I created a custom ${finalTheme.isDark ? 'dark' : 'light'} theme matching your brand. What do you think?`,
          companyName: (json as any)?.data?.companyName || domain,
          companyContext: companyContext || {
            industry: "Technology",
            description: "A modern company focused on digital innovation",
          },
        }));
      } catch (error) {
        console.error("[ONBOARDING_CHAT] fetchTheme:error", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          domain,
          teamSlug,
          timestamp: new Date().toISOString()
        });
        setState(prev => ({
          ...prev,
          isLoadingTheme: false,
          step: "suggestions",
        }));
      }
    }
    
    fetchTheme();
  }, [domain]);
  
  const handleAcceptTheme = async () => {
    if (!state.extractedTheme) {
      console.warn("[ONBOARDING_CHAT] handleAcceptTheme:no-theme", {
        extractedTheme: state.extractedTheme,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
          console.log("[ONBOARDING_CHAT] handleAcceptTheme:start", { teamId: team?.id });
    
    try {
      const updateResult = await updateTeamTheme({
        teamId: String(team?.id ?? ""),
        theme: {
          variables: state.extractedTheme.variables,
        },
      });
      
      console.log("[ONBOARDING_CHAT] handleAcceptTheme:success", { 
        teamId: updateResult.id,
        themeApplied: true 
      });
      
      setState(prev => ({
        ...prev,
        themeApplied: true,
        step: "suggestions",
      }));
    } catch (error) {
      console.error("[ONBOARDING_CHAT] handleAcceptTheme:error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        teamId: team?.id,
        theme: state.extractedTheme,
        timestamp: new Date().toISOString()
      });
    }
  };
  
  const handleSkipTheme = () => {
    setState(prev => ({
      ...prev,
      step: "suggestions",
    }));
  };
  
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    setMessages(prev => [...prev, { role: "user", content: chatInput }]);
    setChatInput("");
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'll help you with that! Let me guide you through the process...",
      }]);
    }, 1000);
  };
  
  // Generate dynamic suggestions based on company context
  const suggestions = useMemo<TaskSuggestion[]>(() => {
    // Use task suggestions from company context if available
    if (state.companyContext?.taskSuggestions && state.companyContext.taskSuggestions.length > 0) {
      return state.companyContext.taskSuggestions.slice(0, 3).map(suggestion => ({
        id: suggestion.id,
        icon: getIconForTask(suggestion.id),
        iconColor: getColorForTask(suggestion.id),
        title: suggestion.title,
        description: suggestion.description,
        integration: suggestion.integration ? {
          name: suggestion.integration,
          icon: getIconForIntegration(suggestion.integration),
        } : undefined,
      }));
    }
    
    // Default suggestions
    const baseSuggestions: TaskSuggestion[] = [
      {
        id: "linkedin-post",
        icon: "edit_note",
        iconColor: "#0077B5",
        title: "Create a LinkedIn Post Creator",
        description: "Generate engaging LinkedIn content based on your brand voice",
        integration: {
          name: "Google Sheets",
          icon: "table_chart",
        },
      },
      {
        id: "customer-support",
        icon: "support_agent",
        iconColor: "#10B981",
        title: "Build a Customer Support Agent",
        description: "Handle customer inquiries with AI-powered responses",
        integration: {
          name: "Slack",
          icon: "chat",
        },
      },
      {
        id: "sales-assistant",
        icon: "trending_up",
        iconColor: "#8B5CF6",
        title: "Set up a Sales Assistant",
        description: "Automate lead qualification and follow-ups",
        integration: {
          name: "HubSpot",
          icon: "hub",
        },
      },
    ];
    
    return baseSuggestions;
  }, [state.companyContext]);
  
  // Helper functions for icon mapping
  function getIconForTask(taskId: string): string {
    const iconMap: Record<string, string> = {
      "linkedin-post": "edit_note",
      "customer-support": "support_agent",
      "sales-assistant": "trending_up",
      "product-recommendations": "recommend",
      "inventory-assistant": "inventory_2",
      "customer-reviews": "rate_review",
      "onboarding-assistant": "person_add",
      "api-docs-helper": "code",
      "usage-analytics": "analytics",
      "content-creator": "article",
      "campaign-analyzer": "campaign",
      "lead-qualifier": "filter_alt",
    };
    return iconMap[taskId] || "auto_awesome";
  }
  
  function getColorForTask(taskId: string): string {
    const colorMap: Record<string, string> = {
      "linkedin-post": "#0077B5",
      "customer-support": "#10B981",
      "sales-assistant": "#8B5CF6",
      "product-recommendations": "#F59E0B",
      "inventory-assistant": "#06B6D4",
      "customer-reviews": "#EC4899",
      "onboarding-assistant": "#3B82F6",
      "api-docs-helper": "#6366F1",
      "usage-analytics": "#14B8A6",
      "content-creator": "#84CC16",
      "campaign-analyzer": "#F97316",
      "lead-qualifier": "#A855F7",
    };
    return colorMap[taskId] || "#6B7280";
  }
  
  function getIconForIntegration(integration: string): string {
    const iconMap: Record<string, string> = {
      "Google Sheets": "table_chart",
      "Slack": "chat",
      "HubSpot": "hub",
      "Shopify": "shopping_cart",
      "Intercom": "forum",
      "GitHub": "code",
      "WordPress": "article",
      "Google Analytics": "analytics",
    };
    return iconMap[integration] || "extension";
  }
  
  return (
    <div className="flex flex-col h-full max-w-[700px] mx-auto p-4 gap-8">
      {/* Header */}
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-normal text-foreground">
          Welcome, {profile?.metadata?.full_name?.split(" ")[0] || "there"}
        </h1>
      </motion.div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        {/* Theme Card - Animated */}
        <AnimatePresence mode="wait">
          {state.step === "theme" && !state.themeApplied && (
            <motion.div
              key="theme-card-full"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-muted border-0 overflow-hidden">
                <CardContent className="p-0">
              <div className="flex flex-row gap-6">
                <div className="flex-1 p-8 flex flex-col justify-between gap-4">
                  <div className="space-y-4">
                    <h2 className="text-xl font-normal text-foreground">
                      Update your theme
                    </h2>
                    <p className="text-muted-foreground">
                      {state.isLoadingTheme 
                        ? "Analyzing your website colors..." 
                        : state.message}
                    </p>
                  </div>
                  
                  {!state.isLoadingTheme && state.extractedTheme && (
                    <>
                      {/* Color Preview */}
                      <div className="bg-background rounded-xl p-2 flex flex-row items-center justify-between">
                        <div className="w-6 h-6 rounded-lg border border-border/10" style={{ backgroundColor: state.extractedTheme?.variables?.["--background"] || "#ffffff" }} />
                        <div className="w-6 h-6 rounded-lg border border-border/10" style={{ backgroundColor: state.extractedTheme?.variables?.["--foreground"] || "#292524" }} />
                        <div className="w-6 h-6 rounded-lg border border-border/10" style={{ backgroundColor: state.extractedTheme?.variables?.["--primary"] || "#292524" }} />
                        <div className="w-6 h-6 rounded-lg border border-border/10" style={{ backgroundColor: state.extractedTheme?.variables?.["--secondary"] || "#f5f5f4" }} />
                        <div className="w-6 h-6 rounded-lg border border-border/10" style={{ backgroundColor: state.extractedTheme?.variables?.["--muted"] || "#f5f5f4" }} />
                        <div className="w-6 h-6 rounded-lg border border-border/10" style={{ backgroundColor: state.extractedTheme?.variables?.["--accent"] || "#d0ec1a" }} />
                        <div className="w-6 h-6 rounded-lg border border-border/10" style={{ backgroundColor: state.extractedTheme?.variables?.["--destructive"] || "#dc2626" }} />
                        <div className="w-6 h-6 rounded-lg border border-border/10" style={{ backgroundColor: state.extractedTheme?.variables?.["--border"] || "#e7e5e4" }} />
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={handleSkipTheme}
                          disabled={isUpdatingTheme}
                        >
                          Skip
                        </Button>
                        <Button
                          onClick={handleAcceptTheme}
                          disabled={isUpdatingTheme}
                        >
                          {isUpdatingTheme ? "Applying..." : "Accept theme"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Preview Window */}
                <div className="flex-1 relative p-5">
                  <div 
                    className="absolute inset-5 rounded-2xl border shadow-2xl overflow-hidden"
                    style={{ 
                      backgroundColor: state.extractedTheme?.variables?.["--background"] || "#ffffff",
                      borderColor: state.extractedTheme?.variables?.["--border"] || "#e7e5e4"
                    }}
                  >
                    {/* Mini app preview */}
                    <div className="h-full flex">
                      {/* Sidebar */}
                      <div 
                        className="w-28 p-2"
                        style={{ backgroundColor: state.extractedTheme?.variables?.["--muted"] || "#f5f5f4" }}
                      >
                        <div 
                          className="h-5 w-10 rounded mb-4" 
                          style={{ backgroundColor: state.extractedTheme?.variables?.["--foreground"] || "#292524", opacity: 0.2 }}
                        />
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded">
                            <div 
                              className="w-2 h-2 rounded-sm" 
                              style={{ backgroundColor: state.extractedTheme?.variables?.["--foreground"] || "#292524", opacity: 0.2 }}
                            />
                            <div 
                              className="h-2 w-8 rounded" 
                              style={{ backgroundColor: state.extractedTheme?.variables?.["--background"] || "#ffffff" }}
                            />
                          </div>
                        ))}
                        <div 
                          className="flex items-center gap-2 p-2 rounded"
                          style={{ backgroundColor: state.extractedTheme?.variables?.["--accent"] || "#d0ec1a", opacity: 0.5 }}
                        >
                          <div 
                            className="w-2 h-2 rounded-sm" 
                            style={{ backgroundColor: state.extractedTheme?.variables?.["--accent"] || "#d0ec1a" }}
                          />
                          <div 
                            className="h-2 w-14 rounded" 
                            style={{ backgroundColor: state.extractedTheme?.variables?.["--accent"] || "#d0ec1a" }}
                          />
                        </div>
                      </div>
                      {/* Main content */}
                      <div className="flex-1 p-2">
                        <div 
                          className="h-7 border-b mb-2"
                          style={{ borderColor: state.extractedTheme?.variables?.["--border"] || "#e7e5e4" }}
                        >
                          <div 
                            className="h-5 w-20 rounded" 
                            style={{ backgroundColor: state.extractedTheme?.variables?.["--foreground"] || "#292524", opacity: 0.2 }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <div 
                            className="flex-1 h-96 border rounded"
                            style={{ 
                              backgroundColor: state.extractedTheme?.variables?.["--background"] || "#ffffff",
                              borderColor: state.extractedTheme?.variables?.["--border"] || "#e7e5e4"
                            }}
                          />
                          <div 
                            className="flex-1 h-96 border rounded"
                            style={{ 
                              backgroundColor: state.extractedTheme?.variables?.["--background"] || "#ffffff",
                              borderColor: state.extractedTheme?.variables?.["--border"] || "#e7e5e4"
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
            </motion.div>
          )}
          
          {/* Compressed Theme Card */}
          {state.themeApplied && (
            <motion.div
              key="theme-card-compressed"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-muted border-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Icon name="check_circle" className="w-4 h-4 text-muted-foreground opacity-50" />
                    <span className="text-foreground">Updated theme</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setState(prev => ({ ...prev, themeApplied: false, step: "theme" }));
                      }}
                    >
                      Undo
                    </Button>
                    {/* Mini preview */}
                    <div className="ml-auto h-full relative" style={{ width: "200px", height: "80px" }}>
                      <div 
                        className="absolute inset-0 rounded-lg border shadow-lg overflow-hidden scale-[0.3] origin-right"
                        style={{ 
                          backgroundColor: state.extractedTheme?.variables?.["--background"] || "#ffffff",
                          borderColor: state.extractedTheme?.variables?.["--border"] || "#e7e5e4",
                          width: "600px",
                          height: "240px"
                        }}
                      >
                        {/* Mini app preview */}
                        <div className="h-full flex">
                          {/* Sidebar */}
                          <div 
                            className="w-32 p-2"
                            style={{ backgroundColor: state.extractedTheme?.variables?.["--muted"] || "#f5f5f4" }}
                          >
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="h-3 w-20 rounded mb-2" 
                                style={{ backgroundColor: state.extractedTheme?.variables?.["--background"] || "#ffffff" }}
                              />
                            ))}
                          </div>
                          {/* Main content */}
                          <div className="flex-1 p-4">
                            <div className="h-full rounded" 
                              style={{ 
                                backgroundColor: state.extractedTheme?.variables?.["--background"] || "#ffffff",
                                border: `1px solid ${state.extractedTheme?.variables?.["--border"] || "#e7e5e4"}`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Task Suggestions */}
        {state.step === "suggestions" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Choose a task to get started
              </p>
            </div>
            
            <Card className="bg-muted border-0">
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-2">
                  {suggestions.map((suggestion, index) => (
                    <motion.button
                      key={suggestion.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 * index }}
                      onClick={() => {
                        setMessages(prev => [...prev, {
                          role: "user",
                          content: suggestion.title,
                        }]);
                        setState(prev => ({ ...prev, step: "chat" }));
                        
                        // Simulate AI response
                        setTimeout(() => {
                          setMessages(prev => [...prev, {
                            role: "assistant",
                            content: `Great choice! Let's set up "${suggestion.title}". I'll help you configure this step by step...`,
                          }]);
                        }, 500);
                      }}
                      className="bg-muted hover:bg-background transition-all duration-200 rounded-xl border border-border p-6 text-left group hover:shadow-md hover:scale-[1.02]"
                    >
                      <div className="space-y-6">
                        {/* Integration Icon */}
                        {suggestion.integration && (
                          <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center border border-border shadow-sm">
                            <Icon 
                              name={suggestion.integration.icon} 
                              className="w-5 h-5 text-foreground"
                            />
                          </div>
                        )}
                        
                        {/* Title */}
                        <div className="font-medium text-sm text-foreground leading-5">
                          {suggestion.title}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {/* Chat Messages */}
        {messages.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-3",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <Card className="bg-muted border-4 border-muted">
        <CardContent className="p-0">
          <div className="bg-background rounded-xl border border-border">
            <div className="p-3">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask anything or @ to mention an agent"
                className="min-h-[60px] border-0 p-3 resize-none focus:ring-0"
              />
            </div>
            <div className="flex items-center justify-between p-3 pt-0">
              <div className="flex gap-0">
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Icon name="attach_file" className="w-[18px] h-[18px]" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Icon name="image" className="w-[18px] h-[18px]" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <Icon name="mic" className="w-[18px] h-[18px]" />
                </Button>
                <Button
                  size="icon"
                  className="h-10 w-10 bg-accent hover:bg-accent/90"
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                >
                  <Icon name="send" className="w-[18px] h-[18px]" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
