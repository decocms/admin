import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState, useMemo } from "react";
import { Link } from "react-router";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { PageHeader } from "../common/page-header.tsx";
import { Sparkles, Users, Briefcase } from "lucide-react";

// Mock data for the new design
const mockFeaturedItems = [
  {
    id: "sheets-creator",
    name: "Create Google Spreadsheet",
    description: "Extract website text for AI models with rich formatting.",
    iconName: "table",
    iconBg: "bg-[#d0ec1a]",
    type: "Agent",
    typeBg: "bg-[#a595ff]",
    typeColor: "text-[#151042]",
    author: "Leandro Borges",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-01.svg", "badge-02.svg"],
    downloads: 6455,
    price: "$5.00 / 1M token",
    category: "agents"
  },
  {
    id: "sheets-tool",
    name: "Google Sheets Integration",
    description: "Connect and manipulate Google Sheets directly from your agents.",
    iconName: "table",
    iconBg: "bg-background",
    type: "Tool",
    typeBg: "bg-amber-400",
    typeColor: "text-amber-950",
    author: "Leandro Borges",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-01.svg", "badge-02.svg"],
    downloads: 6455,
    price: "Free",
    category: "tools"
  },
  {
    id: "crawler",
    name: "Website Content Crawler",
    description: "Extract website text for AI models with rich formatting.",
    iconName: "globe",
    iconBg: "bg-blue-400",
    type: "Tool",
    typeBg: "bg-amber-400",
    typeColor: "text-amber-950",
    author: "Sarah Chen",
    authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-03.svg"],
    downloads: 6455,
    price: "$2.50 / 1M token",
    category: "tools"
  },
  {
    id: "email-agent",
    name: "Email Assistant Agent",
    description: "Automated email management and response generation.",
    iconName: "mail",
    iconBg: "bg-[#d0ec1a]",
    type: "Agent",
    typeBg: "bg-[#a595ff]",
    typeColor: "text-[#151042]",
    author: "Sarah Chen",
    authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-03.svg"],
    downloads: 3200,
    price: "$3.00 / 1M token",
    category: "agents"
  },
  {
    id: "notion-tool",
    name: "Notion Database Manager",
    description: "Create and manage Notion databases seamlessly.",
    iconName: "notebook",
    iconBg: "bg-background",
    type: "Tool",
    typeBg: "bg-amber-400",
    typeColor: "text-amber-950",
    author: "Mike Johnson",
    authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-04.svg"],
    downloads: 8900,
    price: "Free",
    category: "tools"
  },
  {
    id: "calendar-agent",
    name: "Smart Calendar Agent",
    description: "Intelligent scheduling and calendar management.",
    iconName: "calendar",
    iconBg: "bg-[#d0ec1a]",
    type: "Agent",
    typeBg: "bg-[#a595ff]",
    typeColor: "text-[#151042]",
    author: "Alex Rivera",
    authorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-02.svg", "badge-04.svg", "badge-01.svg"],
    downloads: 5670,
    price: "$4.00 / 1M token",
    category: "agents"
  }
];

const mockBuilders = [
  {
    id: "leandro",
    name: "Leandro Borges",
    role: "Machine Learning Engineer",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-01.svg", "badge-02.svg"],
    agents: 3,
    users: "5.2k",
    bounties: 10,
    integrations: [
      { name: "Google Sheets", icon: "table", bg: "bg-[#d0ec1a]" },
      { name: "Sheets", icon: "sheet", bg: "bg-white" },
      { name: "Web Crawler", icon: "globe", bg: "bg-blue-400" }
    ]
  },
  {
    id: "rafael",
    name: "Rafael Valls",
    role: "Full Stack Developer",
    authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-04.svg"],
    agents: 5,
    users: "8.1k",
    bounties: 15,
    integrations: [
      { name: "Notion", icon: "notebook", bg: "bg-white" },
      { name: "Slack", icon: "message-circle", bg: "bg-[#4A154B]" },
      { name: "GitHub", icon: "github", bg: "bg-black" }
    ]
  },
  {
    id: "guilherme",
    name: "Guilherme Rodrigues",
    role: "AI Engineer",
    authorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-03.svg", "badge-01.svg", "badge-04.svg"],
    agents: 2,
    users: "3.4k",
    bounties: 7,
    integrations: [
      { name: "OpenAI", icon: "brain", bg: "bg-green-500" },
      { name: "Discord", icon: "message-square", bg: "bg-[#5865F2]" },
      { name: "Twitter", icon: "twitter", bg: "bg-[#1DA1F2]" }
    ]
  }
];

const mockAgents = [
  {
    id: "agent1",
    name: "Create Google Spreadsheet",
    description: "Extract website text for AI models with rich formatting.",
    iconName: "table",
    iconBg: "bg-[#d0ec1a]",
    type: "Agent",
    typeBg: "bg-[#a595ff]",
    typeColor: "text-[#151042]",
    author: "Leandro Borges",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-01.svg", "badge-02.svg"],
    downloads: 6455,
    price: "$5.00 / 1M token",
    features: ["book-open", "wrench", "app-window", "workflow"],
    category: "agents"
  },
  {
    id: "agent2",
    name: "Website Content Crawler",
    description: "Extract website text for AI models with rich formatting.",
    iconName: "globe",
    iconBg: "bg-blue-400",
    type: "Tool",
    typeBg: "bg-amber-400",
    typeColor: "text-amber-950",
    author: "Sarah Chen",
    authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["badge-03.svg"],
    downloads: 6455,
    price: "Free",
    category: "tools"
  }
];

const mockFamousAgents = [
  { id: "famous1", name: "Website Content Crawler", description: "Crawl websites and extract text.", iconName: "globe", iconBg: "bg-blue-400", category: "agents" },
  { id: "famous2", name: "Email Assistant", description: "Automated email management.", iconName: "mail", iconBg: "bg-blue-400", category: "agents" },
  { id: "famous3", name: "Calendar Manager", description: "Smart scheduling assistant.", iconName: "calendar", iconBg: "bg-blue-400", category: "agents" },
  { id: "famous4", name: "Data Analyzer", description: "Advanced data processing.", iconName: "chart", iconBg: "bg-blue-400", category: "agents" },
  { id: "famous5", name: "Content Generator", description: "AI-powered content creation.", iconName: "edit", iconBg: "bg-blue-400", category: "agents" },
  { id: "famous6", name: "Task Automator", description: "Workflow automation tool.", iconName: "workflow", iconBg: "bg-blue-400", category: "agents" },
  { id: "famous7", name: "Document Parser", description: "Extract data from documents.", iconName: "file-text", iconBg: "bg-blue-400", category: "agents" },
  { id: "famous8", name: "Social Media Manager", description: "Manage social media posts.", iconName: "share", iconBg: "bg-blue-400", category: "agents" },
  { id: "famous9", name: "Image Processor", description: "AI image analysis and editing.", iconName: "image", iconBg: "bg-blue-400", category: "agents" }
];

function AgentCard({ item }: { item: any }) {
  const workspaceLink = useWorkspaceLink();
  
  return (
    <Link to={workspaceLink(`/discover/item/${item.id}`)} className="h-full">
      <div className="bg-input rounded-2xl p-px h-full flex flex-col">
        {/* Main content card */}
        <div className="bg-muted rounded-2xl p-6 flex flex-col gap-8 flex-1">
          {/* Header with icon and type badge */}
          <div className="flex items-start justify-between">
            <div className={cn("w-20 h-20 rounded-[15px] flex items-center justify-center shadow-sm", item.iconBg)}>
              <Icon name={item.iconName} size={32} />
            </div>
            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-2xl text-sm", item.typeBg, item.typeColor)}>
              <Icon name="wrench" size={14} />
              {item.type}
            </div>
          </div>
          
          {/* Content */}
          <div className="flex flex-col gap-4 flex-1">
            <div className="space-y-2">
              <h3 className="text-foreground text-base font-normal leading-tight">{item.name}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer with author and downloads */}
        <div className="flex items-center justify-between px-4 py-2 mt-auto">
          <div className="flex items-center gap-1.5">
            <img 
              src={item.authorImage} 
              alt={item.author}
              className="w-5 h-5 rounded-full object-cover border border-border"
            />
            <span className="text-sm text-foreground font-normal">{item.author}</span>
            {/* Author badges */}
            {item.authorBadges && item.authorBadges.length > 0 && (
              <div className="flex items-center -ml-1.5">
                {item.authorBadges.map((badge: string, index: number) => (
                  <img
                    key={badge}
                    src={`/${badge}`}
                    alt={`Badge ${index + 1}`}
                    className="w-4 h-4 -mr-2 last:mr-0"
                    style={{ zIndex: item.authorBadges.length - index }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Icon name="download" size={16} className="text-muted-foreground" />
            <span className="text-sm text-foreground font-normal">{item.downloads.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function BuilderCard({ builder }: { builder: any }) {
  const workspaceLink = useWorkspaceLink();
  
  return (
    <Link to={workspaceLink(`/discover/builder/${builder.id}`)} className="h-full">
      <div className="bg-input rounded-2xl p-px h-full flex flex-col">
        {/* Main content card */}
        <div className="bg-muted rounded-2xl flex flex-col overflow-hidden flex-1 relative">
          {/* Header with gradient banner */}
          <div className="h-[74px] bg-gradient-to-r from-[#d0ec1a] to-[#07401a]"></div>
          
          {/* Profile image positioned to overlap banner and content */}
          <img 
            src={builder.authorImage} 
            alt={builder.name}
            className="w-[92px] h-[92px] rounded-full object-cover bg-[#d0ec1a] absolute top-[28px] left-1/2 transform -translate-x-1/2 z-10"
          />
          
          {/* Content */}
          <div className="px-6 pt-12 pb-4 flex flex-col gap-4 items-center flex-1">
            <div className="text-center space-y-1.5">
              <div className="flex items-center justify-center gap-1.5">
                <h3 className="text-foreground text-lg font-medium">{builder.name}</h3>
                {/* Author badges */}
                {builder.authorBadges && builder.authorBadges.length > 0 && (
                  <div className="flex items-center">
                    {builder.authorBadges.map((badge: string, index: number) => (
                      <img
                        key={badge}
                        src={`/${badge}`}
                        alt={`Badge ${index + 1}`}
                        className="w-5 h-5 -mr-2.5 last:mr-0"
                        style={{ zIndex: builder.authorBadges.length - index }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{builder.role}</p>
            </div>
            
            {/* Integration icons */}
            <div className="flex items-center gap-3 mt-auto">
              {builder.integrations?.map((integration: any, i: number) => (
                <div key={i} className={cn("w-[30px] h-[30px] rounded-md shadow-sm flex items-center justify-center", integration.bg)}>
                  <Icon name={integration.icon} size={16} />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Footer with stats */}
        <div className="flex items-center justify-between px-4 py-2 mt-auto">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border">
            <Sparkles size={16} className="text-muted-foreground" />
            <span className="text-sm text-foreground font-normal">{builder.agents} agents</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border">
            <Users size={16} className="text-muted-foreground" />
            <span className="text-sm text-foreground font-normal">{builder.users} users</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border">
            <Briefcase size={16} className="text-muted-foreground" />
            <span className="text-sm text-foreground font-normal">{builder.bounties} bounties</span>
          </div>
        </div>
      </div>
    </Link>
  );
}



function FamousAgentRow({ agent, showButton = false }: { agent: any; showButton?: boolean }) {
  const workspaceLink = useWorkspaceLink();
  
  return (
    <Link to={workspaceLink(`/discover/item/${agent.id}`)}>
      <div className="flex items-center gap-2 py-2 hover:bg-muted rounded-lg transition-colors duration-200 px-2 -mx-2">
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", agent.iconBg)}>
          <Icon name={agent.iconName} size={20} />
        </div>
        <div className="flex-1">
          <h4 className="text-foreground text-sm font-medium">{agent.name}</h4>
          <p className="text-muted-foreground text-sm">{agent.description}</p>
      </div>
        {showButton && (
          <button 
            className="text-primary-foreground hover:opacity-50 transition-opacity px-4 py-1 rounded-xl text-sm bg-primary"
            onClick={(e) => e.preventDefault()}
          >
            Open
          </button>
        )}
      </div>
    </Link>
  );
}

export function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Filter items based on search and category
  const filteredFeaturedItems = useMemo(() => {
    let items = mockFeaturedItems;
    
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory !== "all") {
      items = items.filter(item => item.category === selectedCategory);
    }
    
    return items;
  }, [searchQuery, selectedCategory]);

  const filteredAgents = useMemo(() => {
    let items = mockAgents;
    
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory !== "all" && selectedCategory !== "agents") {
      return [];
    }
    
    return items;
  }, [searchQuery, selectedCategory]);

  const filteredFamousAgents = useMemo(() => {
    let items = mockFamousAgents;
    
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory !== "all" && selectedCategory !== "agents") {
      return [];
    }
    
    return items;
  }, [searchQuery, selectedCategory]);

  return (
    <div className="flex flex-col gap-2 p-1 w-full min-h-screen">
      <PageHeader 
        title="Discover"
        icon="compass"
        actionButtons={
          <>
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0 rounded-xl hover:bg-muted transition-colors">
              <Icon name="layout-grid" size={18} />
            </Button>
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0 rounded-xl hover:bg-muted transition-colors">
              <Icon name="filter" size={18} />
            </Button>
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0 rounded-xl hover:bg-muted transition-colors">
              <Icon name="settings" size={18} />
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-xl text-sm transition-colors">
              Publish an app
            </Button>
          </>
        }
      />

      <div className="flex-1 w-full p-6 space-y-16">
        {/* Hero Section */}
        <div className="relative bg-foreground rounded-[32px] h-[300px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-foreground/50 to-foreground/80" />
          <div className="relative z-10 flex flex-col justify-between h-full p-8">
            <div className="flex items-center gap-2">
              <Icon name="rocket" size={24} className="text-special" />
              <span className="text-special font-bold text-sm tracking-tight">Brand</span>
            </div>
            <div>
              <h2 className="text-background text-[32px] font-normal leading-tight mb-4">
                Vibecode<br />
                high-performance<br />
                storefronts
              </h2>
              <Button className="bg-special text-special-foreground hover:bg-special/90 px-3 py-2 rounded-xl text-sm transition-colors">
                Install app
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Category Tabs */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative w-[300px]">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
                placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                className={cn(
                  "px-3 py-2 rounded-2xl text-base font-normal transition-colors",
                  selectedCategory === "agents" ? "bg-muted text-foreground" : "bg-muted text-foreground hover:bg-muted/80"
                )}
                onClick={() => setSelectedCategory(selectedCategory === "agents" ? "all" : "agents")}
              >
                <Icon name="bot" size={16} className="mr-2" />
                Agents
              </Button>
              <Button 
                variant="ghost" 
                className={cn(
                  "px-3 py-2 rounded-2xl text-base font-normal transition-colors",
                  selectedCategory === "prompts" ? "bg-muted text-foreground" : "bg-muted text-foreground hover:bg-muted/80"
                )}
                onClick={() => setSelectedCategory(selectedCategory === "prompts" ? "all" : "prompts")}
              >
                <Icon name="notebook" size={16} className="mr-2" />
                Prompts
              </Button>
              <Button 
                variant="ghost" 
                className={cn(
                  "px-3 py-2 rounded-2xl text-base font-normal transition-colors",
                  selectedCategory === "tools" ? "bg-muted text-foreground" : "bg-muted text-foreground hover:bg-muted/80"
                )}
                onClick={() => setSelectedCategory(selectedCategory === "tools" ? "all" : "tools")}
              >
                <Icon name="wrench" size={16} className="mr-2" />
                Tools
              </Button>
              <Button 
                variant="ghost" 
                className={cn(
                  "px-3 py-2 rounded-2xl text-base font-normal transition-colors",
                  selectedCategory === "views" ? "bg-muted text-foreground" : "bg-muted text-foreground hover:bg-muted/80"
                )}
                onClick={() => setSelectedCategory(selectedCategory === "views" ? "all" : "views")}
              >
                <Icon name="app-window" size={16} className="mr-2" />
                Views
              </Button>
              <Button 
                variant="ghost" 
                className={cn(
                  "px-3 py-2 rounded-2xl text-base font-normal transition-colors",
                  selectedCategory === "workflows" ? "bg-muted text-foreground" : "bg-muted text-foreground hover:bg-muted/80"
                )}
                onClick={() => setSelectedCategory(selectedCategory === "workflows" ? "all" : "workflows")}
              >
                <Icon name="workflow" size={16} className="mr-2" />
                Workflows
              </Button>
              <Button 
                variant="ghost" 
                className={cn(
                  "px-3 py-2 rounded-2xl text-base font-normal transition-colors",
                  selectedCategory === "builders" ? "bg-muted text-foreground" : "bg-muted text-foreground hover:bg-muted/80"
                )}
                onClick={() => setSelectedCategory(selectedCategory === "builders" ? "all" : "builders")}
              >
                <Icon name="circle-user" size={16} className="mr-2" />
                Builders
              </Button>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="px-3 py-2 rounded-2xl text-base font-normal transition-colors">
                Sales
              </Button>
              <Button variant="secondary" className="px-3 py-2 rounded-2xl text-base font-normal transition-colors">
                Marketing
              </Button>
              <Button variant="secondary" className="px-3 py-2 rounded-2xl text-base font-normal transition-colors">
                Design
              </Button>
              <Button variant="secondary" className="px-3 py-2 rounded-2xl text-base font-normal transition-colors">
                Finance
              </Button>
            </div>
          </div>
        </div>
        
        {/* Featured Section */}
        {filteredFeaturedItems.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl text-foreground font-normal">Featured</h2>
              <span className="text-2xl text-muted-foreground opacity-50">{filteredFeaturedItems.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFeaturedItems.map((item) => (
                <AgentCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Builders Section */}
        {(selectedCategory === "all" || selectedCategory === "builders") && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl text-foreground font-normal">Builders</h2>
              <span className="text-2xl text-muted-foreground opacity-50">3</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <BuilderCard builder={mockBuilders[0]} />
              <BuilderCard builder={mockBuilders[1]} />
              <BuilderCard builder={mockBuilders[2]} />
            </div>
          </div>
        )}

        {/* Agents Section */}
        {filteredAgents.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl text-foreground font-normal">Agents</h2>
              <span className="text-2xl text-muted-foreground opacity-50">{filteredAgents.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.id} item={agent} />
              ))}
            </div>
          </div>
        )}

        {/* Famous Agents Section */}
        {filteredFamousAgents.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl text-foreground font-normal">Famous Agents</h2>
              <span className="text-2xl text-muted-foreground opacity-50">{filteredFamousAgents.length}</span>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFamousAgents.slice(0, 3).map((agent, i) => (
                  <FamousAgentRow key={agent.id} agent={agent} showButton={i === 0} />
                ))}
              </div>
              {filteredFamousAgents.length > 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFamousAgents.slice(3, 6).map((agent) => (
                    <FamousAgentRow key={agent.id} agent={agent} />
                  ))}
                </div>
              )}
              {filteredFamousAgents.length > 6 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFamousAgents.slice(6, 9).map((agent) => (
                    <FamousAgentRow key={agent.id} agent={agent} />
                  ))}
                </div>
              )}
            </div>
            </div>
          )}

        {/* Marketplace Banner */}
        <div className="bg-special rounded-3xl h-[284px] flex flex-col items-center justify-center relative overflow-hidden">
          <div className="relative z-10 text-center space-y-6">
            <h2 className="text-special-foreground text-[32px] font-medium leading-tight tracking-tight">
              Explore our marketplace of<br />
              tools, agents, workflows, and more
            </h2>
            <div className="w-[458px]">
              <div className="relative">
                <Icon name="search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-xl bg-background border-border"
                />
              </div>
            </div>
          </div>
          {/* Background pattern - simplified */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute right-0 top-0 w-[800px] h-[400px] bg-gradient-to-l from-foreground/20 to-transparent rounded-full transform translate-x-1/2 -translate-y-1/4" />
            <div className="absolute left-0 bottom-0 w-[800px] h-[400px] bg-gradient-to-r from-foreground/20 to-transparent rounded-full transform -translate-x-1/2 translate-y-1/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
