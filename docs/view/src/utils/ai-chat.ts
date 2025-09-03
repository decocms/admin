// AI Chat integration for documentation
// This connects to the existing deco.chat AI infrastructure

// Since we're in the docs environment, we'll use the API URL directly
const DECO_CHAT_API = "http://localhost:3001"; // This should match your local API

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  message: string;
  sources?: Array<{
    title: string;
    url: string;
    excerpt: string;
  }>;
}

// Create a documentation context for the AI
async function createDocumentationContext(query: string, locale: string): Promise<string> {
  try {
    // Search through documentation to get relevant context
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&locale=${locale}`);
    if (!response.ok) return "";
    
    const data = await response.json();
    const results = data.results || [];
    
    if (results.length === 0) return "";
    
    // Create context from search results
    const context = results.map((result: any) => 
      `**${result.title}** (${result.section})\n${result.content}\nURL: ${result.url}`
    ).join('\n\n');
    
    return `Based on the documentation, here's relevant information:\n\n${context}`;
  } catch (error) {
    console.error("Failed to create documentation context:", error);
    return "";
  }
}

// Send message to AI with documentation context
export async function sendChatMessage(
  messages: ChatMessage[],
  locale: string = "en"
): Promise<ChatResponse> {
  try {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      throw new Error("Last message must be from user");
    }

    // Create documentation context for the user's query
    const docContext = await createDocumentationContext(lastMessage.content, locale);
    
    // For now, provide an intelligent response based on documentation context
    // This can be connected to your existing AI system later
    
    let response = "";
    
    if (docContext) {
      response = `Based on the decoCMS documentation, here's what I found about "${lastMessage.content}":

${docContext}

Is there anything specific about this topic you'd like me to explain further? I can help you understand how to implement these features or troubleshoot any issues you might encounter.`;
    } else {
      // Handle common questions even without specific context
      const query = lastMessage.content.toLowerCase();
      
      if (query.includes("workflow") || query.includes("workflows")) {
        response = `Workflows in decoCMS are multi-step processes that help automate tasks and connect different tools together. While I don't see specific workflow documentation in the search results, here are some general concepts:

1. **What are workflows?** - Automated sequences of actions that can be triggered by events or user input
2. **Common use cases** - Data processing, content management, integration between services
3. **Getting started** - Check the guides section for workflow-related tutorials

Would you like me to help you find more specific information about workflows, or do you have a particular workflow use case in mind?`;
      } else if (query.includes("getting started") || query.includes("setup") || query.includes("install")) {
        response = `To get started with decoCMS, I recommend checking out the "Getting Started" guide in the documentation. This covers:

1. **Installation** - Setting up your development environment
2. **Configuration** - Basic project setup and configuration
3. **First steps** - Creating your first project and understanding the structure

You can find this in the sidebar navigation. Is there a specific part of the setup process you're having trouble with?`;
      } else if (query.includes("cli") || query.includes("command")) {
        response = `The decoCMS CLI provides command-line tools for managing your projects. Check the "CLI Reference" section for:

1. **Available commands** - Complete list of CLI commands and options
2. **Usage examples** - How to use each command effectively
3. **Configuration** - Setting up and configuring the CLI

What specific CLI functionality are you looking to use?`;
      } else {
        response = `I'd be happy to help you with decoCMS! However, I couldn't find specific information about "${lastMessage.content}" in the current documentation search.

Here are some suggestions:
1. **Browse the documentation** - Check the sidebar for relevant sections
2. **Try a more specific search** - Use the search function with specific terms
3. **Check the guides** - Look at the step-by-step guides for common tasks

What specific aspect of decoCMS are you trying to work with? I can help guide you to the right documentation section.`;
      }
    }

    return {
      message: response,
      sources: docContext ? [] : undefined,
    };

  } catch (error) {
    console.error("AI chat error:", error);
    
    // Fallback response
    return {
      message: "I'm sorry, I encountered an error while processing your request. Please try again, or browse the documentation directly using the search function.",
    };
  }
}
