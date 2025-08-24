import React, { useState } from "react";
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
  Wrench,
  BarChart3,
  Clock,
  Zap,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Circle,
  ScrollText,
  Play,
  ArrowRight,
  Copy,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Progress } from "@deco/ui/components/progress.tsx";
import { Avatar, AvatarFallback } from "@deco/ui/components/avatar.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@deco/ui/components/collapsible.tsx";
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

// Component for displaying tool call details
function ToolCallItem({ call }: { call: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-warning animate-pulse" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (duration: number) => {
    return `${duration}ms`;
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors cursor-pointer">
            <div className="w-6 h-6 rounded overflow-hidden relative after:absolute after:inset-0 after:rounded after:shadow-[inset_0_0_0_1px_rgba(120,113,108,0.4)] after:pointer-events-none">
              <img 
                src="https://assets.decocache.com/decochatweb/a8ee62ed-0bf8-40fa-b1d5-ddc82fc7e201/decocxlogo.png"
                alt="deco.cx"
                className="w-full h-full rounded object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium text-foreground">{call.toolName}</h3>
                {getStatusIcon(call.status)}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{formatTimestamp(call.timestamp)}</span>
                <span>{formatDuration(call.duration)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={
                call.status === 'success' ? 'border-success text-success' :
                call.status === 'error' ? 'border-destructive text-destructive' :
                'border-warning text-warning'
              }>
                {call.status}
              </Badge>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Input Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Input</span>
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <pre className="text-xs text-muted-foreground overflow-x-auto">
                  {JSON.stringify(call.input, null, 2)}
                </pre>
              </div>
            </div>

            {/* Output/Error Section */}
            {call.status === 'success' && call.output && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium text-foreground">Output</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2">
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                  <pre className="text-xs text-foreground overflow-x-auto">
                    {typeof call.output === 'string' ? call.output : JSON.stringify(call.output, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {call.status === 'error' && call.error && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-foreground">Error</span>
                </div>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  <p className="text-xs text-destructive">{call.error}</p>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
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
  toolCalls: Array<{
    id: string;
    toolName: string;
    timestamp: string;
    duration: number;
    status: 'success' | 'error' | 'pending';
    input: Record<string, any>;
    output?: any;
    error?: string;
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
        lastModified: '2 hours ago',
        status: 'active'
      },
      {
        id: 'checkout-flow',
        name: 'Checkout Flow', 
        type: 'view',
        icon: Eye,
        description: 'Complete purchase process',
        lastModified: '1 day ago',
        status: 'active'
      },
      {
        id: 'admin-dashboard',
        name: 'Admin Dashboard',
        type: 'view', 
        icon: Eye,
        description: 'Administrative controls and analytics',
        lastModified: '3 days ago',
        status: 'draft'
      },
      {
        id: 'order-processor',
        name: 'Order Processor',
        type: 'agent',
        icon: Bot,
        description: 'Handles order processing and fulfillment',
        lastModified: '1 week ago',
        status: 'active'
      },
      {
        id: 'customer-support',
        name: 'Customer Support Agent',
        type: 'agent',
        icon: Bot,
        description: 'Automated customer service responses',
        lastModified: '3 days ago',
        status: 'inactive'
      },
      {
        id: 'inventory-sync',
        name: 'Inventory Sync',
        type: 'workflow',
        icon: Workflow,
        description: 'Synchronizes inventory across platforms',
        lastModified: '2 weeks ago',
        status: 'active'
      },
      {
        id: 'order-fulfillment',
        name: 'Order Fulfillment',
        type: 'workflow',
        icon: Workflow,
        description: 'Automates order processing pipeline',
        lastModified: '5 days ago',
        status: 'draft'
      },
      {
        id: 'product-description-prompt',
        name: 'Product Description Generator',
        type: 'prompt',
        icon: FileText,
        description: 'Creates compelling product descriptions',
        lastModified: '1 day ago',
        status: 'active'
      },
      {
        id: 'email-template',
        name: 'Order Confirmation Email',
        type: 'prompt',
        icon: FileText,
        description: 'Template for order confirmation emails',
        lastModified: '4 days ago',
        status: 'inactive'
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
    ],
    toolCalls: []
  },
  'blog-platform': {
    name: 'Blog Platform',
    description: 'A content management system for blogs and articles.',
    status: 'pending',
    items: [],
    recentActivity: [],
    toolCalls: []
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
        status: 'inactive'
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
        status: 'draft'
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
      {
        id: 'product-description',
        name: 'Product Description Generator',
        type: 'prompt',
        icon: FileText,
        description: 'Generates compelling product descriptions',
        lastModified: '2 days ago',
        status: 'draft'
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
        status: 'inactive'
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
    ],
    toolCalls: [
      {
        id: '1',
        toolName: 'Daemon Read File',
        timestamp: '2024-01-15T10:30:00Z',
        duration: 245,
        status: 'success',
        input: {
          sitename: 'deco-cx',
          environment: 'main',
          filepath: '/sections/ProductCard.tsx'
        },
        output: {
          content: 'export default function ProductCard({ title, price, image }: Props) {\n  return (\n    <div className="product-card">\n      <img src={image} alt={title} />\n      <h3>{title}</h3>\n      <p>${price}</p>\n    </div>\n  );\n}',
          size: 1024
        }
      },
      {
        id: '2',
        toolName: 'Get Pages',
        timestamp: '2024-01-15T10:25:00Z',
        duration: 156,
        status: 'success',
        input: {
          sitename: 'deco-cx',
          environment: 'main'
        },
        output: {
          pages: [
            { path: '/', name: 'Home' },
            { path: '/products', name: 'Products' },
            { path: '/about', name: 'About' }
          ],
          total: 3
        }
      },
      {
        id: '3',
        toolName: 'Daemon Patch File',
        timestamp: '2024-01-15T10:20:00Z',
        duration: 892,
        status: 'error',
        input: {
          sitename: 'deco-cx',
          environment: 'main',
          filepath: '/sections/Hero.tsx',
          patch: '--- a/sections/Hero.tsx\n+++ b/sections/Hero.tsx\n@@ -10,7 +10,7 @@\n-  <h1>Welcome</h1>\n+  <h1>Welcome to Our Store</h1>'
        },
        error: 'File not found: /sections/Hero.tsx'
      },
      {
        id: '4',
        toolName: 'Get Theme',
        timestamp: '2024-01-15T10:15:00Z',
        duration: 89,
        status: 'success',
        input: {
          sitename: 'deco-cx'
        },
        output: {
          colors: {
            primary: '#0070f3',
            secondary: '#666666'
          },
          fonts: ['Inter', 'system-ui']
        }
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
    ],
    toolCalls: []
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
        return <Badge variant="outline" className="border-success text-success-foreground bg-success/10">Connected</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-warning text-warning-foreground bg-warning/10">Connecting...</Badge>;
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

  // Group items by type
  const itemsByType = {
    views: app.items.filter(item => item.type === 'view'),
    agents: app.items.filter(item => item.type === 'agent'),
    workflows: app.items.filter(item => item.type === 'workflow'),
    prompts: app.items.filter(item => item.type === 'prompt'),
    tools: app.items.filter(item => item.type === 'tool'),
  };

  const getItemStatusIcon = (status?: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'inactive':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      case 'draft':
        return <Circle className="w-4 h-4 text-muted-foreground" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-success" />;
    }
  };

  return (
    <div className="space-y-6">
      {app.status === 'connected' ? (
        <>
          {/* Main Content */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-4xl flex flex-col gap-4">
              {/* App Info Section */}
              <div className="px-4 py-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden relative after:absolute after:inset-0 after:rounded-xl after:shadow-[inset_0_0_0_1px_rgba(120,113,108,0.4)] after:pointer-events-none">
                  <img 
                    src="https://assets.decocache.com/decochatweb/a8ee62ed-0bf8-40fa-b1d5-ddc82fc7e201/decocxlogo.png"
                    alt={app.name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="text-foreground text-lg font-medium">{app.name}</div>
                    <Badge variant="outline" className="px-2 py-1 bg-secondary rounded-full flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-success rounded-full" />
                      <div className="text-secondary-foreground text-xs font-medium">Active</div>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a href="https://localhost-0ead9407.deco.host/" className="text-primary text-xs hover:underline truncate max-w-48">
                      https://localhost-0ead9407.deco.host/
                    </a>
                    <a href="https://my-custom-domain.com/" className="text-primary text-xs hover:underline truncate max-w-48">
                      https://my-custom-domain.com/
                    </a>
                    <Badge variant="secondary" className="px-2 py-1 bg-secondary rounded-full">
                      <div className="text-secondary-foreground text-xs font-medium">+2</div>
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="px-3 py-2 bg-muted rounded-xl">
                    <GitBranch className="w-4 h-4 mr-1.5" />
                    <div className="text-secondary-foreground text-sm">Repository</div>
                  </Button>
                  <Button variant="ghost" size="sm" className="px-3 py-2 bg-secondary rounded-xl">
                    <div className="text-secondary-foreground text-sm">Domains</div>
                  </Button>
                </div>
              </div>

              {/* Tabbed Content */}
              <Tabs defaultValue="tools" className="w-full">
                <TabsList className="grid w-full grid-cols-6 bg-muted/50 p-1 rounded-xl">
                  <TabsTrigger value="tools" className="text-sm">
                    <Wrench className="w-4 h-4 mr-2" />
                    Tools
                  </TabsTrigger>
                  <TabsTrigger value="views" className="text-sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Views
                  </TabsTrigger>
                  <TabsTrigger value="agents" className="text-sm">
                    <Bot className="w-4 h-4 mr-2" />
                    Agents
                  </TabsTrigger>
                  <TabsTrigger value="workflows" className="text-sm">
                    <Workflow className="w-4 h-4 mr-2" />
                    Workflows
                  </TabsTrigger>
                  <TabsTrigger value="prompts" className="text-sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Prompts
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="text-sm">
                    <Activity className="w-4 h-4 mr-2" />
                    Activity
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tools" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="w-5 h-5" />
                        Tools ({itemsByType.tools.length || 13})
                      </CardTitle>
                      <CardDescription>Available tools and functions for this app</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { name: "Daemon Grep File", description: "Grep a file from the filesystem, given a sitename, environment name, and filepath." },
                          { name: "Daemon Patch File", description: "Patches a file into a filesystem, given sitename, environment name, filepath and patch operation." },
                          { name: "Daemon Read File", description: "Reads a file from the filesystem, given a sitename, environment name, and filepath." },
                          { name: "Daemon Replace Content In File", description: "Replace content in a file from the filesystem." },
                          { name: "Get Assets", description: "Retrieve all assets from the application." },
                          { name: "Get Page Fresh State Size", description: "Get the fresh state size of a specific page." },
                          { name: "Get User", description: "Retrieve user information and permissions." },
                          { name: "Get Website Images", description: "Get all images used in the website." },
                          { name: "Get Current Site and Env", description: "Get current site and environment information." },
                          { name: "Get Pages", description: "Retrieve all pages in the application." },
                          { name: "Get Theme", description: "Get the current theme configuration." },
                          { name: "Install App", description: "Install a new application or component." },
                          { name: "List Files", description: "List all files in the project directory." }
                        ].map((tool, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="w-8 h-8 rounded overflow-hidden relative after:absolute after:inset-0 after:rounded after:shadow-[inset_0_0_0_1px_rgba(120,113,108,0.4)] after:pointer-events-none">
                              <img 
                                src="https://assets.decocache.com/decochatweb/a8ee62ed-0bf8-40fa-b1d5-ddc82fc7e201/decocxlogo.png"
                                alt="deco.cx"
                                className="w-full h-full rounded object-cover"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-foreground mb-1">{tool.name}</h3>
                              <p className="text-xs text-muted-foreground">{tool.description}</p>
                            </div>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="views" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Views ({itemsByType.views.length})
                      </CardTitle>
                      <CardDescription>User interface components and pages</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {itemsByType.views.length > 0 ? itemsByType.views.map((view) => (
                          <div key={view.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="w-12 h-8 bg-muted rounded-lg flex items-center justify-center">
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-foreground">{view.name}</h3>
                              <p className="text-xs text-muted-foreground">{view.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">Modified {view.lastModified}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getItemStatusIcon(view.status)}
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No views found</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="agents" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5" />
                        Agents ({itemsByType.agents.length})
                      </CardTitle>
                      <CardDescription>AI-powered automation agents</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {itemsByType.agents.length > 0 ? itemsByType.agents.map((agent) => (
                          <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-foreground">{agent.name}</h3>
                              <p className="text-xs text-muted-foreground">{agent.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">Modified {agent.lastModified}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getItemStatusIcon(agent.status)}
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No agents found</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="workflows" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Workflow className="w-5 h-5" />
                        Workflows ({itemsByType.workflows.length})
                      </CardTitle>
                      <CardDescription>Automated process flows</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {itemsByType.workflows.length > 0 ? itemsByType.workflows.map((workflow) => (
                          <div key={workflow.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                              <Workflow className="w-4 h-4 text-success" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-foreground">{workflow.name}</h3>
                              <p className="text-xs text-muted-foreground">{workflow.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">Modified {workflow.lastModified}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getItemStatusIcon(workflow.status)}
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Workflow className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No workflows found</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="prompts" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Prompts ({itemsByType.prompts.length})
                      </CardTitle>
                      <CardDescription>AI prompt templates and configurations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {itemsByType.prompts.length > 0 ? itemsByType.prompts.map((prompt) => (
                          <div key={prompt.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                              <FileText className="w-4 h-4 text-warning" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-foreground">{prompt.name}</h3>
                              <p className="text-xs text-muted-foreground">{prompt.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">Modified {prompt.lastModified}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getItemStatusIcon(prompt.status)}
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No prompts found</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="activity" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Recent Activity ({app.toolCalls?.length || 0})
                      </CardTitle>
                      <CardDescription>Latest tool calls and their results</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {app.toolCalls && app.toolCalls.length > 0 ? app.toolCalls.map((call) => (
                          <ToolCallItem key={call.id} call={call} />
                        )) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No recent activity</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
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
    <Button size="sm">
      <Globe className="w-4 h-4 mr-2" />
      Publish App
    </Button>
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
