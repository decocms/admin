import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Link, useParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { marketplaceData, type MarketplaceItem } from "../../data/marketplace.ts";

// Category-specific content components
function ToolContent({ item }: { item: MarketplaceItem }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Input Parameters</h3>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm">url</span>
              <Badge variant="outline">string</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Website URL to analyze</p>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm">options</span>
              <Badge variant="outline">object</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Optional configuration parameters</p>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Response Format</h3>
        <div className="bg-muted/50 rounded-lg p-4">
          <pre className="text-sm font-mono text-muted-foreground">
{`{
  "primary": "#ff6b35",
  "secondary": "#004e89", 
  "accent": "#ffa500",
  "background": "#ffffff",
  "foreground": "#333333"
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

function WorkflowContent({ item }: { item: MarketplaceItem }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Workflow Steps</h3>
        <div className="space-y-3">
          {[
            { step: 1, name: "Lead Capture", description: "Collect lead information from form submission" },
            { step: 2, name: "Data Enrichment", description: "Enhance lead data with external APIs" },
            { step: 3, name: "Scoring", description: "Apply scoring algorithm based on criteria" },
            { step: 4, name: "Assignment", description: "Route to appropriate sales representative" },
            { step: 5, name: "Notification", description: "Send alerts and create CRM records" }
          ].map((step) => (
            <div key={step.step} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {step.step}
              </div>
              <div>
                <h4 className="font-medium">{step.name}</h4>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Trigger Conditions</h3>
        <div className="bg-muted/50 rounded-lg p-4">
          <ul className="space-y-2 text-sm">
            <li>• New form submission received</li>
            <li>• Manual trigger via API call</li>
            <li>• Scheduled batch processing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ViewContent({ item }: { item: MarketplaceItem }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Components Included</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: "Sales Chart", description: "Interactive revenue visualization" },
            { name: "Pipeline View", description: "Deal progression tracking" },
            { name: "Team Metrics", description: "Individual performance stats" },
            { name: "Goal Tracking", description: "Progress towards targets" }
          ].map((component) => (
            <div key={component.name} className="p-3 bg-muted/30 rounded-lg">
              <h4 className="font-medium">{component.name}</h4>
              <p className="text-sm text-muted-foreground">{component.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Customization Options</h3>
        <div className="bg-muted/50 rounded-lg p-4">
          <ul className="space-y-2 text-sm">
            <li>• Custom color themes and branding</li>
            <li>• Configurable chart types and metrics</li>
            <li>• Responsive design for all screen sizes</li>
            <li>• Dark/light mode support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function AgentContent({ item }: { item: MarketplaceItem }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">Agent Capabilities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: "Natural Conversation", description: "Maintains context across interactions" },
            { name: "Knowledge Base", description: "Access to domain-specific information" },
            { name: "Task Automation", description: "Can perform actions on your behalf" },
            { name: "Escalation Logic", description: "Knows when to involve humans" }
          ].map((capability) => (
            <div key={capability.name} className="p-3 bg-muted/30 rounded-lg">
              <h4 className="font-medium">{capability.name}</h4>
              <p className="text-sm text-muted-foreground">{capability.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">System Instructions</h3>
        <div className="bg-muted/50 rounded-lg p-4">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
{`You are a helpful customer support agent for our company. 

Your role is to:
- Answer customer questions clearly and professionally
- Help troubleshoot common issues
- Collect necessary information for complex problems
- Escalate to human agents when needed

Always maintain a friendly, helpful tone and ask clarifying questions when needed.`}
          </pre>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Available Tools</h3>
        <div className="space-y-2">
          {[
            "Search knowledge base",
            "Create support tickets",
            "Access customer information",
            "Schedule follow-up reminders"
          ].map((tool, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <Icon name="check_circle" size={16} className="text-green-600" />
              <span>{tool}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppContent({ item }: { item: MarketplaceItem }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-3">What's Included</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {item.subItems?.map((subItem) => (
            <Card key={subItem.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Icon name={subItem.iconName || 'extension'} size={20} className="text-primary mt-1" />
                  <div>
                    <h4 className="font-medium">{subItem.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {subItem.shortDescription}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Setup Requirements</h3>
        <div className="bg-muted/50 rounded-lg p-4">
          <ul className="space-y-2 text-sm">
            <li>• Node.js 18+ and npm/yarn</li>
            <li>• React 18+ with TypeScript support</li>
            <li>• Tailwind CSS configuration</li>
            <li>• Database connection (PostgreSQL recommended)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const workspaceLink = useWorkspaceLink();
  
  const item = marketplaceData.find(i => i.id === itemId);
  
  if (!item) {
    return (
      <div className="container mx-auto px-6 py-8 text-center">
        <Icon name="error" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Item Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The item you're looking for doesn't exist or has been removed.
        </p>
        <Link to={workspaceLink("/discover")}>
          <Button>
            <Icon name="arrow_back" size={16} className="mr-2" />
            Back to Discover
          </Button>
        </Link>
      </div>
    );
  }

  const handleInstall = () => {
    trackEvent("marketplace_install_detail_click", {
      itemId: item.id,
      itemName: item.name,
      itemCategory: item.category,
      itemType: item.type,
      itemPrice: item.price
    });
    
    // TODO: Implement actual installation logic
    console.log("Installing item:", item.name);
    
    // For now, just show a success message
    alert(`Installing ${item.name}... This will be implemented in the next step!`);
  };

  const handleTryInChat = () => {
    trackEvent("marketplace_try_in_chat_click", {
      itemId: item.id,
      itemName: item.name,
      itemCategory: item.category
    });
    
    // TODO: Navigate to chat with pre-populated message
    console.log("Trying in chat:", item.name);
    alert(`Opening chat with ${item.name}... This will be implemented in the next step!`);
  };

  const formatPrice = (item: MarketplaceItem) => {
    if (item.priceUnit === 'free') return 'Free';
    if (item.priceUnit === 'per-1m-tokens') return `$${item.price}/1M tokens`;
    if (item.priceUnit === 'monthly') return `$${item.price}/month`;
    if (item.priceUnit === 'one-time') return `$${item.price}`;
    return `$${item.price}`;
  };

  const renderCategoryContent = () => {
    switch (item.category) {
      case 'tools':
        return <ToolContent item={item} />;
      case 'agents':
        return <AgentContent item={item} />;
      case 'workflows':
        return <WorkflowContent item={item} />;
      case 'views':
        return <ViewContent item={item} />;
      case 'apps':
        return <AppContent item={item} />;
      default:
        return <ToolContent item={item} />;
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link to={workspaceLink("/discover")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Icon name="arrow_back" size={16} />
          Back to Discover
        </Link>
      </div>

      {/* Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 rounded-xl bg-muted/50 flex items-center justify-center">
              <Icon name={item.iconName} size={32} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold">{item.name}</h1>
                <div className="flex gap-2">
                  {item.featured && (
                    <Badge variant="outline" className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
                      <Icon name="star" size={12} className="mr-1" />
                      Featured
                    </Badge>
                  )}
                  {item.trending && (
                    <Badge variant="outline" className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                      <Icon name="trending_up" size={12} className="mr-1" />
                      Trending
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-lg text-muted-foreground mb-4">{item.description}</p>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Icon name="download" size={16} />
                  <span>{item.downloads.toLocaleString()} downloads</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="update" size={16} />
                  <span>Updated {item.lastUpdated}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Icon name="code" size={16} />
                  <span>v{item.version}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="text-2xl font-bold mb-1">
                  <span className={item.priceUnit === 'free' ? 'text-green-600' : 'text-foreground'}>
                    {formatPrice(item)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground capitalize">
                  {item.category} • {item.priceUnit === 'free' ? 'No cost' : 'Paid'}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleInstall}
                  disabled={item.isInstalled}
                >
                  {item.isInstalled ? (
                    <>
                      <Icon name="check" size={16} className="mr-2" />
                      Installed
                    </>
                  ) : (
                    <>
                      <Icon name="download" size={16} className="mr-2" />
                      Install {item.name}
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleTryInChat}
                >
                  <Icon name="chat" size={16} className="mr-2" />
                  Try in Chat
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {item.category}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span>{item.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span>~2.3 MB</span>
                </div>
                {item.author && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Developer</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.authorAvatar}</span>
                      <span>{item.author}</span>
                    </div>
                  </div>
                )}
              </div>

              {item.integrations && item.integrations.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <h4 className="font-medium mb-2">Integrations</h4>
                    <div className="flex flex-wrap gap-1">
                      {item.integrations.map((integration) => (
                        <Badge key={integration} variant="outline" className="text-xs">
                          {integration}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-6">
          <div className="max-w-none">
            <h2 className="text-xl font-semibold mb-4">About {item.name}</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              {item.longDescription}
            </p>

            {renderCategoryContent()}
          </div>
        </TabsContent>
        
        <TabsContent value="pricing" className="mt-6">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold mb-4">Pricing Details</h2>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.shortDescription}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      <span className={item.priceUnit === 'free' ? 'text-green-600' : 'text-foreground'}>
                        {formatPrice(item)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.priceUnit === 'per-1m-tokens' && 'Pay per usage'}
                      {item.priceUnit === 'monthly' && 'Recurring subscription'}
                      {item.priceUnit === 'one-time' && 'One-time purchase'}
                      {item.priceUnit === 'free' && 'No cost to use'}
                    </p>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-3">
                  <h4 className="font-medium">What's included:</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Full access to {item.name}</li>
                    <li>• Integration with {item.integrations?.join(', ') || 'external services'}</li>
                    <li>• Documentation and support</li>
                    {item.priceUnit === 'free' && <li>• No usage limits</li>}
                    {item.priceUnit === 'per-1m-tokens' && <li>• Pay only for what you use</li>}
                    {item.priceUnit === 'monthly' && <li>• Cancel anytime</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        

        
        <TabsContent value="changelog" className="mt-6">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold mb-4">Version History</h2>
            <div className="space-y-6">
              <div className="border-l-2 border-primary pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="default">{item.version}</Badge>
                  <span className="text-sm text-muted-foreground">Latest • {item.lastUpdated}</span>
                </div>
                <h3 className="font-medium mb-2">Bug fixes and improvements</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Fixed issue with data synchronization</li>
                  <li>• Improved performance for large datasets</li>
                  <li>• Enhanced error handling and user feedback</li>
                  <li>• Updated dependencies for security</li>
                </ul>
              </div>
              
              <div className="border-l-2 border-muted pl-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">v1.1.0</Badge>
                  <span className="text-sm text-muted-foreground">2 weeks ago</span>
                </div>
                <h3 className="font-medium mb-2">New features and enhancements</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Added batch processing capabilities</li>
                  <li>• New integration with popular third-party services</li>
                  <li>• Improved user interface with better accessibility</li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="support" className="mt-6">
          <div className="max-w-3xl">
            <h2 className="text-xl font-semibold mb-4">Support & Documentation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="help" size={24} className="text-primary mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Documentation</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Complete guides and API reference
                      </p>
                      <Button size="sm" variant="outline">
                        View Docs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="support" size={24} className="text-primary mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Get Help</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Contact our support team
                      </p>
                      <Button size="sm" variant="outline">
                        Contact Support
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="bug_report" size={24} className="text-primary mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Report Issues</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Found a bug? Let us know
                      </p>
                      <Button size="sm" variant="outline">
                        Report Bug
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon name="forum" size={24} className="text-primary mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Community</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Join the discussion
                      </p>
                      <Button size="sm" variant="outline">
                        Join Forum
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
