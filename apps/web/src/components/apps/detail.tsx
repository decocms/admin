import React from "react";
import { useParams } from "react-router";
import { 
  Package, 
  Eye, 
  Bot, 
  Workflow, 
  FileText, 
  Settings, 
  Upload,
  ExternalLink,
  Users,
  Calendar,
  GitBranch,
  Activity,
  Globe,
  Wrench
} from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { PageLayout } from "../layout.tsx";

interface AppItem {
  id: string;
  name: string;
  type: 'view' | 'agent' | 'workflow' | 'prompt' | 'tool';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  lastModified: string;
  status?: 'active' | 'inactive' | 'draft';
}

const APP_DATA: Record<string, {
  name: string;
  description: string;
  status: 'connected' | 'pending' | 'disconnected';
  url?: string;
  repository?: string;
  items: AppItem[];
  recentActivity: Array<{
    id: string;
    action: string;
    time: string;
    user: string;
  }>;
}> = {
  'my-ecommerce-app': {
    name: 'My E-commerce App',
    description: 'A complete e-commerce platform with product catalog, checkout flow, and admin dashboard.',
    status: 'connected',
    url: 'https://sites-myecommerceapp--vdql85.decocdn.com',
    repository: 'Repository',
    items: [
      {
        id: 'product-catalog',
        name: 'Product Catalog',
        type: 'view',
        icon: Eye,
        description: 'Display and manage product listings',
        lastModified: '2 hours ago'
      },
      {
        id: 'checkout-flow',
        name: 'Checkout Flow', 
        type: 'view',
        icon: Eye,
        description: 'Complete purchase process',
        lastModified: '1 day ago'
      },
      {
        id: 'admin-dashboard',
        name: 'Admin Dashboard',
        type: 'view', 
        icon: Eye,
        description: 'Administrative controls and analytics',
        lastModified: '3 days ago'
      },
      {
        id: 'order-processor',
        name: 'Order Processor',
        type: 'agent',
        icon: Bot,
        description: 'Handles order processing and fulfillment',
        lastModified: '1 week ago'
      },
      {
        id: 'inventory-sync',
        name: 'Inventory Sync',
        type: 'workflow',
        icon: Workflow,
        description: 'Synchronizes inventory across platforms',
        lastModified: '2 weeks ago'
      }
    ],
    recentActivity: [
      {
        id: '1',
        action: 'Update product catalog view',
        time: 'last week by L...',
        user: 'L'
      },
      {
        id: '2', 
        action: 'Deploy checkout flow to staging',
        time: '3 weeks ago b...',
        user: 'B'
      },
      {
        id: '3',
        action: 'Update admin dashboard',
        time: '3 weeks ago b...',
        user: 'B'
      },
      {
        id: '4',
        action: 'Configure inventory sync workflow',
        time: '4 weeks ago b...',
        user: 'B'
      }
    ]
  },
  'blog-platform': {
    name: 'Blog Platform',
    description: 'A content management system for blogs and articles.',
    status: 'pending',
    items: [],
    recentActivity: []
  },
  'deco-cx': {
    name: 'deco.cx',
    description: 'The official deco.cx application with pages, sections, and loaders.',
    status: 'connected',
    url: 'https://sites-decochatweb--vdql85.decocdn.com',
    repository: 'Repository',
    items: [
      // Views
      {
        id: 'pages',
        name: 'Pages',
        type: 'view',
        icon: Eye,
        description: 'Manage your website pages',
        lastModified: '1 day ago',
        status: 'active'
      },
      {
        id: 'sections',
        name: 'Sections',
        type: 'view',
        icon: Eye,
        description: 'Reusable page sections',
        lastModified: '2 days ago',
        status: 'active'
      },
      {
        id: 'loaders',
        name: 'Loaders',
        type: 'view',
        icon: Eye,
        description: 'Data loading utilities',
        lastModified: '3 days ago',
        status: 'active'
      },
      // Agents
      {
        id: 'content-agent',
        name: 'Content Generator',
        type: 'agent',
        icon: Bot,
        description: 'AI agent that generates website content',
        lastModified: '5 days ago',
        status: 'active'
      },
      {
        id: 'seo-agent',
        name: 'SEO Optimizer',
        type: 'agent',
        icon: Bot,
        description: 'Optimizes content for search engines',
        lastModified: '1 week ago',
        status: 'active'
      },
      // Workflows
      {
        id: 'deploy-workflow',
        name: 'Auto Deploy',
        type: 'workflow',
        icon: Workflow,
        description: 'Automatically deploys changes to production',
        lastModified: '3 days ago',
        status: 'active'
      },
      {
        id: 'content-sync',
        name: 'Content Sync',
        type: 'workflow',
        icon: Workflow,
        description: 'Syncs content across environments',
        lastModified: '1 week ago',
        status: 'active'
      },
      // Prompts
      {
        id: 'page-generator',
        name: 'Page Generator',
        type: 'prompt',
        icon: FileText,
        description: 'Template for generating new pages',
        lastModified: '4 days ago',
        status: 'active'
      },
      {
        id: 'meta-optimizer',
        name: 'Meta Tag Optimizer',
        type: 'prompt',
        icon: FileText,
        description: 'Optimizes meta tags for better SEO',
        lastModified: '6 days ago',
        status: 'active'
      },
      // Tools
      {
        id: 'image-optimizer',
        name: 'Image Optimizer',
        type: 'tool',
        icon: Wrench,
        description: 'Optimizes images for web performance',
        lastModified: '2 days ago',
        status: 'active'
      },
      {
        id: 'css-minifier',
        name: 'CSS Minifier',
        type: 'tool',
        icon: Wrench,
        description: 'Minifies CSS for better performance',
        lastModified: '1 week ago',
        status: 'active'
      }
    ],
    recentActivity: [
      {
        id: '1',
        action: 'Publish 3 from staging into origin/main',
        time: 'last week by L...',
        user: 'L'
      },
      {
        id: '2',
        action: 'Publish 2 from valls into origin/main',
        time: '3 weeks ago b...',
        user: 'V'
      },
      {
        id: '3',
        action: 'Publish 1 from staging into origin/main',
        time: '3 weeks ago b...',
        user: 'L'
      },
      {
        id: '4',
        action: 'update hero cli command',
        time: '3 weeks ago b...',
        user: 'H'
      },
      {
        id: '5',
        action: 'Publish 1 from staging into origin/main',
        time: '4 weeks ago b...',
        user: 'L'
      }
    ]
  },
  // Add alias for URL compatibility
  'deco.cx': {
    name: 'deco.cx',
    description: 'The official deco.cx application with pages, sections, and loaders.',
    status: 'connected',
    url: 'https://sites-decochatweb--vdql85.decocdn.com',
    repository: 'Repository',
    items: [
      {
        id: 'pages',
        name: 'Pages',
        type: 'view',
        icon: Eye,
        description: 'Manage your website pages',
        lastModified: '1 day ago'
      },
      {
        id: 'sections',
        name: 'Sections',
        type: 'view',
        icon: Eye,
        description: 'Reusable page sections',
        lastModified: '2 days ago'
      },
      {
        id: 'loaders',
        name: 'Loaders',
        type: 'view',
        icon: Eye,
        description: 'Data loading utilities',
        lastModified: '3 days ago'
      }
    ],
    recentActivity: [
      {
        id: '1',
        action: 'Publish 3 from staging into origin/main',
        time: 'last week by L...',
        user: 'L'
      },
      {
        id: '2',
        action: 'Publish 2 from valls into origin/main',
        time: '3 weeks ago b...',
        user: 'V'
      },
      {
        id: '3',
        action: 'Publish 1 from staging into origin/main',
        time: '3 weeks ago b...',
        user: 'L'
      },
      {
        id: '4',
        action: 'update hero cli command',
        time: '3 weeks ago b...',
        user: 'H'
      },
      {
        id: '5',
        action: 'Publish 1 from staging into origin/main',
        time: '4 weeks ago b...',
        user: 'L'
      }
    ]
  }
};

function AppDetailContent() {
  const { appId } = useParams<{ appId: string }>();
  const app = appId ? APP_DATA[appId] : null;

  if (!app) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-muted-foreground mt-2">The requested app could not be found.</p>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>;
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Connecting...</Badge>;
      default:
        return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'view': return Eye;
      case 'agent': return Bot;
      case 'workflow': return Workflow;
      case 'prompt': return FileText;
      case 'tool': return Wrench;
      default: return Package;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'view': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'agent': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'workflow': return 'bg-green-100 text-green-800 border-green-200';
      case 'prompt': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'tool': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Group items by type
  const itemsByType = {
    views: app.items.filter(item => item.type === 'view'),
    agents: app.items.filter(item => item.type === 'agent'),
    workflows: app.items.filter(item => item.type === 'workflow'),
    prompts: app.items.filter(item => item.type === 'prompt'),
    tools: app.items.filter(item => item.type === 'tool'),
  };

  return (
    <div className="space-y-8">
      {app.status === 'connected' ? (
        <>
          {/* App Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* App Preview */}
            <Card className="lg:col-span-3">
              <CardContent className="p-6">
                <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-lg p-6 text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-lg font-semibold mb-2">{app.name.toLowerCase()}</h3>
                    <div className="bg-white/20 rounded p-3 mb-4">
                      <div className="space-y-2">
                        {itemsByType.views.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <div className="w-1 h-1 bg-white rounded-full"></div>
                            <span>{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                    <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{app.name}</h4>
                    {getStatusBadge(app.status)}
                  </div>
                  
                  {app.url && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Globe className="w-4 h-4" />
                      <a href={app.url} className="hover:underline" target="_blank" rel="noopener noreferrer">
                        {app.url}
                      </a>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span>{itemsByType.views.length} Views</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-purple-600" />
                      <span>{itemsByType.agents.length} Agents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-green-600" />
                      <span>{itemsByType.workflows.length} Workflows</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-600" />
                      <span>{itemsByType.prompts.length} Prompts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-yellow-600" />
                      <span>{itemsByType.tools.length} Tools</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button size="sm" className="w-full justify-start">
                  <Eye className="w-4 h-4 mr-2" />
                  Create View
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <Bot className="w-4 h-4 mr-2" />
                  Create Agent
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <Workflow className="w-4 h-4 mr-2" />
                  Create Workflow
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <FileText className="w-4 h-4 mr-2" />
                  Create Prompt
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* App Components by Type */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Views */}
            {itemsByType.views.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-600" />
                    Views ({itemsByType.views.length})
                  </CardTitle>
                  <CardDescription>User interface components and pages</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {itemsByType.views.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Eye className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Agents */}
            {itemsByType.agents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-600" />
                    Agents ({itemsByType.agents.length})
                  </CardTitle>
                  <CardDescription>AI-powered automation agents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {itemsByType.agents.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Bot className="w-4 h-4 text-purple-600" />
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Workflows */}
            {itemsByType.workflows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="w-5 h-5 text-green-600" />
                    Workflows ({itemsByType.workflows.length})
                  </CardTitle>
                  <CardDescription>Automated process flows</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {itemsByType.workflows.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Workflow className="w-4 h-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Prompts */}
            {itemsByType.prompts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    Prompts ({itemsByType.prompts.length})
                  </CardTitle>
                  <CardDescription>AI prompt templates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {itemsByType.prompts.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-orange-600" />
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tools */}
            {itemsByType.tools.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-yellow-600" />
                    Tools ({itemsByType.tools.length})
                  </CardTitle>
                  <CardDescription>Utility functions and integrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {itemsByType.tools.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Wrench className="w-4 h-4 text-yellow-600" />
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {app.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-medium">
                      {activity.user}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button variant="link" size="sm" className="p-0 h-auto text-blue-600">
                  View all releases
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Connect Your App</CardTitle>
            <CardDescription>
              This app is currently disconnected. Connect it to see its contents and publish to the marketplace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm">To connect your app:</p>
              <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                <li>Install the deco CLI: <code className="bg-muted px-1 rounded">npm install -g @deco/cli</code></li>
                <li>Navigate to your project directory</li>
                <li>Run: <code className="bg-muted px-1 rounded">deco connect</code></li>
                <li>Follow the authentication prompts</li>
              </ol>
            </div>

            <div className="flex gap-3 pt-4">
              <Button>
                <ExternalLink className="w-4 h-4 mr-2" />
                View Documentation
              </Button>
              <Button variant="outline">
                Retry Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const app = appId ? APP_DATA[appId] : null;

  const actionButtons = app ? (
    <>
      <Button variant="outline" size="sm">
        <Settings className="w-4 h-4 mr-2" />
        Configure
      </Button>
      <Button size="sm">
        <Upload className="w-4 h-4 mr-2" />
        Publish to Marketplace
      </Button>
    </>
  ) : null;

  return (
    <PageLayout
      useNewHeader={true}
      pageTitle={app?.name || "App Not Found"}
      pageIcon="package"
      actionButtons={actionButtons}
      hideViewsButton={true}
      tabs={{
        main: {
          Component: AppDetailContent,
          title: "Overview",
          initialOpen: true,
        },
      }}
    />
  );
}
