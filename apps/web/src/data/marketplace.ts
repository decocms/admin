export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: 'tools' | 'prompts' | 'agents' | 'workflows' | 'views' | 'apps';
  type: 'built-in' | 'community';
  author?: string;
  authorAvatar?: string;
  price: number; // in credits
  rating: number;
  reviewCount: number;
  downloads: number;
  tags: string[];
  icon?: string;
  screenshots?: string[];
  version: string;
  lastUpdated: string;
  featured?: boolean;
  trending?: boolean;
  isInstalled?: boolean;
  shortDescription: string;
  longDescription: string;
  permissions?: string[];
  integrations?: string[];
  subItems?: MarketplaceItem[]; // For apps that contain multiple components
}

export const marketplaceData: MarketplaceItem[] = [
  // BUILT-IN TOOLS
  {
    id: 'extract-colors',
    name: 'Website Color Extractor',
    shortDescription: 'Extract brand colors from any website',
    description: 'Automatically extract and analyze brand colors from websites to create consistent design systems',
    longDescription: 'This powerful tool analyzes websites and extracts their primary brand colors, creating a comprehensive color palette that can be used for design systems, themes, and brand consistency. It uses advanced color analysis algorithms to identify the most important colors from a website\'s visual design.',
    category: 'tools',
    type: 'built-in',
    price: 2,
    rating: 4.8,
    reviewCount: 24,
    downloads: 1205,
    tags: ['design', 'branding', 'colors', 'website'],
    icon: '🎨',
    version: '1.2.0',
    lastUpdated: '2 days ago',
    featured: true,
    permissions: ['web-scraping', 'color-analysis'],
    integrations: ['any-website']
  },
  {
    id: 'company-context',
    name: 'Company Context Analyzer',
    shortDescription: 'Analyze company websites for business insights',
    description: 'Extract industry information, services, and generate personalized task suggestions based on company websites',
    longDescription: 'Analyzes company websites to understand their industry, target audience, services, and business model. Generates personalized AI agent suggestions and task recommendations based on the company\'s specific needs and industry best practices.',
    category: 'tools',
    type: 'built-in',
    price: 3,
    rating: 4.6,
    reviewCount: 18,
    downloads: 892,
    tags: ['business', 'analysis', 'industry', 'recommendations'],
    icon: '🏢',
    version: '1.1.0',
    lastUpdated: '1 week ago',
    permissions: ['web-scraping', 'content-analysis'],
    integrations: ['any-website']
  },

  // COMMUNITY TOOLS
  {
    id: 'shopify-inventory',
    name: 'Shopify Inventory Sync',
    shortDescription: 'Real-time inventory management for Shopify stores',
    description: 'Sync inventory levels across multiple Shopify stores and get low-stock alerts',
    longDescription: 'Keep your inventory in perfect sync across multiple Shopify stores. Get real-time notifications when stock runs low, automatically reorder popular items, and prevent overselling with intelligent stock management.',
    category: 'tools',
    type: 'community',
    author: 'ShopifyExperts',
    authorAvatar: '🛍️',
    price: 5,
    rating: 4.9,
    reviewCount: 156,
    downloads: 3420,
    tags: ['shopify', 'inventory', 'e-commerce', 'automation'],
    icon: '📦',
    version: '2.1.0',
    lastUpdated: '3 days ago',
    trending: true,
    permissions: ['shopify-api', 'inventory-management'],
    integrations: ['Shopify', 'Google Sheets', 'Slack']
  },
  {
    id: 'instagram-analytics',
    name: 'Instagram Analytics Pro',
    shortDescription: 'Advanced Instagram performance analytics',
    description: 'Track engagement, growth, and content performance across Instagram accounts',
    longDescription: 'Comprehensive Instagram analytics tool that provides deep insights into your social media performance. Track follower growth, engagement rates, best posting times, hashtag performance, and competitor analysis.',
    category: 'tools',
    type: 'community',
    author: 'SocialMediaGuru',
    authorAvatar: '📱',
    price: 8,
    rating: 4.7,
    reviewCount: 89,
    downloads: 2156,
    tags: ['instagram', 'analytics', 'social-media', 'marketing'],
    icon: '📊',
    version: '1.5.2',
    lastUpdated: '1 week ago',
    permissions: ['instagram-api', 'analytics'],
    integrations: ['Instagram', 'Google Analytics', 'Slack']
  },
  {
    id: 'notion-crm',
    name: 'Notion CRM Connector',
    shortDescription: 'Transform Notion into a powerful CRM system',
    description: 'Connect your Notion workspace to create automated CRM workflows and customer tracking',
    longDescription: 'Turn your Notion workspace into a fully-featured CRM system. Automatically track customer interactions, manage sales pipelines, and sync data with popular business tools. Perfect for small teams and growing businesses.',
    category: 'tools',
    type: 'community',
    author: 'NotionPro',
    authorAvatar: '📝',
    price: 6,
    rating: 4.5,
    reviewCount: 67,
    downloads: 1834,
    tags: ['notion', 'crm', 'sales', 'productivity'],
    icon: '🤝',
    version: '1.3.1',
    lastUpdated: '5 days ago',
    permissions: ['notion-api', 'crm-management'],
    integrations: ['Notion', 'HubSpot', 'Gmail']
  },

  // AGENTS
  {
    id: 'style-advisor-agent',
    name: 'Personal Style Advisor',
    shortDescription: 'AI fashion consultant for e-commerce',
    description: 'Helps customers find the perfect outfit based on their preferences and body type',
    longDescription: 'An intelligent fashion consultant that analyzes customer preferences, body type, and current trends to provide personalized styling advice. Perfect for fashion e-commerce sites looking to increase customer satisfaction and sales.',
    category: 'agents',
    type: 'community',
    author: 'FashionAI',
    authorAvatar: '👗',
    price: 12,
    rating: 4.8,
    reviewCount: 45,
    downloads: 892,
    tags: ['fashion', 'ai', 'e-commerce', 'personalization'],
    icon: '✨',
    version: '1.0.5',
    lastUpdated: '4 days ago',
    featured: true,
    permissions: ['customer-data', 'product-catalog'],
    integrations: ['Shopify', 'WooCommerce', 'Magento']
  },
  {
    id: 'lead-qualifier',
    name: 'Smart Lead Qualifier',
    shortDescription: 'Automatically qualify and score leads',
    description: 'AI agent that analyzes leads and assigns quality scores based on your criteria',
    longDescription: 'Intelligent lead qualification system that automatically scores and categorizes incoming leads based on your specific criteria. Integrates with popular CRM systems and can be customized for any industry.',
    category: 'agents',
    type: 'community',
    author: 'SalesBoost',
    authorAvatar: '💼',
    price: 15,
    rating: 4.6,
    reviewCount: 78,
    downloads: 1567,
    tags: ['sales', 'leads', 'crm', 'automation'],
    icon: '🎯',
    version: '2.0.1',
    lastUpdated: '1 week ago',
    permissions: ['crm-access', 'lead-scoring'],
    integrations: ['HubSpot', 'Salesforce', 'Pipedrive']
  },

  // WORKFLOWS
  {
    id: 'onboarding-flow',
    name: 'Smart User Onboarding',
    shortDescription: 'Automated user onboarding workflow',
    description: 'Complete onboarding flow that adapts to user behavior and preferences',
    longDescription: 'Intelligent onboarding workflow that adapts to each user\'s needs and behavior. Includes welcome emails, feature tours, progress tracking, and automated follow-ups to ensure maximum user activation.',
    category: 'workflows',
    type: 'community',
    author: 'OnboardingPro',
    authorAvatar: '🚀',
    price: 10,
    rating: 4.9,
    reviewCount: 134,
    downloads: 2890,
    tags: ['onboarding', 'automation', 'user-experience'],
    icon: '🌟',
    version: '1.4.0',
    lastUpdated: '2 days ago',
    trending: true,
    permissions: ['user-management', 'email-automation'],
    integrations: ['Email', 'Analytics', 'User Database']
  },

  // VIEWS
  {
    id: 'analytics-dashboard',
    name: 'Business Analytics Dashboard',
    shortDescription: 'Comprehensive business metrics dashboard',
    description: 'Beautiful dashboard showing key business metrics and performance indicators',
    longDescription: 'A comprehensive analytics dashboard that displays all your key business metrics in one place. Includes revenue tracking, user engagement, conversion rates, and customizable widgets for any business need.',
    category: 'views',
    type: 'community',
    author: 'DashboardMaster',
    authorAvatar: '📈',
    price: 8,
    rating: 4.7,
    reviewCount: 92,
    downloads: 2134,
    tags: ['dashboard', 'analytics', 'business', 'metrics'],
    icon: '📊',
    version: '1.6.0',
    lastUpdated: '3 days ago',
    permissions: ['analytics-data', 'dashboard-creation'],
    integrations: ['Google Analytics', 'Stripe', 'Custom APIs']
  },

  // APPS (Combinations of multiple components)
  {
    id: 'deco-cms',
    name: 'deco.cx CMS',
    shortDescription: 'Modern headless CMS for e-commerce',
    description: 'Complete e-commerce CMS with pages, sections, and loaders for fast online stores',
    longDescription: 'A modern headless CMS built for e-commerce. Create fast, scalable online stores with React and TypeScript. Includes page builder, section library, data loaders, and seamless integrations.',
    category: 'apps',
    type: 'built-in',
    price: 0, // Free
    rating: 4.9,
    reviewCount: 234,
    downloads: 5670,
    tags: ['cms', 'e-commerce', 'headless', 'react', 'typescript'],
    icon: '🏪',
    version: '2.1.0',
    lastUpdated: '1 day ago',
    featured: true,
    permissions: ['page-management', 'content-editing', 'api-access'],
    integrations: ['Shopify', 'Stripe', 'Analytics'],
    subItems: [
      {
        id: 'deco-pages',
        name: 'Pages',
        shortDescription: 'Page management system',
        description: 'Create and manage website pages',
        longDescription: 'Comprehensive page management system for creating and organizing website pages.',
        category: 'views',
        type: 'built-in',
        price: 0,
        rating: 4.8,
        reviewCount: 0,
        downloads: 0,
        tags: ['pages', 'content'],
        version: '2.1.0',
        lastUpdated: '1 day ago'
      },
      {
        id: 'deco-sections',
        name: 'Sections',
        shortDescription: 'Reusable page sections',
        description: 'Library of reusable page sections',
        longDescription: 'Extensive library of pre-built, customizable page sections for rapid website development.',
        category: 'views',
        type: 'built-in',
        price: 0,
        rating: 4.9,
        reviewCount: 0,
        downloads: 0,
        tags: ['sections', 'components'],
        version: '2.1.0',
        lastUpdated: '1 day ago'
      },
      {
        id: 'deco-loaders',
        name: 'Loaders',
        shortDescription: 'Data loading utilities',
        description: 'Efficient data loaders for dynamic content',
        longDescription: 'Powerful data loading utilities for fetching and managing dynamic content from various sources.',
        category: 'tools',
        type: 'built-in',
        price: 0,
        rating: 4.7,
        reviewCount: 0,
        downloads: 0,
        tags: ['data', 'loaders'],
        version: '2.1.0',
        lastUpdated: '1 day ago'
      }
    ]
  },

  // PROMPTS
  {
    id: 'email-templates',
    name: 'Professional Email Templates',
    shortDescription: 'Collection of business email templates',
    description: 'Ready-to-use email templates for various business scenarios',
    longDescription: 'Comprehensive collection of professional email templates covering sales, support, marketing, and internal communications. All templates are customizable and optimized for engagement.',
    category: 'prompts',
    type: 'community',
    author: 'EmailPro',
    authorAvatar: '📧',
    price: 4,
    rating: 4.5,
    reviewCount: 156,
    downloads: 4230,
    tags: ['email', 'templates', 'business', 'communication'],
    icon: '✉️',
    version: '1.8.0',
    lastUpdated: '1 week ago',
    permissions: ['template-access'],
    integrations: ['Email Systems', 'CRM']
  }
];

export const featuredItems = marketplaceData.filter(item => item.featured);
export const trendingItems = marketplaceData.filter(item => item.trending);

export const categories = [
  { id: 'all', name: 'All', icon: '🌟' },
  { id: 'tools', name: 'Tools', icon: '🔧' },
  { id: 'agents', name: 'Agents', icon: '🤖' },
  { id: 'workflows', name: 'Workflows', icon: '⚡' },
  { id: 'views', name: 'Views', icon: '📊' },
  { id: 'prompts', name: 'Prompts', icon: '💬' },
  { id: 'apps', name: 'Apps', icon: '📱' }
];

export const filterOptions = [
  { id: 'all', name: 'All Items' },
  { id: 'built-in', name: 'Built-in' },
  { id: 'community', name: 'Community' },
  { id: 'free', name: 'Free' },
  { id: 'paid', name: 'Paid' }
];
