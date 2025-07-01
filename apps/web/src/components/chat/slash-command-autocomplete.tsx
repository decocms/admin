import { useState, useEffect, useRef, useMemo } from "react";
import { useIntegrations, useMarketplaceIntegrations, type Integration, useInstallFromMarketplace } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { IntegrationIcon } from "../integrations/common.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useTools, type MCPTool } from "@deco/sdk/hooks";

interface SlashCommandAutocompleteProps {
  isVisible: boolean;
  position: { top: number; left: number };
  query: string;
  onSelect: (item: ToolItem) => void;
  onClose: () => void;
}

interface ToolItem {
  id: string;
  name: string;
  description: string;
  icon?: string;
  type: "my-tool" | "all-tool";
  integration?: Integration;
  provider?: string;
  marketplaceIntegration?: any;
}

interface ConnectionModalProps {
  open: boolean;
  integration: any;
  onClose: () => void;
  onConnect: () => void;
  loading: boolean;
}

function ConnectionModal({ open, integration, onClose, onConnect, loading }: ConnectionModalProps) {
  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        {/* Icons layout */}
        <div className="flex justify-center items-center gap-4 mb-6 relative">
          {/* Integration icon */}
          <IntegrationIcon 
            icon={integration.icon} 
            className="w-14 h-14 !rounded-xl"
          />
          
          {/* deco.chat icon */}
          <div className="w-14 h-14 bg-[#D0EC1A] rounded-xl flex items-center justify-center shadow-sm border border-gray-200">
            <img 
              src="/img/deco.chat.svg" 
              alt="deco.chat" 
              className="w-8 h-8"
            />
          </div>
          
          {/* Connection arrows icon - overlapping both icons */}
          <div className="absolute w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-200">
            <Icon name="sync_alt" size={16} className="text-gray-600" />
          </div>
        </div>
        
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Connect to {integration.name}
          </h2>
          
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Connect your {integration.name} account to deco.chat to automate workflows, manage data, and collaborate seamlessly—all from within your chat platform
          </p>
        </div>
        
        <div className="space-y-3">
          <Button 
            onClick={onConnect} 
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white h-11"
          >
            {loading ? "Connecting..." : "Connect"}
          </Button>
          <p className="text-xs text-gray-500 text-center">
            Connect directly to deco.chat
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SlashCommandAutocomplete({ 
  isVisible, 
  position, 
  query, 
  onSelect, 
  onClose 
}: SlashCommandAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [connectionModal, setConnectionModal] = useState<{
    open: boolean;
    integration: any | null;
  }>({ open: false, integration: null });
  
  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplace } = useMarketplaceIntegrations();
  const { mutate: installIntegration, isPending: isInstalling } = useInstallFromMarketplace();
  
  // Get all integrations data with their tools
  const integrationsWithTools = useMemo(() => {
    if (!installedIntegrations) return [];
    
    return installedIntegrations.map(integration => ({
      integration,
      // We'll get tools data separately for each integration when needed
    }));
  }, [installedIntegrations]);

  // Get all tools from installed integrations
  const installedToolsQueries = useMemo(() => {
    return installedIntegrations?.map(integration => ({
      integration,
      // We'll fetch tools separately for each
    })) || [];
  }, [installedIntegrations]);

  // Get filtered tools for "My Tools" section
  const myTools = useMemo(() => {
    const tools: ToolItem[] = [];
    
    // Add native deco.chat tools (DECO_UTILS)
    const nativeTools = [
      {
        id: "FETCH",
        name: "Search web",
        description: "Search the web for real-time information",
        icon: "https://assets.webdraw.app/uploads/utils.png",
        type: "my-tool" as const,
        integration: {
          id: "DECO_UTILS",
          name: "deco.chat",
          description: "Native deco.chat tools",
          icon: "https://assets.webdraw.app/uploads/utils.png",
          connection: { type: "INNATE", name: "DECO_UTILS" },
        },
      },
      {
        id: "RENDER",
        name: "Create image",
        description: "Generate images and visual content",
        icon: "https://assets.webdraw.app/uploads/utils.png",
        type: "my-tool" as const,
        integration: {
          id: "DECO_UTILS",
          name: "deco.chat",
          description: "Native deco.chat tools",
          icon: "https://assets.webdraw.app/uploads/utils.png",
          connection: { type: "INNATE", name: "DECO_UTILS" },
        },
      },
      {
        id: "SPEAK",
        name: "Text to speech",
        description: "Convert text to speech audio",
        icon: "https://assets.webdraw.app/uploads/utils.png",
        type: "my-tool" as const,
        integration: {
          id: "DECO_UTILS",
          name: "deco.chat",
          description: "Native deco.chat tools",
          icon: "https://assets.webdraw.app/uploads/utils.png",
          connection: { type: "INNATE", name: "DECO_UTILS" },
        },
      },
    ];
    
    // Filter native tools by search query
    const filteredNativeTools = nativeTools.filter(tool => 
      tool.name.toLowerCase().includes(query.toLowerCase()) ||
      tool.description.toLowerCase().includes(query.toLowerCase())
    );
    
    tools.push(...filteredNativeTools);
    
    // Add tools from installed integrations
    installedIntegrations?.forEach(integration => {
      // For now, we'll create some sample tools per integration
      // In a real implementation, we'd fetch actual tools using useTools hook
      const sampleTools = [
        {
          id: `${integration.id}-main`,
          name: `Use ${integration.name}`,
          description: integration.description || `Access ${integration.name} tools and functionality`,
          icon: integration.icon,
          type: "my-tool" as const,
          integration,
        }
      ];
      
      // Add specific tools based on integration type
      if (integration.name.toLowerCase().includes('gmail')) {
        tools.push({
          id: `${integration.id}-send-email`,
          name: "Send email",
          description: "Send an email using Gmail",
          icon: integration.icon,
          type: "my-tool",
          integration,
        });
        tools.push({
          id: `${integration.id}-read-emails`,
          name: "Read emails",
          description: "Read and search emails from Gmail",
          icon: integration.icon,
          type: "my-tool",
          integration,
        });
      } else if (integration.name.toLowerCase().includes('drive')) {
        tools.push({
          id: `${integration.id}-find-files`,
          name: "Find files",
          description: "Search for files in Google Drive",
          icon: integration.icon,
          type: "my-tool",
          integration,
        });
        tools.push({
          id: `${integration.id}-upload-file`,
          name: "Upload file",
          description: "Upload a file to Google Drive",
          icon: integration.icon,
          type: "my-tool",
          integration,
        });
      } else if (integration.name.toLowerCase().includes('slack')) {
        tools.push({
          id: `${integration.id}-send-message`,
          name: "Send message",
          description: "Send a message to Slack channel",
          icon: integration.icon,
          type: "my-tool",
          integration,
        });
        tools.push({
          id: `${integration.id}-list-channels`,
          name: "List channels",
          description: "Get list of Slack channels",
          icon: integration.icon,
          type: "my-tool",
          integration,
        });
      } else if (integration.name.toLowerCase().includes('notion')) {
        tools.push({
          id: `${integration.id}-create-page`,
          name: "Create page",
          description: "Create a new page in Notion",
          icon: integration.icon,
          type: "my-tool",
          integration,
        });
        tools.push({
          id: `${integration.id}-query-database`,
          name: "Query database",
          description: "Query a Notion database",
          icon: integration.icon,
          type: "my-tool",
          integration,
        });
      } else {
        tools.push(...sampleTools);
      }
    });
    
    return tools.filter(tool => 
      tool.name.toLowerCase().includes(query.toLowerCase()) ||
      tool.description.toLowerCase().includes(query.toLowerCase())
    );
  }, [installedIntegrations, query]);

  // Get filtered tools for "All Tools" section (marketplace)
  const allTools = useMemo(() => {
    const tools: ToolItem[] = [];
    
    marketplace?.integrations?.forEach(integration => {
      // Only show if not already installed
      const isInstalled = installedIntegrations?.some(installed => 
        installed.name.toLowerCase() === integration.name.toLowerCase()
      );
      
      if (!isInstalled) {
        // Add specific tools based on integration type
        if (integration.name.toLowerCase().includes('gmail')) {
          tools.push({
            id: `${integration.id}-send-email`,
            name: "Send email",
            description: "Send emails using Gmail",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
          tools.push({
            id: `${integration.id}-read-emails`,
            name: "Read emails",
            description: "Read and search emails from Gmail",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
        } else if (integration.name.toLowerCase().includes('drive')) {
          tools.push({
            id: `${integration.id}-find-files`,
            name: "Find files",
            description: "Search for files in Google Drive",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
          tools.push({
            id: `${integration.id}-upload-file`,
            name: "Upload file",
            description: "Upload files to Google Drive",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
        } else if (integration.name.toLowerCase().includes('slack')) {
          tools.push({
            id: `${integration.id}-send-message`,
            name: "Send message",
            description: "Send messages to Slack channels",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
          tools.push({
            id: `${integration.id}-list-channels`,
            name: "List channels",
            description: "Get list of Slack channels",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
        } else if (integration.name.toLowerCase().includes('notion')) {
          tools.push({
            id: `${integration.id}-create-page`,
            name: "Create page",
            description: "Create new pages in Notion",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
          tools.push({
            id: `${integration.id}-query-database`,
            name: "Query database",
            description: "Query Notion databases",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
        } else if (integration.name.toLowerCase().includes('airtable')) {
          tools.push({
            id: `${integration.id}-create-record`,
            name: "Create record",
            description: "Create new records in Airtable",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
          tools.push({
            id: `${integration.id}-get-records`,
            name: "Get records",
            description: "Retrieve records from Airtable",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
        } else if (integration.name.toLowerCase().includes('calendar')) {
          tools.push({
            id: `${integration.id}-create-event`,
            name: "Create event",
            description: "Create new calendar events",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
          tools.push({
            id: `${integration.id}-list-events`,
            name: "List events",
            description: "Get upcoming calendar events",
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
        } else {
          // Generic tool for other integrations
          tools.push({
            id: integration.id,
            name: `Use ${integration.name}`,
            description: integration.description || `Connect ${integration.name} to access its tools`,
            icon: integration.icon,
            type: "all-tool",
            provider: integration.provider,
            marketplaceIntegration: integration,
          });
        }
      }
    });
    
    return tools.filter(tool => 
      tool.name.toLowerCase().includes(query.toLowerCase()) ||
      tool.description.toLowerCase().includes(query.toLowerCase())
    );
  }, [marketplace, installedIntegrations, query]);

  const allItems = [...myTools, ...allTools];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (allItems[selectedIndex]) {
            handleItemSelect(allItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, selectedIndex, allItems, onClose]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleItemSelect = (item: ToolItem) => {
    if (item.type === "my-tool") {
      // Tool is available, select it
      onSelect(item);
    } else {
      // Tool needs connection, show modal
      setConnectionModal({
        open: true,
        integration: item.marketplaceIntegration,
      });
    }
  };

  const handleConnect = () => {
    const integration = connectionModal.integration;
    if (!integration) return;

    const returnUrl = new URL("/", globalThis.location.origin);
    
    installIntegration({
      appName: integration.id,
      provider: integration.provider,
      returnUrl: returnUrl.href,
    }, {
      onSuccess: ({ integration: installedIntegration }) => {
        setConnectionModal({ open: false, integration: null });
        
        // After successful installation, select the tool
        if (installedIntegration) {
          onSelect({
            id: installedIntegration.id,
            name: installedIntegration.name,
            description: installedIntegration.description || "",
            icon: installedIntegration.icon,
            type: "my-tool",
            integration: installedIntegration,
          });
        }
      },
      onError: (error) => {
        console.error("Failed to install integration:", error);
        // Keep modal open to allow retry
      },
    });
  };

  if (!isVisible || allItems.length === 0) return null;

  return (
    <>
      <div 
        className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[300px] max-w-[400px] max-h-[300px] overflow-y-auto"
        style={{ 
          top: position.top, 
          left: position.left 
        }}
      >
        {/* Search header */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Icon name="search" size={14} />
            <span>/Search...</span>
          </div>
        </div>
        
        {/* My Tools section */}
        {myTools.length > 0 && (
          <div className="p-2">
            <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
              My Tools
            </div>
            {myTools.map((tool, index) => (
              <div
                key={`my-${tool.id}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                  index === selectedIndex 
                    ? "bg-blue-50 border border-blue-200" 
                    : "hover:bg-gray-50"
                )}
                onClick={() => handleItemSelect(tool)}
              >
                <IntegrationIcon icon={tool.icon} className="w-5 h-5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {tool.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {tool.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* All Tools section */}
        {allTools.length > 0 && (
          <div className="p-2 border-t border-gray-100">
            <div className="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
              All Tools
            </div>
            {allTools.map((tool, index) => {
              const actualIndex = myTools.length + index;
              return (
                <div
                  key={`all-${tool.id}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
                    actualIndex === selectedIndex 
                      ? "bg-blue-50 border border-blue-200" 
                      : "hover:bg-gray-50"
                  )}
                  onClick={() => handleItemSelect(tool)}
                >
                  <IntegrationIcon icon={tool.icon} className="w-5 h-5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {tool.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {tool.description}
                    </div>
                  </div>
                  <Icon name="add" size={14} className="text-gray-400" />
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Connection Modal */}
      <ConnectionModal
        open={connectionModal.open}
        integration={connectionModal.integration}
        onClose={() => setConnectionModal({ open: false, integration: null })}
        onConnect={handleConnect}
        loading={isInstalling}
      />
    </>
  );
} 