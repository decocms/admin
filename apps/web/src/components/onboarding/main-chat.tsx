import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCurrentTeam, WELL_KNOWN_AGENT_IDS, useProfile, useMarketplaceIntegrations, MCPClient, useSDK } from "@deco/sdk";
import { DECO_CHAT_API } from "@deco/sdk/constants";
import { motion, AnimatePresence } from "framer-motion";

import { AgentProvider } from "../agent/provider.tsx";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { useAgent } from "../agent/provider.tsx";
import { ModelSelectorFigma } from "../chat/model-selector-figma.tsx";
import { RichTextArea } from "../chat/rich-text.tsx";
import { PageHeader } from "../common/page-header.tsx";




interface OnboardingState {
  step: "initial" | "chat";
  quickstartStatus: "visible" | "dismissed";
  cardClicked: boolean;
  companyContext?: {
    industry?: string;
    description?: string;
    businessType?: string;
    keyActivities?: string[];
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
    actualIntegration?: any;
  };
}

function MainChatContent() {
  const { teamSlug } = useParams();
  const { data: team } = useCurrentTeam();
  const { data: profile } = useProfile();
  const { workspace } = useSDK();

  const { chat, agent } = useAgent();
  const { data: marketplaceIntegrations } = useMarketplaceIntegrations();
  

  
  const [state, setState] = useState<OnboardingState>({
    step: "initial",
    quickstartStatus: "visible",
    cardClicked: false,
  });

  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("claude-3-5-sonnet-20241022");
  
  // Extract domain from team data
  const domain = useMemo(() => {
    return "farmrio.com.br"; // For demo purposes
  }, []);

  // Get user's first name
  const userName = useMemo(() => {
    const fullName = profile?.metadata?.full_name || "there";
    return fullName.split(" ")[0];
  }, [profile?.metadata?.full_name]);

  // Hardcoded company data for demo
  
  // Generate AI-powered suggestions based on company context and available integrations
  const [aiSuggestions, setAiSuggestions] = useState<TaskSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const generationInProgressRef = useRef(false);

  // Generate AI suggestions when we have marketplace integrations
  useEffect(() => {
    async function generateAISuggestions() {
      if (!marketplaceIntegrations?.integrations || generationInProgressRef.current) {
        console.log("[AI_SUGGESTIONS] Skipping generation - missing integrations or already generating", {
          hasIntegrations: !!marketplaceIntegrations?.integrations,
          isGenerating: generationInProgressRef.current
        });
        return;
      }

      // Use default company context for suggestions
      const defaultContext = {
        industry: "Technology",
        description: "A modern web application with AI-powered tools and integrations",
        businessType: "B2B SaaS",
        keyActivities: ["data analysis", "content creation", "automation", "collaboration"]
      };

      console.log("[AI_SUGGESTIONS] Starting AI generation...", {
        companyContext: defaultContext,
        integrationCount: marketplaceIntegrations.integrations.length,
        teamSlug: team?.slug
      });

      generationInProgressRef.current = true;
      setIsGeneratingSuggestions(true);

      try {
        const client = MCPClient.forWorkspace(team?.slug || "");
        console.log("[AI_SUGGESTIONS] Created MCP client for workspace:", team?.slug);

        // First, search for available tools using SEARCH_TOOLS
        console.log("[AI_SUGGESTIONS] Calling SEARCH_TOOLS...");
        const toolsResponse = await client.SEARCH_TOOLS({
          limit: 20,
          category: "tools"
        });

        console.log("[AI_SUGGESTIONS] SEARCH_TOOLS response:", toolsResponse);
        const availableTools = toolsResponse?.tools || [];
        console.log("[AI_SUGGESTIONS] Available tools count:", availableTools.length);

        // Use AI_GENERATE_OBJECT to create contextual suggestions
        console.log("[AI_SUGGESTIONS] Calling AI_GENERATE_OBJECT...");
        const aiResponse = await client.AI_GENERATE_OBJECT({
          model: "openai:gpt-4.1-nano", // Use GPT-4.1 Nano for fast generation
          messages: [
            {
              role: "user",
              content: `Based on the company context and available tools, generate 6 task suggestions for onboarding.

Company Context:
- Industry: ${defaultContext.industry}
- Description: ${defaultContext.description}
- Business Type: ${defaultContext.businessType}
- Key Activities: ${defaultContext.keyActivities?.join(', ')}

Available Tools: ${availableTools.map((tool: any) => `${tool.name} (${tool.description || 'No description'})`).join(', ')}

Available Integrations: ${marketplaceIntegrations.integrations.map((i: any) => `${i.name} - ${i.description || 'No description'}`).join(', ')}

REQUIREMENTS:
- Exactly 1 task must use Perplexity for research/search (set integrationName to a Perplexity tool name)
- Exactly 1 task must use creative tools (image/video generation like @deco/vidu, @deco/replicate, etc.) (set integrationName to the creative tool name)
- Exactly 2 tasks must use data/business tools (Google Sheets, Notion, Airtable, databases, etc.) (set integrationName to the specific tool name)
- Exactly 2 tasks should be pure LLM analysis that require NO external tools (set integrationName to "none" and icon to "brain" for these)

Generate 6 diverse task suggestions that would be useful for this company. Each suggestion should:
1. Be specific and actionable
2. Use one of the available tools/integrations
3. Be relevant to the company's industry and activities
4. Have a clear business value

Focus on practical tasks like data analysis, content creation, automation, research, communication, and workflow optimization.`
            }
          ],
          schema: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    label: { type: "string" },
                    integrationName: { type: "string" },
                    icon: { type: "string" }
                  },
                  required: ["id", "title", "description", "label", "integrationName", "icon"]
                }
              }
            },
            required: ["suggestions"]
          }
        });

        console.log("[AI_SUGGESTIONS] AI_GENERATE_OBJECT response:", aiResponse);

        if (aiResponse?.object?.suggestions) {
          console.log("[AI_SUGGESTIONS] Processing AI suggestions:", aiResponse.object.suggestions);
          const generatedSuggestions: TaskSuggestion[] = aiResponse.object.suggestions.map((suggestion: any) => {
            // Handle pure LLM tasks (no tools needed)
            if (suggestion.integrationName === "none" || suggestion.integrationName === "None") {
              return {
                id: suggestion.id,
                title: suggestion.title,
                description: suggestion.description,
                label: suggestion.label,
                integration: {
                  name: "Pure Analysis",
                  icon: suggestion.icon || "brain",
                  actualIntegration: null,
                },
              };
            }

            // Try to find the actual integration to get its real icon
            const matchingIntegration = marketplaceIntegrations.integrations.find((i: any) => 
              i.name.toLowerCase().includes(suggestion.integrationName?.toLowerCase()) ||
              suggestion.integrationName?.toLowerCase().includes(i.name.toLowerCase())
            );
            
            // Also try to find matching tool for icon
            const matchingTool = availableTools.find((tool: any) => 
              tool.name.toLowerCase().includes(suggestion.integrationName?.toLowerCase()) ||
              suggestion.integrationName?.toLowerCase().includes(tool.name.toLowerCase())
            );

            return {
              id: suggestion.id,
              title: suggestion.title,
              description: suggestion.description,
              label: suggestion.label,
              integration: {
                name: suggestion.integrationName,
                icon: matchingIntegration?.icon || suggestion.icon,
                actualIntegration: matchingIntegration,
              },
            };
          });

          console.log("[AI_SUGGESTIONS] Generated suggestions:", generatedSuggestions);
          setAiSuggestions(generatedSuggestions);
        } else {
          console.log("[AI_SUGGESTIONS] No suggestions in response, using fallback");
          // Fallback if no suggestions returned
          setAiSuggestions(generateFallbackSuggestions());
        }
      } catch (error) {
        console.error("[AI_SUGGESTIONS] Failed to generate AI suggestions:", error);
        // Fallback to hardcoded suggestions if AI generation fails
        setAiSuggestions(generateFallbackSuggestions());
      } finally {
        console.log("[AI_SUGGESTIONS] Generation complete, setting isGeneratingSuggestions to false");
        generationInProgressRef.current = false;
        setIsGeneratingSuggestions(false);
      }
    }

    generateAISuggestions();
  }, [marketplaceIntegrations, team?.slug]);

  // Fallback suggestions if AI generation fails
  const generateFallbackSuggestions = (): TaskSuggestion[] => {
    console.log("[AI_SUGGESTIONS] Using fallback suggestions");
    if (!state.companyContext || !marketplaceIntegrations?.integrations) {
      console.log("[AI_SUGGESTIONS] No context or integrations for fallback");
      return [];
    }

    const { industry, keyActivities } = state.companyContext;
    const availableIntegrations = marketplaceIntegrations.integrations;
    const suggestions: TaskSuggestion[] = [];

    // Always include Perplexity for research
    const perplexity = availableIntegrations.find((i: any) => i.name.toLowerCase().includes('perplexity'));
    if (perplexity) {
      suggestions.push({
        id: "research-perplexity",
        label: "Research & Analysis",
        title: `Research ${industry?.toLowerCase() || 'industry'} trends with Perplexity`,
        description: "Get insights into market trends and competitive analysis",
        integration: {
          name: (perplexity as any).friendlyName || perplexity.name,
          icon: "search",
        },
      });
    }

    // Add image generation for content creation
    const imageGen = availableIntegrations.find((i: any) => 
      i.name.toLowerCase().includes('dalle') || 
      i.name.toLowerCase().includes('image') ||
      i.description?.toLowerCase().includes('image')
    );
    if (imageGen) {
      suggestions.push({
        id: "create-image",
        label: "Content Creation",
        title: "Generate marketing visuals with AI",
        description: "Create professional images for marketing and social media",
        integration: {
          name: (imageGen as any).friendlyName || imageGen.name,
          icon: "image",
        },
      });
    }

    // Industry-specific suggestions
    if (industry === "Financial Technology") {
      const sheets = availableIntegrations.find((i: any) => i.name.toLowerCase().includes('sheets'));
      if (sheets) {
        suggestions.push({
          id: "financial-analysis",
          label: "Financial Analysis",
          title: "Analyze payment data in Google Sheets",
          description: "Create financial reports and analyze transaction patterns",
          integration: {
            name: (sheets as any).friendlyName || sheets.name,
            icon: "table_chart",
          },
        });
      }
    }

    // Add communication tools
    const slack = availableIntegrations.find((i: any) => i.name.toLowerCase().includes('slack'));
    if (slack) {
      suggestions.push({
        id: "slack-automation",
        label: "Team Communication",
        title: "Build team automation for Slack",
        description: "Set up automated workflows and notifications",
        integration: {
          name: (slack as any).friendlyName || slack.name,
          icon: "chat",
        },
      });
    }

    // Add general productivity suggestions
    const notion = availableIntegrations.find((i: any) => i.name.toLowerCase().includes('notion'));
    if (notion) {
      suggestions.push({
        id: "project-docs",
        label: "Documentation",
        title: "Organize project documentation in Notion",
        description: "Create structured documentation and knowledge base",
        integration: {
          name: (notion as any).friendlyName || notion.name,
          icon: "article",
        },
      });
    }

    // Fill remaining slots with general suggestions
    if (suggestions.length < 6) {
      suggestions.push({
        id: "data-analysis",
        label: "Data Analysis",
        title: "Analyze business data and create reports",
        description: "Transform raw data into actionable insights",
        integration: {
          name: "Data Tools",
          icon: "analytics",
        },
      });
    }

    return suggestions.slice(0, 6);
  };

  const suggestions = aiSuggestions;
  
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

  // Check if we should show chat messages - only when user explicitly types in input
  const showChatMessages = state.step === "chat";
  
  const handleRichTextChange = (markdown: string) => {
    setInputValue(markdown);
  };

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

  const handleSuggestionClick = async (suggestion: TaskSuggestion) => {
    try {
      console.log("[SUGGESTION_CLICK] Installing integration and updating agent for:", suggestion.title);
      
      // Hide the welcome section and cards
      setState(prev => ({ ...prev, cardClicked: true }));
      
      const client = MCPClient.forWorkspace(team?.slug || "");
      
      // First, auto-install the integration if we have one (skip for pure LLM tasks)
      if (suggestion.integration?.actualIntegration && suggestion.integration.name !== "Pure Analysis") {
        console.log("[SUGGESTION_CLICK] Auto-installing integration:", suggestion.integration.actualIntegration.name);
        
        // Install the integration
        const installResult = await client.DECO_INTEGRATION_INSTALL({
          id: suggestion.integration.actualIntegration.id,
          provider: "marketplace"
        });
        
        console.log("[SUGGESTION_CLICK] Integration installed:", installResult);
        
        // Add the integration to the current agent (the one powering this chat)
        console.log("[SUGGESTION_CLICK] Adding integration to current agent tools_set");
        
        // The agent powering this chat should get the new tool
        // We need to update the agent that's currently being used in this chat session
        const { agentId } = useAgent();
        console.log("[SUGGESTION_CLICK] Current agent ID:", agentId);
        
        // Get current agent
        const currentAgent = await client.AGENTS_GET({ id: agentId });
        console.log("[SUGGESTION_CLICK] Current agent tools_set:", currentAgent.tools_set);
        
        // Add the new integration to tools_set (empty array means all tools)
        const updatedToolsSet = {
          ...currentAgent.tools_set,
          [installResult.installationId]: [] // Enable all tools for this integration
        };
        
        // Update the current agent with new tools and increased max_steps
        await client.AGENTS_UPDATE({
          id: agentId,
          agent: {
            tools_set: updatedToolsSet,
            max_steps: 10 // Increase from default 3 to 10 steps
          }
        });
        
        console.log("[SUGGESTION_CLICK] Current agent updated with new integration");
      }
      
      // Create a simple, focused prompt for the specific task
      const prompt = suggestion.integration?.name === "Pure Analysis" 
        ? `${suggestion.title}

${suggestion.description ? `Context: ${suggestion.description}` : ''}

Please provide a comprehensive analysis using your knowledge. This task does not require external tools or integrations.`
        : `${suggestion.title}

${suggestion.description ? `Context: ${suggestion.description}` : ''}

Please help me accomplish this task.`;
      
      // Send the prompt - the agent now has the tools and instructions to handle it properly
      chat.append({
        role: "user",
        content: prompt,
      });
      
      console.log("[SUGGESTION_CLICK] Task prompt sent to enhanced teamAgent");
      
    } catch (error) {
      console.error("[SUGGESTION_CLICK] Error:", error);
      
      // Fallback: send prompt asking agent to handle installation
      const fallbackPrompt = `${suggestion.title}

${suggestion.description ? `Context: ${suggestion.description}` : ''}

Please help me with this task. If you need any integrations, please install them first, then proceed with the implementation.`;
      
      chat.append({
        role: "user",
        content: fallbackPrompt,
      });
    }
  };

  if (showChatMessages) {
    return (
      <div className="flex flex-col h-full max-w-[800px] mx-auto px-4">
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
      {/* Header with Discord and Documentation buttons */}
      <PageHeader 
        title=""
        actionButtons={
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              className="rounded-xl px-3 py-2 bg-muted hover:bg-muted/80 text-muted-foreground"
              onClick={() => window.open('https://discord.gg/your-server', '_blank')}
            >
              Get help on discord
              <Icon name="arrow_outward" size={18} className="ml-1.5 opacity-50" />
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              className="rounded-xl px-3 py-2 bg-muted hover:bg-muted/80 text-muted-foreground"
              onClick={() => window.open('https://docs.deco.cx', '_blank')}
            >
              Documentation
              <Icon name="arrow_outward" size={18} className="ml-1.5 opacity-50" />
            </Button>
          </div>
        }
      />
      
      {/* Main content area */}
      <div className={`flex-1 px-4 pt-6 pb-0 ${state.cardClicked ? 'flex flex-col items-center' : 'flex items-center justify-center'}`}>
        <div className={`w-full max-w-[800px] flex flex-col gap-8 ${state.cardClicked ? 'h-full' : ''}`}>
          {/* Welcome Header - Hide after card is clicked */}
          <AnimatePresence>
            {!state.cardClicked && (
              <motion.div 
                className="text-center flex flex-col items-center gap-4"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-normal text-foreground">
                  Welcome, {userName}
                </h1>
                <p className="text-2xl font-normal text-muted-foreground">
                  Where should we begin?
                </p>
              </div>
              

              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Chat Messages - Show when there are messages from card clicks */}
          {chat.messages.length > 0 && (
            <div className={state.cardClicked ? "flex-1 overflow-y-auto" : "max-h-[300px] overflow-y-auto"}>
              <ChatMessages />
            </div>
          )}
          
          {/* Content Grid - Hide after card is clicked */}
          <AnimatePresence>
            {!state.cardClicked && (
              <motion.div 
                className="grid grid-cols-[300px_1fr_1fr] grid-rows-[1fr_200px] gap-2 h-[416px]"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
              >
            {/* Quickstart Card - Spans left column when visible */}
            {state.quickstartStatus === "visible" && (
              <motion.div
                className="col-span-1 row-span-2 bg-stone-700 rounded-3xl overflow-hidden flex flex-col"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                {/* Close button */}
                <button
                  onClick={() => setState(prev => ({ ...prev, quickstartStatus: "dismissed" }))}
                  className="absolute top-5 right-5 w-4 h-4 text-stone-400 hover:text-stone-200 z-10"
                >
                  <Icon name="close" size={16} />
                </button>
                
                {/* Content */}
                <div className="flex flex-col gap-10 p-6 pt-6 flex-1">
                  <div className="flex flex-col gap-2">
                    <p className="text-stone-400 text-xs">Quickstart</p>
                    <h3 className="text-stone-50 text-lg font-medium">Create App</h3>
                    <p className="text-stone-400 text-sm leading-relaxed">
                      To create a new app you will need to use the CLI
                    </p>
                  </div>
                  
                  {/* Terminal mockup */}
                  <div className="bg-stone-800 rounded-t-2xl flex-1 flex flex-col">
                    {/* Terminal header */}
                    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-stone-700">
                      <div className="flex gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                      </div>
                    </div>
                    
                    {/* Terminal content */}
                    <div className="flex-1 relative overflow-hidden">
                      {/* Background lines for context */}
                      <div className="absolute inset-0 p-4 opacity-20">
                        {[...Array(12)].map((_, i) => (
                          <div key={i} className="h-2.5 bg-stone-700 rounded mb-1" style={{ width: `${Math.random() * 60 + 40}%` }} />
                        ))}
                      </div>
                      
                      {/* Actual command */}
                      <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col gap-1">
                        <div className="font-mono text-stone-50 text-sm">
                          <span>deno -A jsr:@</span>
                          <span className="text-[#d0ec1a]">deco</span>
                          <span>/cli create</span>
                        </div>
                        <p className="text-stone-400 text-xs font-mono">press to copy</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Learn more button */}
                <div className="p-4 bg-stone-700">
                  <Button 
                    variant="secondary" 
                    className="w-full bg-stone-50 text-stone-800 hover:bg-stone-100 rounded-xl h-9"
                    onClick={() => window.open('https://docs.deco.cx', '_blank')}
                  >
                    Learn more
                  </Button>
                </div>
              </motion.div>
            )}
            
            {/* Suggestions Grid - Always show task cards */}
            {Array.from({ length: 6 }).map((_, index) => {
              // Calculate grid position based on quickstart visibility
              let gridClass = "";
              const isQuickstartVisible = state.quickstartStatus === "visible";
              
              if (isQuickstartVisible) {
                // Quickstart is visible - 2x2 grid on the right
                const positions = [
                  "col-start-2 row-start-1",
                  "col-start-3 row-start-1", 
                  "col-start-2 row-start-2",
                  "col-start-3 row-start-2",
                ];
                gridClass = positions[index] || "";
                // Only show 4 cards when quickstart is visible
                if (index >= 4) return null;
              } else {
                // Quickstart is dismissed - 3x2 grid
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

              const suggestion = suggestions[index];
              
              // Show skeleton while generating AI suggestions or if no suggestion yet
              if (!suggestion || isGeneratingSuggestions) {
                return (
                  <div key={`skeleton-${index}`} className={`${gridClass} bg-muted rounded-3xl p-6`}>
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
                  className={`${gridClass} bg-muted hover:bg-muted/80 transition-all duration-200 rounded-3xl p-6 text-left group hover:shadow-md flex flex-col justify-between`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {/* Integration Icon */}
                  {suggestion.integration && (
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      {suggestion.integration.actualIntegration?.icon ? (
                        <img 
                          src={suggestion.integration.actualIntegration.icon}
                          alt={suggestion.integration.name}
                          className="w-8 h-8 object-contain"
                        />
                      ) : (
                        <Icon 
                          name={suggestion.integration.icon} 
                          className="w-5 h-5 text-foreground"
                        />
                      )}
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="space-y-2">
                    <p className="text-lg font-medium leading-tight text-foreground">
                      {suggestion.title}
                    </p>
                  </div>
                </motion.button>
              );
            })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Chat Input - Fixed at bottom */}
      <div className="shrink-0 px-4 pb-4">
        <div className="w-full max-w-[600px] mx-auto">
          <Card className="bg-background border border-border shadow-lg rounded-2xl p-3">
            <div className="flex flex-col gap-3">
              {/* Input Area - Rich text editor with @ mentions */}
              <div className="min-h-[60px]">
                <RichTextArea
                  value={inputValue}
                  onChange={handleRichTextChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask anything or @ to mention an agent"
                  className="border-0 focus-visible:ring-0 text-base placeholder:text-muted-foreground/60 bg-transparent min-h-[40px]"
                  enableToolMentions={true}
                  allowNewLine={false}
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
                    <Icon name="at-sign" className="w-[18px] h-[18px]" />
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
                  <Button variant="outline" size="icon" className="h-10 w-10 border-border">
                    <Icon name="mic" className="w-[18px] h-[18px]" />
                  </Button>
                  <Button 
                    size="icon" 
                    className="h-10 w-10 bg-foreground hover:bg-foreground/90"
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
        showModelSelector: true,
        showAgentVisibility: false,
        showEditAgent: false,
      }}
    >
      <MainChatContent />
    </AgentProvider>
  );
}