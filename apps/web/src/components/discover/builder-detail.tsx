import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Link, useParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useState } from "react";

// Mock data for builders with detailed information
const mockBuilderData = {
  "leandro": {
    id: "leandro",
    name: "Marcus Chen",
    role: "Machine Learning Engineer",
    bio: "Passionate ML engineer with 8+ years of experience building AI-powered applications. Specialized in creating intelligent agents and automation tools that help businesses scale their operations. Love working with Google Workspace integrations and data processing pipelines.",
    location: "São Paulo, Brazil",
    timezone: "GMT-3",
    profileImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    bannerImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&h=400&fit=crop",
    badges: ["/badge-01.svg", "/badge-02.svg"],
    certifications: [
      { name: "Google Cloud ML Engineer", issuer: "Google", date: "2023", verified: true },
      { name: "AWS Machine Learning", issuer: "Amazon", date: "2022", verified: true }
    ],
    stats: {
      totalApps: 8,
      totalUsers: "12.4k",
      totalBounties: 15,
      completedBounties: 12,
      rating: 4.9,
      responseTime: "< 2 hours",
      completionRate: "98%"
    },
    availability: {
      status: "available", // available, busy, unavailable
      nextAvailable: null,
      workingHours: "9 AM - 6 PM BRT"
    },
    pricing: {
      hourlyRate: "$85",
      projectRate: "Starting at $500",
      currency: "USD"
    },
    skills: [
      "Machine Learning", "Python", "TensorFlow", "Google Sheets API", 
      "Data Processing", "Automation", "REST APIs", "JavaScript", "TypeScript"
    ],
    socialLinks: {
      github: "https://github.com/leandroborges",
      linkedin: "https://linkedin.com/in/leandroborges",
      twitter: "https://twitter.com/leandroborges",
      website: "https://leandroborges.dev"
    },
    apps: [
      {
        id: "sheets-creator",
        name: "Create Google Spreadsheet",
        description: "AI Builder optimized for creating and managing Google Spreadsheets with advanced automation capabilities.",
        iconName: "file_spreadsheet",
        iconBg: "bg-[#d0ec1a]",
        type: "Agent",
        downloads: 6455,
        rating: 4.8,
        lastUpdated: "1 day ago"
      },
      {
        id: "sheets-tool",
        name: "Google Sheets Integration",
        description: "Connect and manipulate Google Sheets directly from your agents with advanced data processing capabilities.",
        iconName: "file_spreadsheet",
        iconBg: "bg-background",
        type: "Tool",
        downloads: 8920,
        rating: 4.9,
        lastUpdated: "3 days ago"
      },
      {
        id: "data-processor",
        name: "Data Processing Agent",
        description: "Advanced data processing and transformation tool for complex workflows.",
        iconName: "trending_up",
        iconBg: "bg-blue-400",
        type: "Agent",
        downloads: 3200,
        rating: 4.7,
        lastUpdated: "1 week ago"
      }
    ],
    recentWork: [
      {
        project: "E-commerce Analytics Dashboard",
        client: "TechCorp Inc.",
        completedDate: "2 weeks ago",
        rating: 5,
        testimonial: "Excellent work on the analytics dashboard. Marcus delivered exactly what we needed and more."
      },
      {
        project: "Inventory Management System",
        client: "RetailPro",
        completedDate: "1 month ago",
        rating: 5,
        testimonial: "Outstanding automation solution that saved us hours of manual work daily."
      },
      {
        project: "Customer Data Integration",
        client: "StartupXYZ",
        completedDate: "2 months ago",
        rating: 4,
        testimonial: "Great technical skills and communication throughout the project."
      }
    ],
    reviews: [
      {
        id: 1,
        author: "Emma Thompson",
        authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
        rating: 5,
        date: "1 week ago",
        project: "Google Sheets Automation",
        comment: "Marcus built an amazing automation system for our Google Sheets. The solution is robust, well-documented, and exactly what we needed. Highly recommend!"
      },
      {
        id: 2,
        author: "James Wilson",
        authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
        rating: 5,
        date: "2 weeks ago",
        project: "Data Processing Pipeline",
        comment: "Excellent work on our data processing pipeline. Marcus was professional, responsive, and delivered high-quality code."
      },
      {
        id: 3,
        author: "Lisa Park",
        authorImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
        rating: 4,
        date: "1 month ago",
        project: "ML Model Integration",
        comment: "Great technical expertise and problem-solving skills. The ML integration works perfectly in our production environment."
      }
    ]
  },
  "rafael": {
    id: "rafael",
    name: "Sofia Rodriguez",
    role: "Full Stack Developer",
    bio: "Full-stack developer with expertise in modern web technologies and AI integrations. I specialize in building scalable applications with React, Node.js, and various APIs. Passionate about creating seamless user experiences and robust backend systems.",
    location: "Barcelona, Spain",
    timezone: "GMT+1",
    profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face",
    bannerImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=400&fit=crop",
    badges: ["/badge-04.svg"],
    certifications: [
      { name: "React Developer", issuer: "Meta", date: "2023", verified: true },
      { name: "Node.js Certified", issuer: "OpenJS Foundation", date: "2022", verified: true }
    ],
    stats: {
      totalApps: 12,
      totalUsers: "18.7k",
      totalBounties: 22,
      completedBounties: 20,
      rating: 4.8,
      responseTime: "< 1 hour",
      completionRate: "95%"
    },
    availability: {
      status: "available",
      nextAvailable: null,
      workingHours: "10 AM - 7 PM CET"
    },
    pricing: {
      hourlyRate: "$75",
      projectRate: "Starting at $400",
      currency: "USD"
    },
    skills: [
      "React", "Node.js", "TypeScript", "Next.js", "PostgreSQL", 
      "API Development", "Notion API", "Slack Integration", "GitHub Actions"
    ],
    socialLinks: {
      github: "https://github.com/rafaelvalls",
      linkedin: "https://linkedin.com/in/rafaelvalls",
      twitter: "https://twitter.com/rafaelvalls",
      website: "https://rafaelvalls.dev"
    },
    apps: [
      {
        id: "notion-tool",
        name: "Notion Database Manager",
        description: "Create and manage Notion databases seamlessly with advanced automation and data synchronization.",
        iconName: "book",
        iconBg: "bg-background",
        type: "Tool",
        downloads: 8900,
        rating: 4.9,
        lastUpdated: "4 days ago"
      },
      {
        id: "slack-integration",
        name: "Slack Bot Builder",
        description: "Build custom Slack bots with advanced automation and workflow capabilities.",
        iconName: "message-circle",
        iconBg: "bg-[#4A154B]",
        type: "Agent",
        downloads: 5200,
        rating: 4.7,
        lastUpdated: "1 week ago"
      }
    ],
    recentWork: [
      {
        project: "Team Collaboration Platform",
        client: "DevTeam Pro",
        completedDate: "1 week ago",
        rating: 5,
        testimonial: "Sofia built an incredible collaboration platform that transformed our workflow."
      },
      {
        project: "Notion CRM System",
        client: "SalesForce Ltd",
        completedDate: "3 weeks ago",
        rating: 5,
        testimonial: "Perfect integration with our existing Notion workspace. Highly recommended!"
      }
    ],
    reviews: [
      {
        id: 1,
        author: "Ryan Martinez",
        authorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
        rating: 5,
        date: "3 days ago",
        project: "Web Application Development",
        comment: "Sofia delivered an exceptional web application. Clean code, great UI/UX, and excellent communication throughout."
      },
      {
        id: 2,
        author: "Lisa Wang",
        authorImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
        rating: 5,
        date: "1 week ago",
        project: "API Integration",
        comment: "Smooth API integration with our existing systems. Sofia understood our requirements perfectly."
      }
    ]
  },
  "guilherme": {
    id: "guilherme",
    name: "David Kim",
    role: "AI Engineer",
    bio: "AI Engineer focused on building intelligent systems and conversational agents. Experienced in natural language processing, machine learning, and creating AI-powered tools that enhance productivity. Love working on cutting-edge AI projects.",
    location: "Lisbon, Portugal",
    timezone: "GMT+0",
    profileImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face",
    bannerImage: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&h=400&fit=crop",
    badges: ["/badge-03.svg", "/badge-01.svg", "/badge-04.svg"],
    certifications: [
      { name: "OpenAI API Specialist", issuer: "OpenAI", date: "2023", verified: true },
      { name: "AI/ML Engineer", issuer: "Coursera", date: "2022", verified: true }
    ],
    stats: {
      totalApps: 6,
      totalUsers: "8.9k",
      totalBounties: 18,
      completedBounties: 16,
      rating: 4.9,
      responseTime: "< 3 hours",
      completionRate: "97%"
    },
    availability: {
      status: "busy",
      nextAvailable: "Available in 2 weeks",
      workingHours: "9 AM - 6 PM WET"
    },
    pricing: {
      hourlyRate: "$95",
      projectRate: "Starting at $800",
      currency: "USD"
    },
    skills: [
      "OpenAI API", "LangChain", "Python", "AI Agents", "NLP", 
      "Discord Bots", "Twitter API", "Conversational AI", "Machine Learning"
    ],
    socialLinks: {
      github: "https://github.com/guilhermero",
      linkedin: "https://linkedin.com/in/guilhermero",
      twitter: "https://twitter.com/guilhermero",
      website: "https://guilhermero.ai"
    },
    apps: [
      {
        id: "ai-assistant",
        name: "Smart AI Assistant",
        description: "Advanced AI assistant with natural language processing and task automation capabilities.",
        iconName: "brain",
        iconBg: "bg-green-500",
        type: "Agent",
        downloads: 4200,
        rating: 4.9,
        lastUpdated: "2 days ago"
      },
      {
        id: "discord-bot",
        name: "Discord Community Bot",
        description: "Intelligent Discord bot for community management and engagement.",
        iconName: "message-square",
        iconBg: "bg-[#5865F2]",
        type: "Agent",
        downloads: 3100,
        rating: 4.8,
        lastUpdated: "5 days ago"
      }
    ],
    recentWork: [
      {
        project: "AI Customer Support System",
        client: "TechSupport Inc",
        completedDate: "2 weeks ago",
        rating: 5,
        testimonial: "David created an AI system that handles 80% of our customer inquiries automatically."
      }
    ],
    reviews: [
      {
        id: 1,
        author: "Michael Chang",
        authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
        rating: 5,
        date: "5 days ago",
        project: "AI Chatbot Development",
        comment: "Incredible AI chatbot that exceeded our expectations. David's expertise in AI is outstanding."
      }
    ]
  }
};

export function BuilderDetailPage() {
  const { builderId } = useParams<{ builderId: string }>();
  const workspaceLink = useWorkspaceLink();
  const [isFollowing, setIsFollowing] = useState(false);
  
  const builder = mockBuilderData[builderId as keyof typeof mockBuilderData];
  
  if (!builder) {
    return (
      <div className="container mx-auto px-6 py-8 text-center">
        <Icon name="x-circle" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Builder Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The builder you're looking for doesn't exist or has been removed.
        </p>
        <Link to={workspaceLink("/discover")}>
          <Button>
            <Icon name="arrow-left" size={16} className="mr-2" />
            Back to Discover
          </Button>
        </Link>
      </div>
    );
  }

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    trackEvent("builder_follow_click", {
      builderId: builder.id,
      builderName: builder.name,
      action: isFollowing ? "unfollow" : "follow"
    });
  };

  const handleContact = () => {
    trackEvent("builder_contact_click", {
      builderId: builder.id,
      builderName: builder.name
    });
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case "available": return "text-green-600";
      case "busy": return "text-yellow-600";
      case "unavailable": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  const getAvailabilityText = (status: string) => {
    switch (status) {
      case "available": return "Available for work";
      case "busy": return "Busy";
      case "unavailable": return "Unavailable";
      default: return "Unknown";
    }
  };

  return (
    <div className="flex flex-col gap-2 p-1 w-full min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-2 min-h-[60px]">
        <Link to={workspaceLink("/discover")} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <Icon name="arrow_back" size={20} className="text-muted-foreground opacity-50" />
          <h1 className="text-xl text-foreground font-normal">Back to Discover</h1>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex flex-row gap-2 items-start justify-center max-w-[1200px] mx-auto w-full">
        <div className="flex-1 max-w-[900px] p-4 space-y-12 pb-16">
          {/* Hero Section */}
          <div className="space-y-6">
            {/* Banner */}
            <div className="relative h-[200px] rounded-3xl overflow-hidden">
              <img 
                src={builder.bannerImage} 
                alt={`${builder.name} banner`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>

            {/* Profile Section */}
            <div className="space-y-8 -mt-16 relative z-10">
              {/* Profile Header */}
              <div className="flex flex-row items-start justify-between">
                {/* Left side - Profile Image */}
                <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-background shadow-lg">
                  <img 
                    src={builder.profileImage} 
                    alt={builder.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Right side - Action Buttons aligned with center of image */}
                <div className="flex flex-row gap-2 items-center mt-12">
                  <Button 
                    variant="special"
                    className="px-8 py-2 rounded-xl text-sm"
                    onClick={handleContact}
                  >
                    <Icon name="mail" size={16} className="mr-2" />
                    Contact
                  </Button>
                  <Button 
                    variant={isFollowing ? "outline" : "outline"}
                    className="px-6 py-2 rounded-xl text-sm"
                    onClick={handleFollow}
                  >
                    <Icon name={isFollowing ? "check" : "person_add"} size={16} className="mr-2" />
                    {isFollowing ? "Following" : "Follow"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="p-2 rounded-xl bg-muted"
                  >
                    <Icon name="share" size={18} className="text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Profile Info - Below image, left aligned */}
              <div className="flex flex-col gap-2 items-start">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-medium text-foreground">{builder.name}</h1>
                  {/* Badges */}
                  <div className="flex items-center">
                    {builder.badges.map((badge, index) => (
                      <div key={badge} className="flex h-[20px] w-[20px] items-center justify-center -mr-2 last:mr-0 relative">
                        <div className="flex-none rotate-45">
                          <div 
                            className="w-[15px] h-[15px] rounded-sm border-2 border-border"
                            style={{ 
                              backgroundColor: index === 0 ? '#a78bfa' : '#1e40af',
                              zIndex: builder.badges.length - index 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-lg text-muted-foreground">{builder.role}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Icon name="location_on" size={16} />
                    <span>{builder.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="schedule" size={16} />
                    <span>{builder.timezone}</span>
                  </div>
                  <div className={cn("flex items-center gap-1", getAvailabilityColor(builder.availability.status))}>
                    <div className={cn("w-2 h-2 rounded-full", 
                      builder.availability.status === "available" ? "bg-green-600" :
                      builder.availability.status === "busy" ? "bg-yellow-600" : "bg-red-600"
                    )} />
                    <span>{getAvailabilityText(builder.availability.status)}</span>
                  </div>
                </div>
              </div>

              {/* Stats Section */}
              <div className="flex flex-row items-center justify-between w-full">
                <div className="flex flex-col gap-2.5 items-center">
                  <Icon name="apps" size={18} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-foreground font-normal">{builder.stats.totalApps}</p>
                    <p className="text-sm text-foreground font-normal">apps created</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 items-center">
                  <Icon name="person" size={18} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-foreground font-normal">{builder.stats.totalUsers}</p>
                    <p className="text-sm text-foreground font-normal">total users</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 items-center">
                  <Icon name="work" size={18} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-foreground font-normal">{builder.stats.completedBounties}/{builder.stats.totalBounties}</p>
                    <p className="text-sm text-foreground font-normal">bounties done</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 items-center">
                  <Icon name="star" size={18} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-foreground font-normal">{builder.stats.rating}</p>
                    <p className="text-sm text-foreground font-normal">rating</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 items-center">
                  <Icon name="schedule" size={18} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-foreground font-normal">{builder.stats.responseTime}</p>
                    <p className="text-sm text-foreground font-normal">response time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {builder.bio}
            </p>
          </div>

          {/* Skills Section */}
          <div className="space-y-6">
            <h2 className="text-base font-medium text-foreground">Skills & Expertise</h2>
            <div className="flex flex-wrap gap-2">
              {builder.skills.map((skill, index) => (
                <Badge key={index} variant="secondary" className="px-3 py-1 text-sm">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tabs Section */}
          <div className="space-y-6">
            <Tabs defaultValue="apps" className="w-full">
              <TabsList className="flex w-fit bg-transparent p-0 h-auto border-b border-border">
                <TabsTrigger 
                  value="apps" 
                  className="px-8 py-2 bg-transparent border-0 border-b-2 border-transparent data-[state=active]:border-b-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground rounded-none text-muted-foreground hover:text-foreground transition-colors"
                >
                  Apps ({builder.apps.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="reviews" 
                  className="px-8 py-2 bg-transparent border-0 border-b-2 border-transparent data-[state=active]:border-b-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground rounded-none text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reviews ({builder.reviews.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="work" 
                  className="px-8 py-2 bg-transparent border-0 border-b-2 border-transparent data-[state=active]:border-b-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground rounded-none text-muted-foreground hover:text-foreground transition-colors"
                >
                  Recent Work
                </TabsTrigger>
                <TabsTrigger 
                  value="about" 
                  className="px-8 py-2 bg-transparent border-0 border-b-2 border-transparent data-[state=active]:border-b-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-foreground rounded-none text-muted-foreground hover:text-foreground transition-colors"
                >
                  About
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="apps" className="space-y-6 mt-8">
                <div className="grid gap-6">
                  {builder.apps.map((app) => (
                    <Link key={app.id} to={workspaceLink(`/discover/item/${app.id}`)} className="block">
                      <div className="flex items-start gap-4 p-4 border border-border rounded-2xl hover:border-muted transition-colors">
                        <div className={cn("w-16 h-16 rounded-xl flex items-center justify-center", app.iconBg)}>
                          <Icon name={app.iconName} size={24} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-medium text-foreground">{app.name}</h3>
                            <Badge variant="outline" className="text-xs">{app.type}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{app.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Icon name="download" size={12} />
                              <span>{app.downloads.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Icon name="star" size={12} />
                              <span>{app.rating}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Icon name="update" size={12} />
                              <span>Updated {app.lastUpdated}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="reviews" className="space-y-6 mt-8">
                <div className="space-y-6">
                  {builder.reviews.map((review) => (
                    <div key={review.id} className="p-6 border border-border rounded-2xl">
                      <div className="flex items-start gap-4">
                        <img 
                          src={review.authorImage} 
                          alt={review.author}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-foreground">{review.author}</h4>
                              <p className="text-sm text-muted-foreground">{review.project}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Icon 
                                    key={i} 
                                    name="star" 
                                    size={14} 
                                    className={i < review.rating ? "text-yellow-500" : "text-muted-foreground"} 
                                  />
                                ))}
                              </div>
                              <span className="text-sm text-muted-foreground">{review.date}</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="work" className="space-y-6 mt-8">
                <div className="space-y-6">
                  {builder.recentWork.map((work, index) => (
                    <div key={index} className="p-6 border border-border rounded-2xl">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-foreground">{work.project}</h4>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <Icon 
                                  key={i} 
                                  name="star" 
                                  size={14} 
                                  className={i < work.rating ? "text-yellow-500" : "text-muted-foreground"} 
                                />
                              ))}
                            </div>
                            <span className="text-sm text-muted-foreground">{work.completedDate}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">Client: {work.client}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed italic">"{work.testimonial}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="about" className="space-y-8 mt-8">
                {/* Pricing */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Pricing</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border border-border rounded-2xl">
                      <div className="space-y-2">
                        <h4 className="font-medium text-foreground">Hourly Rate</h4>
                        <p className="text-2xl font-bold text-foreground">{builder.pricing.hourlyRate}</p>
                        <p className="text-sm text-muted-foreground">per hour</p>
                      </div>
                    </div>
                    <div className="p-4 border border-border rounded-2xl">
                      <div className="space-y-2">
                        <h4 className="font-medium text-foreground">Project Rate</h4>
                        <p className="text-2xl font-bold text-foreground">{builder.pricing.projectRate}</p>
                        <p className="text-sm text-muted-foreground">for fixed projects</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Availability */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Availability</h3>
                  <div className="p-4 border border-border rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <div className={cn("flex items-center gap-2", getAvailabilityColor(builder.availability.status))}>
                        <div className={cn("w-2 h-2 rounded-full", 
                          builder.availability.status === "available" ? "bg-green-600" :
                          builder.availability.status === "busy" ? "bg-yellow-600" : "bg-red-600"
                        )} />
                        <span className="text-sm font-medium">{getAvailabilityText(builder.availability.status)}</span>
                      </div>
                    </div>
                    {builder.availability.nextAvailable && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Next Available</span>
                        <span className="text-sm text-foreground">{builder.availability.nextAvailable}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Working Hours</span>
                      <span className="text-sm text-foreground">{builder.availability.workingHours}</span>
                    </div>
                  </div>
                </div>

                {/* Certifications */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Certifications</h3>
                  <div className="space-y-3">
                    {builder.certifications.map((cert, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Icon name="verified" size={20} className="text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{cert.name}</h4>
                          <p className="text-sm text-muted-foreground">{cert.issuer} • {cert.date}</p>
                        </div>
                        {cert.verified && (
                          <Badge variant="default" className="text-xs">Verified</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social Links */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-foreground">Connect</h3>
                  <div className="flex gap-3">
                    {builder.socialLinks.github && (
                      <Button variant="outline" size="icon" className="rounded-xl" asChild>
                        <a href={builder.socialLinks.github} target="_blank" rel="noopener noreferrer">
                          <Icon name="github" size={18} />
                        </a>
                      </Button>
                    )}
                    {builder.socialLinks.linkedin && (
                      <Button variant="outline" size="icon" className="rounded-xl" asChild>
                        <a href={builder.socialLinks.linkedin} target="_blank" rel="noopener noreferrer">
                          <Icon name="linkedin" size={18} />
                        </a>
                      </Button>
                    )}
                    {builder.socialLinks.twitter && (
                      <Button variant="outline" size="icon" className="rounded-xl" asChild>
                        <a href={builder.socialLinks.twitter} target="_blank" rel="noopener noreferrer">
                          <Icon name="twitter" size={18} />
                        </a>
                      </Button>
                    )}
                    {builder.socialLinks.website && (
                      <Button variant="outline" size="icon" className="rounded-xl" asChild>
                        <a href={builder.socialLinks.website} target="_blank" rel="noopener noreferrer">
                          <Icon name="language" size={18} />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
