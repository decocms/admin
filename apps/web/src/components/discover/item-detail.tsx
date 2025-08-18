import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Link, useParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";

// Mock data with unique content for each discover page item
const mockItemData = {
  "sheets-creator": {
    id: "sheets-creator",
    name: "Create Google Spreadsheet",
    description: "AI Builder optimized for creating and managing Google Spreadsheets with advanced automation capabilities.",
    fullDescription: "A powerful tool that lets you create, manipulate, and automate Google Spreadsheets directly from your agents. Perfect for data analysis, reporting, and workflow automation. Includes advanced formulas, data validation, and integration with other Google Workspace tools.",
    iconName: "table",
    iconBg: "bg-[#d0ec1a]",
    type: "Agent",
    author: "Leandro Borges",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-01.svg", "/badge-02.svg"],
    installs: 6455,
    updatedAt: "1 day ago",
    monthlyActiveUsers: "12.4k",
    screenshots: [
      "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Sheet Creation", description: "Create new spreadsheets programmatically", icon: "plus" },
      { name: "Data Import", description: "Import data from various sources", icon: "upload" },
      { name: "Formula Builder", description: "Advanced formula generation", icon: "calculator" },
      { name: "Automation", description: "Automate repetitive spreadsheet tasks", icon: "settings" }
    ],
    pricing: {
      type: "per-call",
      description: "Pay per spreadsheet operation. Pricing scales with your usage and subscription tier.",
      plans: [
        { name: "Starter Plan", price: "$0.05", unit: "per operation", features: ["Basic sheet operations", "Up to 1,000 rows", "Standard formulas"] },
        { name: "Pro Plan", price: "$0.03", unit: "per operation", features: ["Advanced operations", "Unlimited rows", "Custom formulas", "Priority support"] },
        { name: "Enterprise Plan", price: "$0.01", unit: "per operation", features: ["All Pro features", "Bulk operations", "Custom integrations", "Dedicated support"] }
      ]
    },
    changelog: [
      {
        version: "v2.1.0",
        date: "1 day ago",
        changes: ["Added support for pivot tables", "Improved formula validation", "Fixed data import issues", "Enhanced error handling"]
      },
      {
        version: "v2.0.0",
        date: "2 weeks ago",
        changes: ["Major performance improvements", "New automation features", "Updated Google Sheets API integration"]
      }
    ]
  },
  "sheets-tool": {
    id: "sheets-tool",
    name: "Google Sheets Integration",
    description: "Connect and manipulate Google Sheets directly from your agents with advanced data processing capabilities.",
    fullDescription: "A comprehensive integration tool for Google Sheets that allows you to read, write, and manipulate spreadsheet data seamlessly. Features real-time collaboration, advanced filtering, and powerful data transformation capabilities.",
    iconName: "table",
    iconBg: "bg-background",
    type: "Tool",
    author: "Leandro Borges",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-01.svg", "/badge-02.svg"],
    installs: 8920,
    updatedAt: "3 days ago",
    monthlyActiveUsers: "18.7k",
    screenshots: [
      "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Real-time Sync", description: "Live synchronization with Google Sheets", icon: "refresh-cw" },
      { name: "Data Validation", description: "Automatic data validation and cleaning", icon: "check" },
      { name: "Batch Operations", description: "Process multiple sheets at once", icon: "copy" },
      { name: "API Integration", description: "Full Google Sheets API access", icon: "link" }
    ],
    pricing: {
      type: "free",
      description: "This tool is completely free to use with unlimited operations. No hidden costs or usage limits.",
      plans: [
        { name: "Free Forever", price: "Free", unit: "", features: ["Unlimited operations", "All features included", "Community support", "Regular updates"] }
      ]
    },
    changelog: [
      {
        version: "v1.8.2",
        date: "3 days ago",
        changes: ["Fixed authentication issues", "Improved batch processing speed", "Added new data validation rules"]
      }
    ]
  },
  "crawler": {
    id: "crawler",
    name: "Website Content Crawler",
    description: "Extract website text and data for AI models with rich formatting and intelligent content parsing.",
    fullDescription: "An advanced web crawling tool that intelligently extracts content from websites while preserving structure and formatting. Perfect for AI training data, content analysis, and automated data collection with respect for robots.txt and rate limiting.",
    iconName: "globe",
    iconBg: "bg-blue-400",
    type: "Tool",
    author: "Sarah Chen",
    authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-03.svg"],
    installs: 15420,
    updatedAt: "5 days ago",
    monthlyActiveUsers: "25.3k",
    screenshots: [
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Smart Parsing", description: "AI-powered content extraction", icon: "cpu" },
      { name: "Rate Limiting", description: "Respectful crawling with delays", icon: "clock" },
      { name: "Format Preservation", description: "Maintains original formatting", icon: "file-text" },
      { name: "Bulk Processing", description: "Crawl multiple URLs efficiently", icon: "zap" }
    ],
    pricing: {
      type: "per-call",
      description: "Pay per website crawled. Volume discounts available for high-usage scenarios.",
      plans: [
        { name: "Basic Plan", price: "$0.10", unit: "per page", features: ["Standard crawling", "Basic content extraction", "Up to 100 pages/day"] },
        { name: "Professional", price: "$0.05", unit: "per page", features: ["Advanced parsing", "Unlimited pages", "Priority processing", "Custom headers"] },
        { name: "Enterprise", price: "$0.02", unit: "per page", features: ["All Pro features", "Dedicated infrastructure", "Custom rate limits", "24/7 support"] }
      ]
    },
    changelog: [
      {
        version: "v3.2.1",
        date: "5 days ago",
        changes: ["Improved JavaScript rendering", "Added support for dynamic content", "Fixed timeout issues", "Enhanced error reporting"]
      },
      {
        version: "v3.2.0",
        date: "2 weeks ago",
        changes: ["New AI-powered content extraction", "Better handling of complex layouts", "Performance optimizations"]
      }
    ]
  },
  "email-agent": {
    id: "email-agent",
    name: "Email Assistant Agent",
    description: "Automated email management and response generation with intelligent classification and prioritization.",
    fullDescription: "A sophisticated email management agent that can automatically classify, prioritize, and respond to emails. Features smart templates, sentiment analysis, and integration with popular email providers. Perfect for customer service and personal productivity.",
    iconName: "mail",
    iconBg: "bg-[#d0ec1a]",
    type: "Agent",
    author: "Sarah Chen",
    authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-03.svg"],
    installs: 3200,
    updatedAt: "1 week ago",
    monthlyActiveUsers: "8.9k",
    screenshots: [
      "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Smart Classification", description: "Automatically categorize incoming emails", icon: "tag" },
      { name: "Response Templates", description: "AI-generated response templates", icon: "message-circle" },
      { name: "Priority Scoring", description: "Intelligent email prioritization", icon: "star" },
      { name: "Multi-Provider", description: "Works with Gmail, Outlook, and more", icon: "mail" }
    ],
    pricing: {
      type: "subscription",
      description: "Monthly subscription with unlimited email processing and premium features.",
      plans: [
        { name: "Personal", price: "$9.99", unit: "per month", features: ["Up to 1,000 emails/month", "Basic templates", "Email classification", "Standard support"] },
        { name: "Professional", price: "$29.99", unit: "per month", features: ["Up to 10,000 emails/month", "Custom templates", "Advanced analytics", "Priority support"] },
        { name: "Business", price: "$99.99", unit: "per month", features: ["Unlimited emails", "Team collaboration", "Custom integrations", "Dedicated support"] }
      ]
    },
    changelog: [
      {
        version: "v1.5.0",
        date: "1 week ago",
        changes: ["Added Outlook integration", "Improved response quality", "New template editor", "Enhanced security features"]
      }
    ]
  },
  "notion-tool": {
    id: "notion-tool",
    name: "Notion Database Manager",
    description: "Create and manage Notion databases seamlessly with advanced automation and data synchronization.",
    fullDescription: "A powerful tool for managing Notion databases with features like automated data entry, bulk operations, template management, and real-time synchronization. Ideal for project management, CRM systems, and knowledge bases.",
    iconName: "notebook",
    iconBg: "bg-background",
    type: "Tool",
    author: "Mike Johnson",
    authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-04.svg"],
    installs: 8900,
    updatedAt: "4 days ago",
    monthlyActiveUsers: "16.2k",
    screenshots: [
      "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1434626881859-194d67b2b86f?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Database Creation", description: "Create databases with custom properties", icon: "database" },
      { name: "Bulk Operations", description: "Import/export data in bulk", icon: "upload" },
      { name: "Template System", description: "Reusable database templates", icon: "copy" },
      { name: "Real-time Sync", description: "Live synchronization with Notion", icon: "refresh-cw" }
    ],
    pricing: {
      type: "free",
      description: "Free to use with all features included. No usage limits or hidden costs.",
      plans: [
        { name: "Free Plan", price: "Free", unit: "", features: ["Unlimited databases", "All features included", "Community support", "Regular updates"] }
      ]
    },
    changelog: [
      {
        version: "v2.3.1",
        date: "4 days ago",
        changes: ["Fixed sync issues", "Added new property types", "Improved bulk import performance", "Enhanced error handling"]
      }
    ]
  },
  "calendar-agent": {
    id: "calendar-agent",
    name: "Smart Calendar Agent",
    description: "Intelligent scheduling and calendar management with conflict resolution and meeting optimization.",
    fullDescription: "An AI-powered calendar agent that handles scheduling, meeting optimization, and conflict resolution automatically. Features smart scheduling suggestions, timezone handling, and integration with popular calendar platforms.",
    iconName: "calendar",
    iconBg: "bg-[#d0ec1a]",
    type: "Agent",
    author: "Alex Rivera",
    authorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-02.svg", "/badge-04.svg", "/badge-01.svg"],
    installs: 5670,
    updatedAt: "2 days ago",
    monthlyActiveUsers: "11.8k",
    screenshots: [
      "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1553028826-f4804a6dfd3f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Smart Scheduling", description: "AI-powered meeting scheduling", icon: "cpu" },
      { name: "Conflict Resolution", description: "Automatic conflict detection and resolution", icon: "alert-triangle" },
      { name: "Timezone Support", description: "Global timezone handling", icon: "globe" },
      { name: "Multi-Platform", description: "Works with Google, Outlook, Apple", icon: "link" }
    ],
    pricing: {
      type: "per-call",
      description: "Pay per scheduling operation with volume discounts for frequent users.",
      plans: [
        { name: "Basic", price: "$0.25", unit: "per operation", features: ["Basic scheduling", "Conflict detection", "Up to 50 operations/month"] },
        { name: "Pro", price: "$0.15", unit: "per operation", features: ["Advanced AI scheduling", "Unlimited operations", "Priority processing", "Analytics"] },
        { name: "Enterprise", price: "$0.08", unit: "per operation", features: ["All Pro features", "Custom integrations", "Team management", "Dedicated support"] }
      ]
    },
    changelog: [
      {
        version: "v1.7.2",
        date: "2 days ago",
        changes: ["Improved timezone detection", "Added recurring event support", "Fixed scheduling conflicts", "Enhanced meeting optimization"]
      }
    ]
  },
  // Famous agents from discover page
  "famous1": {
    id: "famous1",
    name: "Website Content Crawler",
    description: "Crawl websites and extract text with advanced parsing capabilities.",
    fullDescription: "A powerful web crawler that can extract content from any website while respecting robots.txt and rate limits. Perfect for data collection and AI training.",
    iconName: "globe",
    iconBg: "bg-blue-400",
    type: "Agent",
    author: "Sarah Chen",
    authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-03.svg"],
    installs: 4200,
    updatedAt: "3 days ago",
    monthlyActiveUsers: "9.1k",
    screenshots: [
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Smart Parsing", description: "AI-powered content extraction", icon: "cpu" },
      { name: "Rate Limiting", description: "Respectful crawling with delays", icon: "clock" },
      { name: "Format Preservation", description: "Maintains original formatting", icon: "file-text" },
      { name: "Bulk Processing", description: "Crawl multiple URLs efficiently", icon: "zap" }
    ],
    pricing: {
      type: "per-call",
      description: "Pay per website crawled with volume discounts for frequent users.",
      plans: [
        { name: "Basic", price: "$0.10", unit: "per page", features: ["Standard crawling", "Basic extraction", "Up to 100 pages/day"] },
        { name: "Pro", price: "$0.05", unit: "per page", features: ["Advanced parsing", "Unlimited pages", "Priority processing"] }
      ]
    },
    changelog: [
      {
        version: "v2.1.0",
        date: "3 days ago",
        changes: ["Improved parsing accuracy", "Added JavaScript rendering", "Fixed timeout issues"]
      }
    ]
  },
  "famous2": {
    id: "famous2",
    name: "Email Assistant",
    description: "Automated email management with smart responses and classification.",
    fullDescription: "An intelligent email assistant that can automatically handle your inbox, classify emails, generate responses, and manage your email workflow efficiently.",
    iconName: "mail",
    iconBg: "bg-blue-400",
    type: "Agent",
    author: "Mike Johnson",
    authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-04.svg"],
    installs: 2800,
    updatedAt: "1 week ago",
    monthlyActiveUsers: "6.3k",
    screenshots: [
      "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Auto Classification", description: "Automatically categorize emails", icon: "tag" },
      { name: "Smart Responses", description: "AI-generated email responses", icon: "message-circle" },
      { name: "Priority Management", description: "Intelligent email prioritization", icon: "star" },
      { name: "Multi-Account", description: "Manage multiple email accounts", icon: "mail" }
    ],
    pricing: {
      type: "subscription",
      description: "Monthly subscription for unlimited email processing.",
      plans: [
        { name: "Personal", price: "$9.99", unit: "per month", features: ["Up to 1,000 emails/month", "Basic templates", "Standard support"] },
        { name: "Pro", price: "$29.99", unit: "per month", features: ["Unlimited emails", "Custom templates", "Priority support"] }
      ]
    },
    changelog: [
      {
        version: "v1.3.0",
        date: "1 week ago",
        changes: ["Added multi-account support", "Improved response quality", "Enhanced security"]
      }
    ]
  },
  "famous3": {
    id: "famous3",
    name: "Calendar Manager",
    description: "Smart scheduling assistant with AI-powered optimization.",
    fullDescription: "A comprehensive calendar management tool that uses AI to optimize your schedule, detect conflicts, and suggest the best meeting times across multiple calendars and time zones.",
    iconName: "calendar",
    iconBg: "bg-blue-400",
    type: "Agent",
    author: "Alex Rivera",
    authorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-02.svg", "/badge-01.svg"],
    installs: 3400,
    updatedAt: "5 days ago",
    monthlyActiveUsers: "7.8k",
    screenshots: [
      "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1553028826-f4804a6dfd3f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "AI Scheduling", description: "Smart meeting time suggestions", icon: "cpu" },
      { name: "Conflict Detection", description: "Automatic scheduling conflict resolution", icon: "alert-triangle" },
      { name: "Multi-Calendar", description: "Sync across multiple calendar platforms", icon: "calendar" },
      { name: "Time Zone Support", description: "Global timezone handling", icon: "globe" }
    ],
    pricing: {
      type: "per-call",
      description: "Pay per scheduling operation with discounts for bulk usage.",
      plans: [
        { name: "Basic", price: "$0.20", unit: "per operation", features: ["Basic scheduling", "Conflict detection", "Standard support"] },
        { name: "Pro", price: "$0.12", unit: "per operation", features: ["AI optimization", "Unlimited operations", "Priority support"] }
      ]
    },
    changelog: [
      {
        version: "v1.4.1",
        date: "5 days ago",
        changes: ["Enhanced AI scheduling algorithm", "Fixed timezone bugs", "Improved conflict resolution"]
      }
    ]
  },
  "famous4": {
    id: "famous4",
    name: "Data Analyzer",
    description: "Advanced data processing and analysis with AI insights.",
    fullDescription: "A powerful data analysis tool that can process large datasets, generate insights, create visualizations, and provide AI-powered recommendations for business intelligence.",
    iconName: "chart",
    iconBg: "bg-blue-400",
    type: "Agent",
    author: "Data Corp",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-01.svg"],
    installs: 5200,
    updatedAt: "1 week ago",
    monthlyActiveUsers: "12.1k",
    screenshots: [
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Data Processing", description: "Process large datasets efficiently", icon: "cpu" },
      { name: "AI Insights", description: "Generate intelligent data insights", icon: "lightbulb" },
      { name: "Visualizations", description: "Create charts and graphs", icon: "chart" },
      { name: "Export Options", description: "Multiple export formats", icon: "download" }
    ],
    pricing: {
      type: "per-call",
      description: "Pay per data analysis operation with volume pricing.",
      plans: [
        { name: "Starter", price: "$0.15", unit: "per analysis", features: ["Basic analysis", "Standard charts", "CSV export"] },
        { name: "Professional", price: "$0.08", unit: "per analysis", features: ["Advanced analysis", "Custom visualizations", "Multiple formats"] }
      ]
    },
    changelog: [
      {
        version: "v2.0.1",
        date: "1 week ago",
        changes: ["Improved processing speed", "New chart types", "Enhanced AI insights"]
      }
    ]
  },
  "famous5": {
    id: "famous5",
    name: "Content Generator",
    description: "AI-powered content creation for marketing and documentation.",
    fullDescription: "A versatile content generation tool that creates high-quality written content for blogs, marketing materials, documentation, and social media using advanced AI models.",
    iconName: "edit",
    iconBg: "bg-blue-400",
    type: "Agent",
    author: "Content AI",
    authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-03.svg", "/badge-01.svg"],
    installs: 7800,
    updatedAt: "2 days ago",
    monthlyActiveUsers: "15.2k",
    screenshots: [
      "https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Multi-Format", description: "Generate content in various formats", icon: "file-text" },
      { name: "SEO Optimized", description: "Built-in SEO optimization", icon: "search" },
      { name: "Brand Voice", description: "Maintain consistent brand voice", icon: "mic" },
      { name: "Bulk Generation", description: "Create multiple pieces at once", icon: "copy" }
    ],
    pricing: {
      type: "subscription",
      description: "Monthly subscription for unlimited content generation.",
      plans: [
        { name: "Creator", price: "$19.99", unit: "per month", features: ["100 articles/month", "Basic templates", "Standard support"] },
        { name: "Business", price: "$49.99", unit: "per month", features: ["Unlimited content", "Custom templates", "Priority support", "Team collaboration"] }
      ]
    },
    changelog: [
      {
        version: "v1.8.0",
        date: "2 days ago",
        changes: ["New content templates", "Improved AI quality", "Added SEO suggestions"]
      }
    ]
  },
  "famous6": {
    id: "famous6",
    name: "Task Automator",
    description: "Workflow automation tool for repetitive tasks.",
    fullDescription: "Automate repetitive tasks and workflows with this powerful automation engine. Create complex workflows, schedule tasks, and integrate with hundreds of apps and services.",
    iconName: "workflow",
    iconBg: "bg-blue-400",
    type: "Tool",
    author: "Automation Inc",
    authorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-04.svg", "/badge-02.svg"],
    installs: 6100,
    updatedAt: "4 days ago",
    monthlyActiveUsers: "13.7k",
    screenshots: [
      "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Workflow Builder", description: "Visual workflow creation", icon: "workflow" },
      { name: "Scheduling", description: "Time-based task execution", icon: "clock" },
      { name: "Integrations", description: "Connect with 500+ apps", icon: "link" },
      { name: "Monitoring", description: "Real-time workflow monitoring", icon: "activity" }
    ],
    pricing: {
      type: "subscription",
      description: "Monthly subscription for unlimited workflow automation.",
      plans: [
        { name: "Starter", price: "$14.99", unit: "per month", features: ["5 workflows", "Basic integrations", "Standard support"] },
        { name: "Pro", price: "$39.99", unit: "per month", features: ["Unlimited workflows", "All integrations", "Priority support", "Advanced monitoring"] }
      ]
    },
    changelog: [
      {
        version: "v3.1.2",
        date: "4 days ago",
        changes: ["New workflow templates", "Improved error handling", "Added monitoring dashboard"]
      }
    ]
  },
  "famous7": {
    id: "famous7",
    name: "Document Parser",
    description: "Extract data from documents with AI-powered parsing.",
    fullDescription: "An advanced document parsing tool that can extract structured data from PDFs, Word documents, images, and other file formats using OCR and AI technologies.",
    iconName: "file-text",
    iconBg: "bg-blue-400",
    type: "Tool",
    author: "Parse AI",
    authorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-01.svg", "/badge-03.svg"],
    installs: 4900,
    updatedAt: "6 days ago",
    monthlyActiveUsers: "11.4k",
    screenshots: [
      "https://images.unsplash.com/photo-1434626881859-194d67b2b86f?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "OCR Technology", description: "Advanced optical character recognition", icon: "eye" },
      { name: "Multi-Format", description: "Support for PDF, Word, images", icon: "file" },
      { name: "Data Extraction", description: "Extract structured data", icon: "database" },
      { name: "Batch Processing", description: "Process multiple documents", icon: "copy" }
    ],
    pricing: {
      type: "per-call",
      description: "Pay per document processed with bulk discounts available.",
      plans: [
        { name: "Basic", price: "$0.50", unit: "per document", features: ["Standard OCR", "Basic extraction", "Up to 50 docs/day"] },
        { name: "Advanced", price: "$0.25", unit: "per document", features: ["Premium OCR", "Advanced extraction", "Unlimited processing"] }
      ]
    },
    changelog: [
      {
        version: "v2.5.0",
        date: "6 days ago",
        changes: ["Improved OCR accuracy", "Added new file formats", "Enhanced data extraction"]
      }
    ]
  },
  "famous8": {
    id: "famous8",
    name: "Social Media Manager",
    description: "Manage social media posts across multiple platforms.",
    fullDescription: "A comprehensive social media management tool that helps you schedule posts, analyze engagement, manage multiple accounts, and optimize your social media strategy.",
    iconName: "share",
    iconBg: "bg-blue-400",
    type: "Agent",
    author: "Social AI",
    authorImage: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-02.svg", "/badge-04.svg"],
    installs: 8200,
    updatedAt: "3 days ago",
    monthlyActiveUsers: "18.6k",
    screenshots: [
      "https://images.unsplash.com/photo-1557200134-90327ee9fafa?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1596526131083-e8c633c948d2?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "Multi-Platform", description: "Support for all major platforms", icon: "share" },
      { name: "Scheduling", description: "Advanced post scheduling", icon: "clock" },
      { name: "Analytics", description: "Detailed engagement analytics", icon: "chart" },
      { name: "Content Library", description: "Organize your content assets", icon: "folder" }
    ],
    pricing: {
      type: "subscription",
      description: "Monthly subscription for comprehensive social media management.",
      plans: [
        { name: "Personal", price: "$12.99", unit: "per month", features: ["3 accounts", "Basic scheduling", "Standard analytics"] },
        { name: "Business", price: "$39.99", unit: "per month", features: ["Unlimited accounts", "Advanced scheduling", "Detailed analytics", "Team collaboration"] }
      ]
    },
    changelog: [
      {
        version: "v2.2.0",
        date: "3 days ago",
        changes: ["Added Instagram Reels support", "Improved analytics dashboard", "New content templates"]
      }
    ]
  },
  "famous9": {
    id: "famous9",
    name: "Image Processor",
    description: "AI image analysis and editing with advanced features.",
    fullDescription: "A comprehensive image processing tool powered by AI that can analyze, edit, optimize, and transform images for various use cases including e-commerce, marketing, and content creation.",
    iconName: "image",
    iconBg: "bg-blue-400",
    type: "Tool",
    author: "Vision AI",
    authorImage: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
    authorBadges: ["/badge-03.svg", "/badge-04.svg"],
    installs: 9100,
    updatedAt: "2 days ago",
    monthlyActiveUsers: "21.3k",
    screenshots: [
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=600&fit=crop"
    ],
    features: [
      { name: "AI Analysis", description: "Intelligent image analysis and tagging", icon: "cpu" },
      { name: "Batch Processing", description: "Process multiple images at once", icon: "copy" },
      { name: "Format Conversion", description: "Convert between image formats", icon: "refresh-cw" },
      { name: "Optimization", description: "Optimize images for web and mobile", icon: "zap" }
    ],
    pricing: {
      type: "per-call",
      description: "Pay per image processed with volume discounts for bulk operations.",
      plans: [
        { name: "Basic", price: "$0.05", unit: "per image", features: ["Standard processing", "Basic formats", "Up to 1000 images/day"] },
        { name: "Pro", price: "$0.02", unit: "per image", features: ["Advanced processing", "All formats", "Unlimited images", "Priority processing"] }
      ]
    },
    changelog: [
      {
        version: "v1.9.0",
        date: "2 days ago",
        changes: ["New AI models", "Faster processing", "Added WebP support", "Improved batch operations"]
      }
    ]
  }
};

export function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const workspaceLink = useWorkspaceLink();
  
  const item = mockItemData[itemId as keyof typeof mockItemData];
  
  if (!item) {
    return (
      <div className="container mx-auto px-6 py-8 text-center">
        <Icon name="x-circle" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Item Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The item you're looking for doesn't exist or has been removed.
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

  const handleInstall = () => {
    trackEvent("marketplace_install_detail_click", {
      itemId: item.id,
      itemName: item.name,
      itemCategory: "marketplace"
    });
    
    console.log("Installing item:", item.name);
    alert(`Installing ${item.name}... This will be implemented in the next step!`);
  };

  const handleShare = () => {
    console.log("Sharing item:", item.name);
  };

  return (
    <div className="flex flex-col gap-2 p-1 w-full min-h-screen">
      {/* Header - matching PageHeader styling */}
      <div className="flex items-center justify-between px-6 py-2 min-h-[60px]">
        <Link to={workspaceLink("/discover")} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <Icon name="arrow-left" size={20} className="text-muted-foreground opacity-50" />
          <h1 className="text-xl text-foreground font-normal">Back to Discover</h1>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex flex-row gap-2 items-start justify-center max-w-[1200px] mx-auto w-full">
        <div className="flex-1 max-w-[900px] p-4 space-y-12 pb-16">
          {/* Hero Section */}
          <div className="space-y-6">
            <div className="space-y-8">
              {/* App Header */}
              <div className="flex flex-row gap-20 items-center justify-start">
                <div className="flex flex-row gap-4 items-center flex-1">
                  {/* App Icon */}
                  <div className={cn("w-32 h-32 rounded-3xl flex items-center justify-center overflow-hidden", item.iconBg)}>
                    <Icon name={item.iconName} size={64} />
                  </div>
                  
                  {/* App Info */}
                  <div className="flex flex-col gap-2 flex-1">
                    <h1 className="text-xl font-medium text-stone-800">{item.name}</h1>
                    <p className="text-sm text-stone-500 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex flex-row gap-1 items-center">
                  <Button 
                    variant="special" 
                    className="px-8 py-2 rounded-xl text-sm"
                    onClick={handleInstall}
                  >
                    Install app
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="p-2 rounded-xl bg-stone-100"
                    onClick={handleShare}
                  >
                    <Icon name="share-2" size={18} className="text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* Stats Section */}
              <div className="flex flex-row items-center justify-between w-full">
                {/* Author */}
                <div className="flex flex-col gap-2.5 items-center">
                  <div className="flex flex-row gap-1.5 items-center">
                    <img 
                      src={item.authorImage} 
                      alt={item.author}
                      className="w-5 h-5 rounded-full object-cover border border-stone-200"
                    />
                    <span className="text-sm text-stone-800">{item.author}</span>
                    {/* Author badges */}
                    <div className="flex items-center ml-1">
                      {item.authorBadges.map((badge, index) => (
                        <div key={badge} className="flex h-[18px] w-[18px] items-center justify-center -mr-2 last:mr-0 relative">
                          <div className="flex-none rotate-45">
                            <div 
                              className="w-[13px] h-[13px] rounded-sm border-2 border-stone-200"
                              style={{ 
                                backgroundColor: index === 0 ? '#a78bfa' : '#1e40af',
                                zIndex: item.authorBadges.length - index 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Downloads */}
                <div className="flex flex-col gap-2.5 items-center">
                  <Icon name="download" size={18} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-stone-800 font-normal">{item.installs.toLocaleString()}</p>
                    <p className="text-sm text-stone-800 font-normal">installs</p>
                  </div>
                </div>

                {/* Updated */}
                <div className="flex flex-col gap-2.5 items-center">
                  <Icon name="refresh-cw" size={18} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-stone-800 font-normal">Updated</p>
                    <p className="text-sm text-stone-800 font-normal">{item.updatedAt}</p>
                  </div>
                </div>

                {/* Monthly Users */}
                <div className="flex flex-col gap-2.5 items-center">
                  <Icon name="users" size={18} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm text-stone-800 font-normal">{item.monthlyActiveUsers} Monthly</p>
                    <p className="text-sm text-stone-800 font-normal">active users</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Screenshots */}
            <div className="flex flex-row gap-2 overflow-clip">
              {item.screenshots.map((screenshot, index) => (
                <div
                  key={index}
                  className="w-[514px] h-[386px] rounded-[14px] bg-cover bg-center bg-no-repeat shrink-0"
                  style={{ backgroundImage: `url('${screenshot}')` }}
                />
              ))}
            </div>

            {/* Description */}
            <p className="text-sm text-stone-500 leading-relaxed">
              {item.fullDescription}
            </p>
          </div>

          {/* What's Included Section */}
          <div className="space-y-6">
            <h2 className="text-base font-medium text-stone-800">What's included</h2>
            
            <div className="flex flex-wrap gap-2">
              {item.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex flex-row gap-2.5 items-center p-4 border border-stone-200 rounded-2xl w-[430px]"
                >
                  <Icon name={feature.icon} size={16} className="text-muted-foreground" />
                  <span className="text-base font-medium text-stone-800">{feature.name}</span>
                  <span className="text-sm text-stone-500 flex-1">{feature.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs Section */}
          <div className="space-y-6">
            <Tabs defaultValue="pricing" className="w-full">
              <TabsList className="flex w-fit bg-transparent p-0 h-auto border-b border-stone-200">
                <TabsTrigger 
                  value="pricing" 
                  className="px-8 py-2 bg-transparent border-0 border-b-2 border-transparent data-[state=active]:border-b-stone-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-stone-800 rounded-none text-stone-500 hover:text-stone-700 transition-colors"
                >
                  Pricing
                </TabsTrigger>
                <TabsTrigger 
                  value="changelog" 
                  className="px-8 py-2 bg-transparent border-0 border-b-2 border-transparent data-[state=active]:border-b-stone-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-stone-800 rounded-none text-stone-500 hover:text-stone-700 transition-colors"
                >
                  Changelog
                </TabsTrigger>
                <TabsTrigger 
                  value="support" 
                  className="px-8 py-2 bg-transparent border-0 border-b-2 border-transparent data-[state=active]:border-b-stone-800 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-stone-800 rounded-none text-stone-500 hover:text-stone-700 transition-colors"
                >
                  Support
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="pricing" className="space-y-8 mt-8">
                {/* Pricing Header */}
                <div className="space-y-4">
                  <h3 className="text-xl text-stone-800">
                    {item.pricing.type === "free" ? "Free to Use" : 
                     item.pricing.type === "subscription" ? "Subscription Plans" : 
                     "Pay per tool call"}
                  </h3>
                  <p className="text-sm text-stone-500 leading-relaxed max-w-2xl">
                    {item.pricing.description}
                  </p>
                </div>
                
                {/* Pricing Plans */}
                <div className={`grid gap-6 ${item.pricing.plans.length === 1 ? 'grid-cols-1 max-w-md' : item.pricing.plans.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
                  {item.pricing.plans.map((plan, index) => (
                    <div
                      key={index}
                      className={`flex flex-col p-6 border border-stone-200 rounded-2xl hover:border-stone-300 transition-colors ${
                        index === 1 && item.pricing.plans.length === 3 ? 'ring-2 ring-primary ring-opacity-20 border-primary' : ''
                      }`}
                    >
                      {/* Plan Header */}
                      <div className="text-center mb-6">
                        <h4 className="text-lg font-semibold text-stone-800 mb-2">{plan.name}</h4>
                        <div className="flex items-baseline justify-center gap-1 mb-2">
                          <span className="text-3xl font-bold text-stone-800">{plan.price}</span>
                          {plan.unit && <span className="text-sm text-stone-500 ml-1">{plan.unit}</span>}
                        </div>
                        {index === 1 && item.pricing.plans.length === 3 && (
                          <div className="inline-flex items-center px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                            Most Popular
                          </div>
                        )}
                      </div>
                      
                      {/* Features List */}
                      <div className="space-y-3 flex-1">
                        {plan.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="flex items-start gap-3">
                            <Icon name="check" size={16} className="text-green-600 mt-0.5 shrink-0" />
                            <span className="text-sm text-stone-700">{feature}</span>
                          </div>
                        ))}
                      </div>
                      
                      {/* CTA Button */}
                      <div className="mt-6">
                        <Button 
                          className={`w-full ${
                            index === 1 && item.pricing.plans.length === 3 
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                              : 'bg-stone-800 text-white hover:bg-stone-700'
                          }`}
                        >
                          {item.pricing.type === "free" ? "Get Started" : 
                           item.pricing.type === "subscription" ? "Subscribe" : 
                           "Choose Plan"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="changelog" className="space-y-6 mt-8">
                {item.changelog && item.changelog.length > 0 ? (
                  <div className="space-y-6">
                    {item.changelog.map((release, index) => (
                      <div key={index} className="border-l-2 border-primary pl-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={index === 0 ? "default" : "outline"}>{release.version}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {index === 0 ? "Latest • " : ""}{release.date}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {release.changes.map((change, changeIndex) => (
                            <div key={changeIndex} className="flex items-start gap-2">
                              <span className="text-sm text-muted-foreground mt-0.5">•</span>
                              <span className="text-sm text-muted-foreground">{change}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No changelog available yet.
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="support" className="space-y-6 mt-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Support Cards - Left Side */}
                  <div className="space-y-4">
                    <div className="p-4 border border-stone-200 rounded-2xl">
                      <div className="flex items-start gap-3">
                        <Icon name="book" size={24} className="text-primary mt-1" />
                        <div>
                          <h3 className="font-medium mb-1">Documentation</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            Complete guides and API reference for {item.name}
                          </p>
                          <Button size="sm" variant="outline">
                            View Docs
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 border border-stone-200 rounded-2xl">
                      <div className="flex items-start gap-3">
                        <Icon name="help-circle" size={24} className="text-primary mt-1" />
                        <div>
                          <h3 className="font-medium mb-1">Get Help</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            Contact our support team for assistance
                          </p>
                          <Button size="sm" variant="outline">
                            Contact Support
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Builders Ranking - Right Side */}
                  <div className="p-6 border border-stone-200 rounded-2xl">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Icon name="award" size={20} className="text-primary" />
                        <h3 className="font-medium text-stone-800">Top Builders Using This App</h3>
                      </div>
                      
                      <div className="space-y-3">
                        {/* Builder 1 */}
                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                          <div className="flex items-center justify-center w-6 h-6 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                            1
                          </div>
                          <img 
                            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face" 
                            alt="Top builder"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-stone-800">Leandro Borges</p>
                            <p className="text-xs text-stone-500">15 bounties completed</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Icon name="star" size={12} className="text-yellow-500" />
                            <span className="text-xs text-stone-600">4.9</span>
                          </div>
                        </div>

                        {/* Builder 2 */}
                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                          <div className="flex items-center justify-center w-6 h-6 bg-stone-400 text-white text-xs font-bold rounded-full">
                            2
                          </div>
                          <img 
                            src="https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face" 
                            alt="Builder 2"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-stone-800">Sarah Chen</p>
                            <p className="text-xs text-stone-500">12 bounties completed</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Icon name="star" size={12} className="text-yellow-500" />
                            <span className="text-xs text-stone-600">4.8</span>
                          </div>
                        </div>

                        {/* Builder 3 */}
                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                          <div className="flex items-center justify-center w-6 h-6 bg-amber-600 text-white text-xs font-bold rounded-full">
                            3
                          </div>
                          <img 
                            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face" 
                            alt="Builder 3"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-stone-800">Mike Johnson</p>
                            <p className="text-xs text-stone-500">9 bounties completed</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Icon name="star" size={12} className="text-yellow-500" />
                            <span className="text-xs text-stone-600">4.7</span>
                          </div>
                        </div>

                        {/* Builder 4 */}
                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                          <div className="flex items-center justify-center w-6 h-6 bg-stone-300 text-stone-700 text-xs font-bold rounded-full">
                            4
                          </div>
                          <img 
                            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face" 
                            alt="Builder 4"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-stone-800">Alex Rivera</p>
                            <p className="text-xs text-stone-500">7 bounties completed</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Icon name="star" size={12} className="text-yellow-500" />
                            <span className="text-xs text-stone-600">4.6</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-stone-200">
                        <Button size="sm" variant="outline" className="w-full">
                          <Icon name="arrow-right" size={14} className="mr-2" />
                          View All Builders
                        </Button>
                      </div>
                    </div>
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
