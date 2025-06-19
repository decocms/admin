# AI Integration Native Tool Calls

This document describes the new native tool calls for AI integration in deco.chat, which enable workers to process AI tasks while consuming credits from the current workspace.

## Overview

The AI Integration tools provide a special group of native tool calls that allow:

- **AI-driven workflows**: Enable coordination between different AI models for complex tasks
- **Structured data extraction**: Extract structured data from PDFs and other content using AI
- **Credit-based usage**: All operations consume credits from the workspace wallet, just like agent execution
- **Flexible model selection**: Choose from available models or use the default Claude Sonnet 4
- **Custom GUI integration**: Perfect for building custom interfaces that need AI capabilities

## Available Tools

### 1. `AI_GENERATE_TEXT`

Generate text responses using AI with flexible model selection.

**Use Cases:**
- Content generation and summarization
- Text transformation and translation
- Analysis and insights generation
- Custom AI-powered features in applications

**Input Schema:**
```typescript
{
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
    id?: string;
  }>;
  model?: string; // Optional, defaults to "anthropic:claude-sonnet-4"
  instructions?: string; // Additional instructions for the AI
  maxTokens?: number; // Maximum tokens to generate
  maxSteps?: number; // Maximum steps for the AI to take
}
```

**Output Schema:**
```typescript
{
  text: string; // The generated text response
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string; // Reason why generation finished
}
```

**Example Usage:**
```javascript
// Generate a summary of a document
const result = await client.AI_GENERATE_TEXT({
  messages: [
    {
      role: "system",
      content: "You are a helpful assistant that summarizes documents."
    },
    {
      role: "user", 
      content: "Please summarize this PDF content: [PDF_CONTENT_HERE]"
    }
  ],
  model: "anthropic:claude-sonnet-4",
  instructions: "Provide a concise 3-paragraph summary",
  maxTokens: 1000
});

console.log("Summary:", result.text);
console.log("Tokens used:", result.usage.totalTokens);
```

### 2. `AI_GENERATE_OBJECT`

Generate structured objects using AI - perfect for extracting structured data from unstructured content.

**Use Cases:**
- Extract structured data from PDFs, documents, emails
- Convert natural language to structured formats
- Data normalization and transformation
- Form extraction and validation

**Input Schema:**
```typescript
{
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
    id?: string;
  }>;
  schema: JSONSchema7; // JSON Schema for the expected output object
  model?: string; // Optional, defaults to "anthropic:claude-sonnet-4"
  instructions?: string; // Additional instructions for the AI
  maxTokens?: number; // Maximum tokens to generate
  maxSteps?: number; // Maximum steps for the AI to take
}
```

**Output Schema:**
```typescript
{
  object: any; // The generated object matching the provided schema
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string; // Reason why generation finished
}
```

**Example Usage:**
```javascript
// Extract structured data from a PDF invoice
const result = await client.AI_GENERATE_OBJECT({
  messages: [
    {
      role: "system",
      content: "Extract invoice data from the provided text."
    },
    {
      role: "user",
      content: "Extract the following data from this invoice: [PDF_TEXT_HERE]"
    }
  ],
  schema: {
    type: "object",
    properties: {
      invoiceNumber: { type: "string" },
      date: { type: "string", format: "date" },
      vendor: { type: "string" },
      total: { type: "number" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "number" },
            price: { type: "number" }
          },
          required: ["description", "quantity", "price"]
        }
      }
    },
    required: ["invoiceNumber", "date", "vendor", "total", "items"]
  },
  model: "anthropic:claude-sonnet-4"
});

console.log("Extracted data:", result.object);
// Output: { invoiceNumber: "INV-001", date: "2023-12-01", vendor: "Acme Corp", ... }
```

### 3. `AI_LIST_MODELS`

List available AI models that can be used for AI integration tasks.

**Use Cases:**
- Discover available models and their capabilities
- Build dynamic model selection interfaces
- Check model availability and features

**Input Schema:**
```typescript
{}
```

**Output Schema:**
```typescript
{
  models: Array<{
    id: string;
    name: string;
    provider: string;
    capabilities: string[];
    isDefault: boolean;
  }>;
  defaultModel: string;
}
```

**Example Usage:**
```javascript
// Get available models
const result = await client.AI_LIST_MODELS({});

console.log("Available models:", result.models);
console.log("Default model:", result.defaultModel);

// Find models with specific capabilities
const reasoningModels = result.models.filter(model => 
  model.capabilities.includes("reasoning")
);
```

## Integration Patterns

### 1. Custom GUI Integration

Build custom interfaces that leverage AI capabilities:

```javascript
// Custom PDF processing interface
async function processPDF(pdfContent, extractionType) {
  if (extractionType === "summary") {
    return await client.AI_GENERATE_TEXT({
      messages: [
        { role: "user", content: `Summarize this PDF: ${pdfContent}` }
      ]
    });
  } else if (extractionType === "invoice") {
    return await client.AI_GENERATE_OBJECT({
      messages: [
        { role: "user", content: `Extract invoice data: ${pdfContent}` }
      ],
      schema: invoiceSchema
    });
  }
}
```

### 2. Agent Coordination

Use within agents to coordinate complex AI workflows:

```javascript
// Agent using AI integration for sub-tasks
async function coordinatedAnalysis(documents) {
  const summaries = [];
  
  for (const doc of documents) {
    const summary = await client.AI_GENERATE_TEXT({
      messages: [
        { role: "user", content: `Analyze this document: ${doc.content}` }
      ],
      model: "anthropic:claude-sonnet-4"
    });
    summaries.push(summary.text);
  }
  
  // Use another model for final synthesis
  const finalAnalysis = await client.AI_GENERATE_OBJECT({
    messages: [
      { 
        role: "user", 
        content: `Synthesize these analyses: ${summaries.join('\n\n')}` 
      }
    ],
    schema: {
      type: "object",
      properties: {
        mainThemes: { type: "array", items: { type: "string" } },
        recommendations: { type: "array", items: { type: "string" } },
        confidence: { type: "number", minimum: 0, maximum: 1 }
      }
    },
    model: "google:gemini-2.5-pro-preview"
  });
  
  return finalAnalysis.object;
}
```

## Credit System Integration

All AI Integration tools automatically:

- **Check wallet balance** before execution
- **Debit credits** based on actual token usage
- **Use workspace funds** from the current workspace wallet
- **Follow the same pricing** as regular agent execution
- **Provide usage tracking** for cost management

The credit debiting happens automatically and follows the same patterns as agent execution, ensuring consistent billing across all AI operations.

## Default Model

The default model for AI Integration tools is **Claude Sonnet 4** (`anthropic:claude-sonnet-4`), which provides:
- High-quality reasoning capabilities
- Excellent structured data extraction
- Reliable JSON schema adherence
- Cost-effective operation

You can override this by specifying a different model in the `model` parameter of any tool call.

## Error Handling

The tools provide clear error messages for common issues:

- **Insufficient funds**: When workspace wallet has no credits
- **Invalid schema**: When provided JSON schema is malformed
- **Model not available**: When specified model is not accessible
- **Generation errors**: When AI generation fails for any reason

Always wrap tool calls in try-catch blocks and handle errors appropriately:

```javascript
try {
  const result = await client.AI_GENERATE_OBJECT({
    messages: [{ role: "user", content: "Extract data..." }],
    schema: mySchema
  });
  return result.object;
} catch (error) {
  console.error("AI generation failed:", error.message);
  // Handle error appropriately
}
```

## Best Practices

1. **Use appropriate models**: Choose models based on task requirements and cost considerations
2. **Optimize token usage**: Be concise in prompts to minimize costs
3. **Handle errors gracefully**: Always implement proper error handling
4. **Monitor usage**: Track token consumption for cost management
5. **Cache results**: Cache expensive AI operations when possible
6. **Use structured schemas**: For `AI_GENERATE_OBJECT`, provide detailed JSON schemas for better results

## Support

For questions or issues with AI Integration tools, please refer to the deco.chat documentation or contact the development team.