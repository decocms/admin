import { z } from "zod";

// TEST DOMAIN - Change this to test different websites (set to null to disable)
const TEST_DOMAIN = null; // Set to null for production use

const CompanyContextSchema = z.object({
  industry: z.string().optional(),
  description: z.string().optional(),
  services: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  taskSuggestions: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    relevance: z.string(),
    integration: z.string().optional(),
  })).optional(),
});

export type CompanyContext = z.infer<typeof CompanyContextSchema>;

/**
 * Extract company context from website content to generate personalized task suggestions
 */
export async function extractCompanyContext(domain: string): Promise<CompanyContext> {
  try {
    // Use TEST_DOMAIN for testing, or the provided domain
    const testDomain = TEST_DOMAIN ? TEST_DOMAIN : domain;
    console.log(`[extractCompanyContext] Using domain: ${testDomain} (original: ${domain})`);
    
    // Fetch the website
    const url = testDomain.startsWith("http") ? testDomain : `https://${testDomain}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DecoChat/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract text content from HTML
    const textContent = extractTextFromHTML(html);
    
    // Analyze the content to determine industry and services
    const context = analyzeCompanyContent(textContent, testDomain);
    
    // Generate task suggestions based on the context
    const suggestions = generateTaskSuggestions(context);
    
    return {
      ...context,
      taskSuggestions: suggestions,
    };
  } catch (error) {
    console.error("[extractCompanyContext] Error:", error);
    
    // Return default context if extraction fails
    return {
      industry: "Technology",
      description: "A modern company focused on digital innovation",
      taskSuggestions: getDefaultSuggestions(),
    };
  }
}

function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // Extract meta description
  const metaDescMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1] : "";
  
  // Extract title
  const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : "";
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  
  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();
  
  // Combine important parts
  return `${title} ${metaDescription} ${text}`.substring(0, 5000); // Limit to first 5000 chars
}

function analyzeCompanyContent(text: string, domain: string): Omit<CompanyContext, "taskSuggestions"> {
  const lowerText = text.toLowerCase();
  
  // Extract key information from meta tags and structured content
  const metaDescMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  const metaDescription = metaDescMatch ? metaDescMatch[1].toLowerCase() : "";
  
  const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].toLowerCase() : "";
  
  // Combine title, meta description, and first 1000 chars for better context
  const keyContent = `${title} ${metaDescription} ${lowerText.substring(0, 1000)}`;
  
  // Enhanced industry detection with more specific patterns and priorities
  const industryAnalysis = {
    "CMS/E-commerce Platform": {
      patterns: [
        /\b(cms|content management|headless|e-commerce platform|storefront|deco\.cx|shopify alternative)\b/gi,
        /\b(website builder|site builder|no-code|low-code|drag.?drop)\b/gi,
        /\b(commerce platform|online store builder|retail platform|jamstack)\b/gi,
        /\b(react|next\.js|typescript|edge computing|serverless|fast websites)\b/gi,
        /\b(developer.?friendly|api.?first|composable|modular)\b/gi,
      ],
      weight: 3, // Higher weight for more specific matches
    },
    "SaaS Platform": {
      patterns: [
        /\b(saas|software as a service|cloud platform|api platform|developer tools)\b/gi,
        /\b(platform|dashboard|analytics|subscription|enterprise software)\b/gi,
      ],
      weight: 2,
    },
    "E-commerce": {
      patterns: [
        /\b(shop|store|buy|cart|checkout|products?|catalog|retail|merchandise)\b/gi,
        /\b(online shopping|ecommerce|e-commerce|marketplace)\b/gi,
      ],
      weight: 1,
    },
    "Marketing Agency": {
      patterns: [
        /\b(marketing agency|digital agency|advertising agency|creative agency)\b/gi,
        /\b(marketing services|seo services|social media marketing)\b/gi,
      ],
      weight: 2,
    },
    "Web Development": {
      patterns: [
        /\b(web development|web design|frontend|backend|full.?stack)\b/gi,
        /\b(react|next\.js|typescript|javascript|web framework)\b/gi,
      ],
      weight: 2,
    },
    "Finance": {
      patterns: [
        /\b(finance|banking|investment|trading|payment|fintech|cryptocurrency)\b/gi,
      ],
      weight: 1,
    },
    "Healthcare": {
      patterns: [
        /\b(health|medical|patient|doctor|clinic|hospital|wellness|therapy)\b/gi,
      ],
      weight: 1,
    },
    "Education": {
      patterns: [
        /\b(education|learning|course|training|student|teacher|university)\b/gi,
      ],
      weight: 1,
    },
  };
  
  // Calculate weighted scores for each industry
  let bestMatch = "Technology";
  let bestScore = 0;
  
  for (const [industry, config] of Object.entries(industryAnalysis)) {
    let totalScore = 0;
    
    for (const pattern of config.patterns) {
      const matches = keyContent.match(pattern);
      if (matches) {
        totalScore += matches.length * config.weight;
      }
    }
    
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestMatch = industry;
    }
  }
  
  // No hardcoded domain overrides - let AI analysis determine the industry dynamically
  
  // Extract services based on common patterns
  const services: string[] = [];
  
  if (lowerText.includes("customer support") || lowerText.includes("customer service")) {
    services.push("Customer Support");
  }
  if (lowerText.includes("sales") || lowerText.includes("lead")) {
    services.push("Sales");
  }
  if (lowerText.includes("content") || lowerText.includes("blog")) {
    services.push("Content Creation");
  }
  if (lowerText.includes("analytics") || lowerText.includes("reporting")) {
    services.push("Analytics");
  }
  if (lowerText.includes("social media")) {
    services.push("Social Media Management");
  }
  
  // Determine target audience
  let targetAudience = "Businesses";
  if (lowerText.includes("b2b") || lowerText.includes("enterprise")) {
    targetAudience = "Enterprise Businesses";
  } else if (lowerText.includes("b2c") || lowerText.includes("consumer")) {
    targetAudience = "Consumers";
  } else if (lowerText.includes("startup")) {
    targetAudience = "Startups";
  }
  
  // Generate description dynamically based on analysis
  const description = `A ${bestMatch.toLowerCase()} company${services.length > 0 ? ` offering ${services.join(", ").toLowerCase()}` : ""} for ${targetAudience.toLowerCase()}`;
  
  return {
    industry: bestMatch,
    description,
    services,
    targetAudience,
  };
}

function generateTaskSuggestions(context: Omit<CompanyContext, "taskSuggestions">): CompanyContext["taskSuggestions"] {
  const suggestions: CompanyContext["taskSuggestions"] = [];
  
  // Industry-specific suggestions
  const industrySuggestions: Record<string, CompanyContext["taskSuggestions"]> = {
    "Fashion E-commerce": [
      {
        id: "style-advisor",
        title: "Create a Personal Style Advisor",
        description: "AI agent that suggests outfits and styling tips based on customer preferences and body type",
        relevance: "Enhances shopping experience and increases customer satisfaction",
        integration: "Shopify",
      },
      {
        id: "seasonal-collection-curator",
        title: "Build a Seasonal Collection Curator",
        description: "Automatically curate and promote seasonal collections based on trends and weather",
        relevance: "Keeps inventory fresh and drives seasonal sales",
        integration: "Google Sheets",
      },
      {
        id: "size-fit-assistant",
        title: "Set up Size & Fit Assistant",
        description: "Help customers find the right size and fit for their body type",
        relevance: "Reduces returns and improves customer satisfaction",
        integration: "Slack",
      },
      {
        id: "sustainability-tracker",
        title: "Create a Sustainability Impact Tracker",
        description: "Track and communicate the environmental impact of purchases",
        relevance: "Appeals to eco-conscious customers and builds brand loyalty",
        integration: "Google Drive",
      },
    ],
    "CMS/E-commerce Platform": [
      {
        id: "developer-onboarding",
        title: "Create a Developer Onboarding Assistant",
        description: "Guide developers through platform setup and first project creation",
        relevance: "Reduces time-to-value and improves developer experience",
        integration: "GitHub",
      },
      {
        id: "template-recommender",
        title: "Build a Template Recommendation Engine",
        description: "Suggest optimal templates based on business type and requirements",
        relevance: "Helps users get started faster with relevant designs",
        integration: "Google Sheets",
      },
      {
        id: "performance-optimizer",
        title: "Set up Performance Monitoring Agent",
        description: "Monitor site performance and suggest optimizations",
        relevance: "Ensures fast loading times and better user experience",
        integration: "Slack",
      },
      {
        id: "migration-assistant",
        title: "Create a Platform Migration Helper",
        description: "Assist users migrating from other platforms like Shopify or WordPress",
        relevance: "Reduces friction for platform switchers",
        integration: "Google Drive",
      },
    ],
    "E-commerce": [
      {
        id: "product-recommendations",
        title: "Create a Product Recommendation Agent",
        description: "AI agent that suggests products based on customer preferences",
        relevance: "Perfect for increasing sales and customer satisfaction",
        integration: "Shopify",
      },
      {
        id: "inventory-assistant",
        title: "Build an Inventory Management Assistant",
        description: "Track stock levels and automate reordering",
        relevance: "Helps prevent stockouts and optimize inventory",
        integration: "Google Sheets",
      },
      {
        id: "customer-reviews",
        title: "Set up Review Response Automation",
        description: "Automatically respond to customer reviews",
        relevance: "Improves customer engagement and reputation",
        integration: "Slack",
      },
    ],
    "SaaS": [
      {
        id: "onboarding-assistant",
        title: "Create an Onboarding Assistant",
        description: "Guide new users through your platform",
        relevance: "Reduces churn and improves user adoption",
        integration: "Intercom",
      },
      {
        id: "api-docs-helper",
        title: "Build an API Documentation Helper",
        description: "Answer developer questions about your API",
        relevance: "Improves developer experience",
        integration: "GitHub",
      },
      {
        id: "usage-analytics",
        title: "Set up Usage Analytics Reporter",
        description: "Generate insights from user behavior",
        relevance: "Helps identify growth opportunities",
        integration: "Google Sheets",
      },
    ],
    "Marketing": [
      {
        id: "content-creator",
        title: "Create a Content Generation Agent",
        description: "Generate blog posts and social media content",
        relevance: "Scales content production efficiently",
        integration: "WordPress",
      },
      {
        id: "campaign-analyzer",
        title: "Build a Campaign Performance Analyzer",
        description: "Track and optimize marketing campaigns",
        relevance: "Improves ROI on marketing spend",
        integration: "Google Analytics",
      },
      {
        id: "lead-qualifier",
        title: "Set up Lead Qualification Bot",
        description: "Automatically score and qualify leads",
        relevance: "Focuses sales efforts on best prospects",
        integration: "HubSpot",
      },
    ],
  };
  
  // Get industry-specific suggestions or defaults
  const baseSuggestions = industrySuggestions[context.industry || "Technology"] || [
    {
      id: "linkedin-post",
      title: "Create a LinkedIn Post Creator",
      description: "Generate engaging LinkedIn content based on your brand voice",
      relevance: "Builds thought leadership and engagement",
      integration: "Google Sheets",
    },
    {
      id: "customer-support",
      title: "Build a Customer Support Agent",
      description: "Handle customer inquiries with AI-powered responses",
      relevance: "Reduces response time and improves satisfaction",
      integration: "Slack",
    },
    {
      id: "sales-assistant",
      title: "Set up a Sales Assistant",
      description: "Automate lead qualification and follow-ups",
      relevance: "Increases conversion rates",
      integration: "HubSpot",
    },
  ];
  
  return baseSuggestions;
}

function getDefaultSuggestions(): CompanyContext["taskSuggestions"] {
  return [
    {
      id: "linkedin-post",
      title: "Create a LinkedIn Post Creator",
      description: "Generate engaging LinkedIn content based on your brand voice",
      relevance: "Builds thought leadership and engagement",
      integration: "Google Sheets",
    },
    {
      id: "customer-support",
      title: "Build a Customer Support Agent",
      description: "Handle customer inquiries with AI-powered responses",
      relevance: "Reduces response time and improves satisfaction",
      integration: "Slack",
    },
    {
      id: "sales-assistant",
      title: "Set up a Sales Assistant",
      description: "Automate lead qualification and follow-ups",
      relevance: "Increases conversion rates",
      integration: "HubSpot",
    },
  ];
}
