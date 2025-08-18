import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Avatar, AvatarFallback } from "@deco/ui/components/avatar.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState, useMemo } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";

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
    downloads: 5670,
    price: "$4.00 / 1M token",
    category: "agents"
  }
];

const mockBuilders = [
  {
    id: "rafael",
    name: "Rafael Valls",
    role: "Machine Learning Engineer",
    authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    agents: 3,
    users: "5.2k",
    bounties: 10
  },
  {
    id: "leandro1",
    name: "Leandro Borges",
    description: "Crawl websites and extract text content to feed AI models, LLM applications, vector databases, or RAG pipelines.",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    downloads: 6455
  },
  {
    id: "guilherme",
    name: "Guilherme Rodrigues", 
    description: "Crawl websites and extract text content to feed AI models, LLM applications, vector databases.",
    authorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    downloads: 6455
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

function FeaturedCard({ item }: { item: any }) {
  const workspaceLink = useWorkspaceLink();
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div 
      className="h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={workspaceLink(`/agents/${item.id}`)}>
        <motion.div 
          className="bg-primary rounded-2xl h-full flex flex-col cursor-pointer overflow-hidden"
          layout
        >
          {/* Content card that shrinks on hover */}
          <motion.div 
            className="bg-muted p-6 flex flex-col rounded-2xl"
            animate={{
              flex: isHovered ? "0 0 auto" : "1 1 0%"
            }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex items-start justify-between mb-8">
              <div className={cn("w-20 h-20 rounded-[15px] flex items-center justify-center", item.iconBg)}>
                <Icon name={item.iconName} size={32} />
              </div>
              <Badge className={cn("px-2 py-1 rounded-2xl text-sm", item.typeBg, item.typeColor)}>
                <Icon name="bot" size={14} className="mr-1" />
                {item.type}
              </Badge>
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-foreground text-base font-medium leading-tight mb-2.5">{item.name}</h3>
                <motion.div
                  animate={{
                    opacity: isHovered ? 0 : 1,
                    height: isHovered ? 0 : "auto"
                  }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </motion.div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img 
                    src={item.authorImage} 
                    alt={item.author}
                    className="w-6 h-6 rounded-full object-cover border border-border"
                  />
                  <span className="text-sm text-foreground">{item.author}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <Icon name="download" size={16} />
                  <span>{item.downloads.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Footer - always present, revealed when content shrinks */}
          <motion.div 
            className="bg-primary px-6 py-3 flex items-center justify-between"
            animate={{
              opacity: isHovered ? 1 : 0
            }}
            transition={{ duration: 0.2, delay: isHovered ? 0.1 : 0 }}
          >
            <div className="text-primary-foreground text-base font-medium">
              {item.price}
            </div>
            <button className="text-primary-foreground hover:opacity-50 transition-opacity flex items-center gap-2.5">
              <span className="text-base">See more</span>
              <Icon name="arrow-right" size={16} />
            </button>
          </motion.div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function BuilderCard({ builder, isProfile = false }: { builder: any; isProfile?: boolean }) {
  const workspaceLink = useWorkspaceLink();
  const [isHovered, setIsHovered] = useState(false);

  if (isProfile) {
    return (
      <div className="relative">
        <Link to={workspaceLink(`/builders/${builder.id}`)}>
          <Card 
            className="bg-foreground rounded-2xl overflow-hidden h-72 transition-all duration-200 cursor-pointer border-0 hover:bg-foreground/90"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="bg-muted p-6 h-full flex flex-col items-center justify-start">
              <Avatar className="w-20 h-20 mb-8 bg-[#d0ec1a]">
                <AvatarFallback className="text-2xl">👤</AvatarFallback>
              </Avatar>
              
              <div className="text-center space-y-4 flex-1">
                <div>
                  <h3 className="text-foreground text-base font-medium">{builder.name}</h3>
                  <p className="text-muted-foreground text-sm mt-2.5">{builder.role}</p>
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border">
                    <Icon name="sparkle" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">{builder.agents} agents</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border">
                    <Icon name="circle-user" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">{builder.users} users</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border">
                    <Icon name="briefcase-business" size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground">{builder.bounties} bounties</span>
                  </div>
          </div>
          </div>
        </div>
            <div className="bg-foreground p-4 flex items-center justify-center gap-2.5">
              <span className="text-background text-base">See more</span>
              <Icon name="arrow-right" size={16} className="text-background" />
            </div>
          </Card>
        </Link>
      </div>
    );
  }

  return (
    <motion.div 
      className="relative h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={workspaceLink(`/builders/${builder.id}`)}>
        <div className="bg-primary rounded-2xl h-full flex flex-col cursor-pointer relative overflow-hidden">
          {/* Always present footer - revealed when content shrinks */}
          <div className="bg-primary px-6 py-3 flex items-center justify-center absolute bottom-0 left-0 right-0 rounded-b-2xl">
            <button className="text-primary-foreground hover:opacity-50 transition-opacity flex items-center gap-2.5">
              <span className="text-base">See more</span>
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
          
          {/* Content card that shrinks on hover */}
          <motion.div 
            className="bg-muted p-6 flex flex-col rounded-2xl relative z-10"
            animate={{
              height: isHovered ? "calc(100% - 60px)" : "100%"
            }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <Avatar className="w-20 h-20 mb-8 bg-[#d0ec1a] mx-auto">
              <AvatarFallback className="text-2xl">👤</AvatarFallback>
            </Avatar>
            
            <div className="text-center flex-1 flex flex-col justify-between min-h-0">
              <div className="flex-1">
                <h3 className="text-foreground text-base font-medium mb-2.5">{builder.name}</h3>
                <motion.div
                  animate={{
                    opacity: isHovered ? 0 : 1,
                    height: isHovered ? 0 : "auto"
                  }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="text-muted-foreground text-sm leading-relaxed text-left">
                    {builder.description}
                  </p>
                </motion.div>
        </div>
        
              <div className="flex items-center justify-between mt-auto pt-4">
                <div className="flex items-center gap-2.5">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs">👤</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-foreground">{builder.name}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <Icon name="download" size={16} />
                  <span>{builder.downloads.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
      </Link>
    </motion.div>
  );
}

function AgentCard({ agent, isPricing = false }: { agent: any; isPricing?: boolean }) {
  const workspaceLink = useWorkspaceLink();
  const [isHovered, setIsHovered] = useState(false);
  
  if (isPricing) {
  return (
      <div className="relative">
        <Link to={workspaceLink(`/agents/${agent.id}`)}>
          <Card 
            className="bg-foreground rounded-2xl overflow-hidden h-72 transition-all duration-200 cursor-pointer border-0 hover:bg-foreground/90"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="bg-border p-0.5 h-full rounded-2xl">
              <div className="bg-muted p-6 h-full rounded-2xl flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", agent.iconBg)}>
                    <Icon name={agent.iconName} size={24} />
                  </div>
                  <Badge className={cn("px-2 py-1 rounded-2xl text-sm", agent.typeBg, agent.typeColor)}>
                    <Icon name="bot" size={14} className="mr-1" />
                    {agent.type}
        </Badge>
      </div>
                
                <div className="mb-2">
                  <h3 className="text-foreground text-base font-medium">{agent.name}</h3>
                </div>
                
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs">👤</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">{agent.author}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-foreground">
                    <Icon name="download" size={16} />
                    <span>{agent.downloads.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="px-6 py-3 -mx-6 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-foreground text-2xl font-medium">{agent.price}</div>
                    </div>
                    <div className="grid grid-cols-2 grid-rows-2 gap-1.5 p-2 w-20 h-20">
                      {agent.features?.map((feature: string, i: number) => (
                        <div key={i} className="flex items-center justify-center">
                          <Icon name={feature} size={20} className="text-muted-foreground" />
                        </div>
        ))}
      </div>
    </div>
                </div>
              </div>
            </div>
            <div className="bg-foreground p-4 flex items-center justify-center gap-2.5">
              <span className="text-background text-base">See more</span>
              <Icon name="arrow-right" size={16} className="text-background" />
            </div>
          </Card>
        </Link>
      </div>
    );
  }

  return (
    <motion.div 
      className="h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link to={workspaceLink(`/agents/${agent.id}`)}>
        <motion.div 
          className="bg-primary rounded-2xl h-full flex flex-col cursor-pointer overflow-hidden"
          layout
        >
          {/* Content card that shrinks on hover */}
          <motion.div 
            className="bg-muted p-6 flex flex-col rounded-2xl"
            animate={{
              flex: isHovered ? "0 0 auto" : "1 1 0%"
            }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex items-start justify-between mb-8">
              <div className={cn("w-20 h-20 rounded-[15px] flex items-center justify-center", agent.iconBg)}>
                <Icon name={agent.iconName} size={32} />
              </div>
              <Badge className={cn("px-2 py-1 rounded-2xl text-sm", agent.typeBg, agent.typeColor)}>
                <Icon name="bot" size={14} className="mr-1" />
                {agent.type}
              </Badge>
            </div>
            
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-foreground text-base font-medium leading-tight mb-2.5">{agent.name}</h3>
                <motion.div
                  animate={{
                    opacity: isHovered ? 0 : 1,
                    height: isHovered ? 0 : "auto"
                  }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {agent.description}
                  </p>
                </motion.div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img 
                    src={agent.authorImage} 
                    alt={agent.author}
                    className="w-6 h-6 rounded-full object-cover border border-border"
                  />
                  <span className="text-sm text-foreground">{agent.author}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <Icon name="download" size={16} />
                  <span>{agent.downloads.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Footer - always present, revealed when content shrinks */}
          <motion.div 
            className="bg-primary px-6 py-3 flex items-center justify-between"
            animate={{
              opacity: isHovered ? 1 : 0
            }}
            transition={{ duration: 0.2, delay: isHovered ? 0.1 : 0 }}
          >
            <div className="text-primary-foreground text-base font-medium">
              {agent.price}
            </div>
            <button className="text-primary-foreground hover:opacity-50 transition-opacity flex items-center gap-2.5">
              <span className="text-base">See more</span>
              <Icon name="arrow-right" size={16} />
            </button>
          </motion.div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function FamousAgentRow({ agent, showButton = false }: { agent: any; showButton?: boolean }) {
  const workspaceLink = useWorkspaceLink();
  
  return (
    <Link to={workspaceLink(`/agents/${agent.id}`)}>
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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon name="compass" size={20} className="text-muted-foreground opacity-50" />
          <h1 className="text-xl text-foreground font-normal">Discover</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="w-9 h-9 p-0 rounded-xl hover:bg-muted transition-colors">
            <Icon name="layout-grid" size={18} />
          </Button>
          <Button variant="ghost" size="sm" className="w-9 h-9 p-0 rounded-xl hover:bg-muted transition-colors">
            <Icon name="filter" size={18} />
          </Button>
          <Button variant="ghost" size="sm" className="w-9 h-9 p-0 rounded-xl hover:bg-muted transition-colors">
            <Icon name="settings" size={18} />
          </Button>
          <Button className="bg-special text-special-foreground hover:bg-special/90 px-3 py-2 rounded-xl text-sm transition-colors">
            Publish an app
          </Button>
        </div>
      </div>

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
              <Button variant="ghost" className="bg-muted text-foreground hover:bg-muted/80 px-3 py-2 rounded-2xl text-base font-normal transition-colors">
                Sales
              </Button>
              <Button variant="ghost" className="bg-muted text-foreground hover:bg-muted/80 px-3 py-2 rounded-2xl text-base font-normal transition-colors">
                Marketing
              </Button>
              <Button variant="ghost" className="bg-muted text-foreground hover:bg-muted/80 px-3 py-2 rounded-2xl text-base font-normal transition-colors">
                Design
              </Button>
              <Button variant="ghost" className="bg-muted text-foreground hover:bg-muted/80 px-3 py-2 rounded-2xl text-base font-normal transition-colors">
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
                <FeaturedCard key={item.id} item={item} />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <BuilderCard builder={mockBuilders[0]} isProfile={true} />
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
              {filteredAgents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} isPricing={i === 1} />
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
