export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: 'tools' | 'agents' | 'workflows' | 'views' | 'apps';
  type: 'built-in' | 'community';
  author?: string;
  price: number; // in dollars
  priceUnit: 'free' | 'one-time' | 'per-1m-tokens' | 'monthly';
  downloads: number;
  tags: string[];
  iconName: string; // Material icon name
  version: string;
  lastUpdated: string;
  featured?: boolean;
  trending?: boolean;
  isInstalled?: boolean;
  shortDescription: string;
  longDescription: string;
  integrations?: string[];
  subItems?: MarketplaceItem[]; // For apps that contain multiple components
}

export const marketplaceData: MarketplaceItem[] = [
  // BUILT-IN TOOLS (API calls and functions)
  {
    id: 'extract-colors',
    name: 'Website Color Extractor',
    shortDescription: 'Extract brand colors from any website URL',
    description: 'API call that analyzes a website and returns its primary brand colors as CSS variables',
    longDescription: 'A simple tool that takes a website URL as input and returns extracted brand colors in a structured format. Perfect for automatically theming applications based on a company\'s website.',
    category: 'tools',
    type: 'built-in',
    price: 0.50,
    priceUnit: 'per-1m-tokens',
    downloads: 1205,
    tags: ['web-scraping', 'design', 'colors'],
    iconName: 'palette',
    version: '1.2.0',
    lastUpdated: '2 days ago',
    featured: true,
    integrations: ['HTTP']
  },
  {
    id: 'send-email',
    name: 'Send Email via Gmail',
    shortDescription: 'Send emails through Gmail API',
    description: 'Function to send emails using Gmail API with attachments and formatting support',
    longDescription: 'Send emails programmatically through your Gmail account. Supports HTML formatting, attachments, CC/BCC recipients, and delivery tracking.',
    category: 'tools',
    type: 'built-in',
    price: 0.10,
    priceUnit: 'per-1m-tokens',
    downloads: 3420,
    tags: ['email', 'gmail', 'communication'],
    iconName: 'email',
    version: '2.1.0',
    lastUpdated: '1 week ago',
    integrations: ['Gmail']
  },
  {
    id: 'create-spreadsheet',
    name: 'Create Google Spreadsheet',
    shortDescription: 'Create and populate Google Sheets',
    description: 'API call to create new Google Sheets with data and formatting',
    longDescription: 'Create new Google Spreadsheets programmatically. Can populate with data, apply formatting, create charts, and share with specific users.',
    category: 'tools',
    type: 'built-in',
    price: 0.25,
    priceUnit: 'per-1m-tokens',
    downloads: 2156,
    tags: ['google-sheets', 'data', 'spreadsheet'],
    iconName: 'table_chart',
    version: '1.5.2',
    lastUpdated: '3 days ago',
    integrations: ['Google Sheets']
  },

  // AGENTS (AI assistants with specific capabilities)
  {
    id: 'customer-support-agent',
    name: 'Customer Support Agent',
    shortDescription: 'AI agent that handles customer inquiries and support tickets',
    description: 'Intelligent customer support agent that can answer common questions, escalate complex issues, and maintain context across conversations',
    longDescription: 'A sophisticated AI agent trained to handle customer support interactions. It can answer frequently asked questions, troubleshoot common issues, collect customer information, and escalate complex problems to human agents when needed.',
    category: 'agents',
    type: 'built-in',
    price: 0.75,
    priceUnit: 'per-1m-tokens',
    downloads: 3420,
    tags: ['customer-support', 'ai', 'chat'],
    iconName: 'support_agent',
    version: '2.1.0',
    lastUpdated: '1 week ago',
    featured: true,
    integrations: ['Zendesk', 'Intercom', 'Slack']
  },
  {
    id: 'sales-assistant-agent',
    name: 'Sales Assistant Agent',
    shortDescription: 'AI agent that qualifies leads and assists with sales processes',
    description: 'Smart sales agent that engages prospects, qualifies leads, and guides them through the sales funnel',
    longDescription: 'An AI-powered sales assistant that can engage with prospects, ask qualifying questions, provide product information, schedule meetings, and hand off qualified leads to human sales representatives.',
    category: 'agents',
    type: 'community',
    author: 'SalesAI',
    price: 1.25,
    priceUnit: 'per-1m-tokens',
    downloads: 2156,
    tags: ['sales', 'lead-qualification', 'ai'],
    iconName: 'person_pin',
    version: '1.5.2',
    lastUpdated: '3 days ago',
    integrations: ['HubSpot', 'Salesforce', 'Calendly']
  },
  {
    id: 'content-writer-agent',
    name: 'Content Writing Agent',
    shortDescription: 'AI agent specialized in creating marketing content',
    description: 'Creative AI agent that generates blog posts, social media content, and marketing copy',
    longDescription: 'A specialized content creation agent that can write blog posts, social media content, email campaigns, and marketing copy while maintaining your brand voice and style guidelines.',
    category: 'agents',
    type: 'community',
    author: 'ContentPro',
    price: 0.95,
    priceUnit: 'per-1m-tokens',
    downloads: 1834,
    tags: ['content', 'writing', 'marketing'],
    iconName: 'edit',
    version: '1.3.1',
    lastUpdated: '5 days ago',
    integrations: ['WordPress', 'Buffer', 'Mailchimp']
  },

  // COMMUNITY TOOLS
  {
    id: 'linkedin-profile-extract',
    name: 'LinkedIn Profile Extractor',
    shortDescription: 'Extract and summarize LinkedIn profiles',
    description: 'Scrape LinkedIn profile data and generate structured summaries',
    longDescription: 'Extract comprehensive information from LinkedIn profiles including work experience, education, skills, and connections. Returns structured data perfect for CRM systems.',
    category: 'tools',
    type: 'community',
    author: 'DataScrapers',
    price: 2.00,
    priceUnit: 'per-1m-tokens',
    downloads: 1834,
    tags: ['linkedin', 'scraping', 'profiles'],
    iconName: 'person_search',
    version: '1.3.1',
    lastUpdated: '5 days ago',
    integrations: ['LinkedIn']
  },
  {
    id: 'pdf-text-extract',
    name: 'PDF Text Extractor',
    shortDescription: 'Extract text content from PDF files',
    description: 'API function to extract and parse text from uploaded PDF documents',
    longDescription: 'Upload PDF files and extract clean, structured text content. Handles multi-column layouts, tables, and maintains formatting where possible.',
    category: 'tools',
    type: 'community',
    author: 'PDFTools',
    price: 1.50,
    priceUnit: 'per-1m-tokens',
    downloads: 4230,
    tags: ['pdf', 'text-extraction', 'documents'],
    iconName: 'picture_as_pdf',
    version: '2.0.1',
    lastUpdated: '1 week ago',
    integrations: ['File Upload']
  },

  // WORKFLOWS (Multi-step processes)
  {
    id: 'lead-qualification-flow',
    name: 'Lead Qualification Workflow',
    shortDescription: 'Multi-step lead scoring and routing process',
    description: 'Workflow that enriches leads, scores them, and routes to appropriate sales reps',
    longDescription: 'A comprehensive workflow that takes raw lead data, enriches it with external APIs, applies scoring logic, and automatically routes qualified leads to the right sales representatives.',
    category: 'workflows',
    type: 'community',
    author: 'SalesOps',
    price: 15.00,
    priceUnit: 'monthly',
    downloads: 892,
    tags: ['sales', 'leads', 'automation'],
    iconName: 'account_tree',
    version: '1.0.5',
    lastUpdated: '4 days ago',
    featured: true,
    integrations: ['HubSpot', 'Clearbit', 'Slack']
  },
  {
    id: 'content-approval-workflow',
    name: 'Content Approval Process',
    shortDescription: 'Multi-step content review and approval workflow',
    description: 'Workflow for content creation, review, approval, and publishing',
    longDescription: 'Streamlines content creation from draft to publication. Includes automated review assignments, approval tracking, revision management, and final publishing to multiple channels.',
    category: 'workflows',
    type: 'community',
    author: 'ContentOps',
    price: 25.00,
    priceUnit: 'monthly',
    downloads: 1567,
    tags: ['content', 'approval', 'publishing'],
    iconName: 'approval',
    version: '2.0.1',
    lastUpdated: '1 week ago',
    integrations: ['Google Docs', 'Slack', 'WordPress']
  },
  {
    id: 'customer-onboarding-flow',
    name: 'Customer Onboarding Workflow',
    shortDescription: 'Automated new customer setup process',
    description: 'Multi-step workflow to onboard new customers with personalized touchpoints',
    longDescription: 'Complete customer onboarding process that creates accounts, sends welcome emails, schedules check-ins, and tracks progress through onboarding milestones.',
    category: 'workflows',
    type: 'built-in',
    price: 0,
    priceUnit: 'free',
    downloads: 2890,
    tags: ['onboarding', 'customers', 'automation'],
    iconName: 'rocket_launch',
    version: '1.4.0',
    lastUpdated: '2 days ago',
    trending: true,
    integrations: ['Email', 'CRM', 'Calendar']
  },

  // VIEWS (Custom user interfaces)
  {
    id: 'sales-dashboard',
    name: 'Sales Performance Dashboard',
    shortDescription: 'Real-time sales metrics and KPI dashboard',
    description: 'Interactive dashboard showing sales performance, pipeline, and team metrics',
    longDescription: 'Comprehensive sales dashboard built with React and Tailwind. Displays real-time sales data, pipeline progression, team performance, and customizable KPI widgets.',
    category: 'views',
    type: 'community',
    author: 'DashboardPro',
    price: 49.00,
    priceUnit: 'one-time',
    downloads: 2134,
    tags: ['dashboard', 'sales', 'analytics'],
    iconName: 'dashboard',
    version: '1.6.0',
    lastUpdated: '3 days ago',
    integrations: ['Salesforce', 'HubSpot', 'Stripe']
  },
  {
    id: 'customer-portal',
    name: 'Customer Support Portal',
    shortDescription: 'Self-service customer support interface',
    description: 'Complete customer portal with ticket management and knowledge base',
    longDescription: 'Full-featured customer support portal allowing users to submit tickets, track issues, browse knowledge base articles, and communicate with support teams.',
    category: 'views',
    type: 'community',
    author: 'SupportUI',
    price: 79.00,
    priceUnit: 'one-time',
    downloads: 1456,
    tags: ['support', 'portal', 'customers'],
    iconName: 'support_agent',
    version: '2.1.0',
    lastUpdated: '1 week ago',
    integrations: ['Zendesk', 'Intercom', 'Slack']
  },
  {
    id: 'analytics-view',
    name: 'Business Analytics View',
    shortDescription: 'Customizable business metrics visualization',
    description: 'Interactive charts and graphs for business data visualization',
    longDescription: 'Flexible analytics view with customizable charts, filters, and drill-down capabilities. Perfect for displaying business metrics, user behavior, and performance data.',
    category: 'views',
    type: 'built-in',
    price: 0,
    priceUnit: 'free',
    downloads: 3892,
    tags: ['analytics', 'charts', 'visualization'],
    iconName: 'analytics',
    version: '1.8.0',
    lastUpdated: '5 days ago',
    integrations: ['Google Analytics', 'Custom APIs']
  },

  // APPS (Complete applications with multiple components)
  {
    id: 'deco-cms',
    name: 'deco.cx CMS',
    shortDescription: 'Complete headless CMS for e-commerce',
    description: 'Full e-commerce CMS with page builder, content management, and storefront',
    longDescription: 'A complete headless CMS solution for e-commerce. Includes page management, section library, data loaders, and seamless integrations with popular e-commerce platforms.',
    category: 'apps',
    type: 'built-in',
    price: 0,
    priceUnit: 'free',
    downloads: 5670,
    tags: ['cms', 'e-commerce', 'headless'],
    iconName: 'store',
    version: '2.1.0',
    lastUpdated: '1 day ago',
    featured: true,
    integrations: ['Shopify', 'Stripe', 'Analytics'],
    subItems: [
      {
        id: 'deco-pages',
        name: 'Pages',
        shortDescription: 'Page management system',
        description: 'Create and manage website pages with drag-and-drop builder',
        longDescription: 'Visual page builder for creating and organizing website pages with drag-and-drop functionality.',
        category: 'views',
        type: 'built-in',
        price: 0,
        priceUnit: 'free',
        downloads: 0,
        tags: ['pages', 'builder'],
        iconName: 'web',
        version: '2.1.0',
        lastUpdated: '1 day ago'
      },
      {
        id: 'deco-sections',
        name: 'Sections',
        shortDescription: 'Reusable page sections library',
        description: 'Library of pre-built, customizable page sections and components',
        longDescription: 'Extensive library of pre-built page sections including headers, footers, hero sections, and content blocks.',
        category: 'views',
        type: 'built-in',
        price: 0,
        priceUnit: 'free',
        downloads: 0,
        tags: ['sections', 'components'],
        iconName: 'view_module',
        version: '2.1.0',
        lastUpdated: '1 day ago'
      },
      {
        id: 'deco-loaders',
        name: 'Loaders',
        shortDescription: 'Data loading utilities',
        description: 'Efficient data loaders for fetching content from various sources',
        longDescription: 'Powerful data loading utilities for fetching and managing dynamic content from APIs, databases, and external services.',
        category: 'tools',
        type: 'built-in',
        price: 0,
        priceUnit: 'free',
        downloads: 0,
        tags: ['data', 'loaders', 'api'],
        iconName: 'download',
        version: '2.1.0',
        lastUpdated: '1 day ago'
      }
    ]
  },
  {
    id: 'crm-suite',
    name: 'Customer CRM Suite',
    shortDescription: 'Complete customer relationship management system',
    description: 'Full CRM application with contact management, sales pipeline, and reporting',
    longDescription: 'Complete CRM solution including contact management, deal tracking, sales pipeline, email integration, and comprehensive reporting dashboard.',
    category: 'apps',
    type: 'community',
    author: 'CRMSolutions',
    price: 99.00,
    priceUnit: 'monthly',
    downloads: 1234,
    tags: ['crm', 'sales', 'contacts'],
    iconName: 'business',
    version: '3.2.0',
    lastUpdated: '1 week ago',
    integrations: ['Gmail', 'Calendar', 'Slack']
  }
];

export const featuredItems = marketplaceData.filter(item => item.featured);
export const trendingItems = marketplaceData.filter(item => item.trending);

export const categories = [
  { id: 'all', name: 'All', iconName: 'apps' },
  { id: 'tools', name: 'Tools', iconName: 'build' },
  { id: 'agents', name: 'Agents', iconName: 'smart_toy' },
  { id: 'workflows', name: 'Workflows', iconName: 'account_tree' },
  { id: 'views', name: 'Views', iconName: 'dashboard' },
  { id: 'apps', name: 'Apps', iconName: 'extension' }
];

export const filterOptions = [
  { id: 'all', name: 'All Items' },
  { id: 'built-in', name: 'Built-in' },
  { id: 'community', name: 'Community' },
  { id: 'free', name: 'Free' },
  { id: 'paid', name: 'Paid' }
];