import { useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@deco/ui/components/dialog.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";

// Real tool categories using exact phrases and tools from system with correct connection icons
const PROMPT_CATEGORIES = [
  {
    id: "create-image-using",
    title: "Create image using",
    tool: {
      name: "GPT 4o",
      icon: "https://assets.decocache.com/webdraw/15dc381c-23b4-4f6b-9ceb-9690f77a7cf5/openai.svg", // Real OpenAI icon
      color: "#00A67E",
      provider: "OpenAI"
    },
    prompts: [
      "Create a professional headshot photo for LinkedIn",
      "Generate a modern logo design for a tech startup", 
      "Design a minimalist poster for a conference",
      "Create an illustrated character for a children's book"
    ]
  },
  {
    id: "perform-analysis-using",
    title: "Perform an in-depth analysis using",
    tool: {
      name: "Perplexity",
      icon: "https://assets.webdraw.app/uploads/utils.png", // Using DECO_UTILS icon since it's the FETCH tool
      color: "#1F1F1F",
      provider: "deco.chat"
    },
    prompts: [
      "Analyze current market trends in AI technology",
      "Research competitor strategies in the fintech space",
      "Investigate the impact of remote work on productivity", 
      "Study user behavior patterns for mobile apps"
    ]
  },
  {
    id: "create-dashboard-with",
    title: "and create a interactive dashboard with",
    tool: {
      name: "Claude 3.7 Sonnet",
      icon: "https://assets.decocache.com/webdraw/6ae2b0e1-7b81-48f7-9707-998751698b6f/anthropic.svg", // Real Anthropic icon
      color: "#FF6B35",
      provider: "Anthropic"
    },
    prompts: [
      "Build a sales performance dashboard with real-time metrics",
      "Create a customer analytics spreadsheet with conversion funnels",
      "Design a financial reporting sheet with KPIs",
      "Develop a project management tracker with task status"
    ]
  },
  {
    id: "send-email-action", 
    title: "for @example considering the latest advances on the product",
    tool: {
      name: "get board by action id",
      icon: "https://assets.webdraw.app/uploads/utils.png", // Using deco utils icon with Trello blue color
      color: "#0079BF", // Trello blue color
      provider: "Trello"
    },
    prompts: [
      "Draft a product update email to existing customers",
      "Compose a follow-up email for potential clients",
      "Write a newsletter announcing new features", 
      "Create a thank you email for recent purchasers"
    ]
  }
];

// Tool mention component - exact style from Figma with connection icons
function ToolMention({ tool }: { tool: typeof PROMPT_CATEGORIES[0]['tool'] }) {
  return (
    <div 
      className="inline-flex items-center gap-1 px-1 py-0.5 rounded-md border text-sm"
      style={{ 
        backgroundColor: '#FAFAFA', 
        borderColor: '#E4E4E7',
        fontSize: '14px',
        lineHeight: '1.71428571'
      }}
    >
      <div className="w-4 h-4 rounded overflow-hidden flex items-center justify-center">
        <IntegrationIcon 
          icon={tool.icon} 
          className="w-4 h-4 !rounded-sm border-none"
        />
      </div>
      <span className="text-[#71717A]">{tool.name}</span>
    </div>
  );
}

// Component to render text with tool mention inline
function TextWithToolMention({ title, tool }: { title: string, tool: typeof PROMPT_CATEGORIES[0]['tool'] }) {
  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <span 
        className="text-sm" 
        style={{ 
          color: '#78716C',
          fontSize: '14px',
          lineHeight: '1.42857143'
        }}
      >
        {title}
      </span>
      <ToolMention tool={tool} />
    </div>
  );
}

// Special component for Get database at beginning + Claude at end
function DatabaseDashboardWithClaude() {
  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <ToolMention tool={{
        name: "Get database",
        icon: "https://assets.decocache.com/webdraw/eb7480aa-a68b-4ce4-98ff-36aa121762a7/google.svg",
        color: "#0F9D58",
        provider: "Google Sheets"
      }} />
      <span 
        className="text-sm" 
        style={{ 
          color: '#78716C',
          fontSize: '14px',
          lineHeight: '1.42857143'
        }}
      >
        and create a interactive dashboard with
      </span>
      <ToolMention tool={{
        name: "Claude 3.7 Sonnet",
        icon: "https://assets.decocache.com/webdraw/6ae2b0e1-7b81-48f7-9707-998751698b6f/anthropic.svg",
        color: "#FF6B35",
        provider: "Anthropic"
      }} />
    </div>
  );
}

// Special component for the last category that has tool at the end
function SendEmailWithTool({ tool }: { tool: typeof PROMPT_CATEGORIES[0]['tool'] }) {
  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
      <ToolMention tool={{
        name: "Send email",
        icon: "https://assets.decocache.com/webdraw/eb7480aa-a68b-4ce4-98ff-36aa121762a7/google.svg",
        color: "#EA4335",
        provider: "Gmail"
      }} />
      <span 
        className="text-sm" 
        style={{ 
          color: '#78716C',
          fontSize: '14px',
          lineHeight: '1.42857143'
        }}
      >
        for @example considering the latest advances on the product
      </span>
      <ToolMention tool={tool} />
    </div>
  );
}

interface PromptSuggestionsProps {
  onPromptSelect: (prompt: string) => void;
}

export function PromptSuggestions({ onPromptSelect }: PromptSuggestionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handlePromptClick = (prompt: string) => {
    onPromptSelect(prompt);
    setSelectedCategory(null);
  };

  const selectedCategoryData = PROMPT_CATEGORIES.find(cat => cat.id === selectedCategory);

  return (
    <>
      {/* Level 1: Category suggestions - flexible tool chip positioning */}
      <div className="w-full max-w-[800px] mx-auto mt-8">
        <div className="flex flex-wrap justify-center gap-2">
          {PROMPT_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className="inline-flex items-center gap-2 px-2 py-2 rounded-xl border transition-colors"
              style={{
                backgroundColor: '#FAFAFA',
                borderColor: '#E4E4E7'
              }}
            >
              {category.id === 'send-email-action' ? (
                <SendEmailWithTool tool={category.tool} />
              ) : category.id === 'create-dashboard-with' ? (
                <DatabaseDashboardWithClaude />
              ) : (
                <TextWithToolMention title={category.title} tool={category.tool} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Level 2: Modal with specific prompts */}
      <Dialog open={!!selectedCategory} onOpenChange={() => setSelectedCategory(null)}>
        <DialogContent className="max-w-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedCategoryData && (
                <>
                  <ToolMention tool={selectedCategoryData.tool} />
                  <span className="text-xl font-semibold">
                    {selectedCategoryData.title}
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-3 mt-6">
            {selectedCategoryData?.prompts.map((prompt, index) => (
              <button
                key={index}
                onClick={() => handlePromptClick(prompt)}
                className="text-left p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="text-sm text-gray-900">{prompt}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 