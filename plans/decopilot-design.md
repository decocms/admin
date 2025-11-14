# Multi-Mode AI Coding Editor: Design Document

## Executive Summary

The Multi-Mode AI Coding Editor is a constraint-based system that makes AI assistants more focused and assertive by limiting their capabilities based on the current mode. Instead of giving AI access to everything at once (which leads to hesitation and uncertainty), we divide capabilities into distinct modes: **Ask**, **Design**, **Coding**, and **Explore**.

This document explains how the system works, why it exists, and how users interact with it through various scenarios and workflows.

## The Core Problem

### Why Constraints Matter

When AI assistants have access to too many tools and capabilities simultaneously, they become:
- **Less assertive**: Too many options lead to analysis paralysis
- **More cautious**: Fear of making mistakes with powerful tools
- **Less focused**: Difficulty prioritizing which tools to use
- **Slower**: More time spent deciding than acting

### The Solution: Mode-Based Constraints

By constraining AI to specific modes, we:
- **Increase focus**: AI knows exactly what it can and cannot do
- **Improve assertiveness**: Fewer options mean clearer decisions
- **Enable better workflows**: Natural progression from thinking → designing → coding
- **Give users control**: Clear boundaries for when code is written

## The Four Modes

### 1. Ask Mode (Read-Only)

**Purpose**: Exploration, understanding, and question-answering

**Capabilities**:
- ✅ Read existing tools, workflows, views, and documents
- ✅ Search and explore the codebase
- ✅ Answer questions about how things work
- ✅ Explain concepts and provide guidance
- ❌ Cannot create or modify anything
- ❌ Cannot write code

**When to Use**:
- "How does the authentication system work?"
- "What tools are available for sending emails?"
- "Show me examples of workflow patterns"
- "Explain the difference between tools and workflows"

**User Experience**:
- Mode indicator shows "Ask Mode" in blue
- AI responses are informational and exploratory
- No write operations are possible
- Perfect for learning and understanding before building

### 2. Design Mode (Design Documents Only)

**Purpose**: Planning, specification, and architecture

**Capabilities**:
- ✅ Read existing resources (tools, workflows, views, documents)
- ✅ Create and edit design documents (PRDs, specifications)
- ✅ Identify required integrations from marketplace
- ✅ Break down work into implementation tasks
- ❌ Cannot create tools, workflows, or views
- ❌ Cannot write implementation code

**When to Use**:
- "I want to build a customer onboarding system"
- "Design a workflow for processing invoices"
- "Create a plan for integrating with Stripe"
- "Plan out a dashboard for analytics"

**User Experience**:
- Mode indicator shows "Design Mode" in purple
- AI creates structured design documents
- Documents include required integrations, task breakdowns, and specifications
- Natural next step: Switch to Coding Mode to implement

### 3. Coding Mode (Full Write Access)

**Purpose**: Implementation and code generation

**Capabilities**:
- ✅ Read all resources
- ✅ Create and modify tools
- ✅ Create and modify workflows
- ✅ Create and modify views
- ✅ Install integrations from marketplace
- ❌ Cannot create design documents (use Design Mode for that)

**When to Use**:
- "Implement the customer onboarding system from the design doc"
- "Create a tool for sending emails"
- "Build the invoice processing workflow"
- "Make a dashboard view for analytics"

**User Experience**:
- Mode indicator shows "Coding Mode" in green
- AI actively creates and modifies code
- Can follow design documents step-by-step
- Automatically installs required integrations

### 4. Explore Mode (Code-Based MCP Tool Discovery)

**Purpose**: Efficient exploration and testing of MCP integrations via code execution

**Capabilities**:
- ✅ Execute code in a sandboxed environment
- ✅ Call MCP integration tools via code (not direct tool calls)
- ✅ Discover tools on-demand by exploring filesystem/code structure
- ✅ Test integrations without creating permanent resources
- ✅ Filter and transform data in code before returning to model
- ✅ Maintain state across code executions
- ❌ Cannot create permanent tools, workflows, or views
- ❌ Cannot modify existing resources

**When to Use**:
- "Explore what the SendGrid integration can do"
- "Test the Salesforce API with some sample data"
- "Show me how to use the Google Drive integration"
- "What tools are available in the Stripe integration?"
- "Try calling the email integration with different parameters"

**User Experience**:
- Mode indicator shows "Explore Mode" in orange/amber
- AI writes and executes code to interact with MCP tools
- Tools are discovered progressively (not all loaded upfront)
- Code execution happens in isolated sandbox
- Results can be filtered/transformed before showing to user
- Perfect for learning integrations before building with them

**Key Innovation**: 
Instead of loading all tool definitions into context (which can consume 100,000+ tokens), Explore Mode presents MCP tools as code APIs that the agent discovers on-demand. This reduces token usage by 98%+ while enabling more efficient exploration.

## How Mode Switching Works

### Automatic Mode Detection

Before processing each user message, the system:

1. **Analyzes the user's intent** using a lightweight LLM call
2. **Determines the appropriate mode** based on:
   - The user's question or request
   - The current conversation context
   - The current mode (to avoid unnecessary switches)
3. **Checks if mode change is needed**
   - If same mode: Proceed immediately
   - If different mode: Request user confirmation

### Mode Decision Examples

**Example 1: Staying in Ask Mode**
```
User: "What integrations are available?"
Current Mode: Ask
Decision: Ask (no change needed)
Action: Proceed immediately
```

**Example 2: Switching to Design Mode**
```
User: "I want to build a customer support system"
Current Mode: Ask
Decision: Design (mode change needed)
Action: Show confirmation dialog
```

**Example 3: Switching to Coding Mode**
```
User: "Implement the customer support system from the design doc"
Current Mode: Design
Decision: Coding (mode change needed)
Action: Show confirmation dialog
```

**Example 4: Switching to Explore Mode**
```
User: "Show me how the SendGrid integration works"
Current Mode: Ask
Decision: Explore (mode change needed)
Action: Show confirmation dialog
```

### User Confirmation Flow

When AI wants to switch modes:

1. **Dialog appears** with:
   - Proposed new mode
   - AI's reasoning for the switch
   - Confidence level (0-100%)
2. **User options**:
   - ✅ **Confirm**: Switch to new mode and proceed
   - ❌ **Reject**: Stay in current mode, AI adapts response
3. **If confirmed**: Mode switches, tools are filtered, AI proceeds
4. **If rejected**: AI responds within current mode constraints

### Smart Mode Suggestions

The system can suggest mode switches proactively:

- User asks "how do I..." → Suggest Design Mode
- User mentions "implement" or "build" → Suggest Coding Mode
- User asks questions → Suggest Ask Mode
- User wants to "test" or "explore" an integration → Suggest Explore Mode
- Design doc is complete → Suggest switching to Coding Mode
- User wants to understand an integration → Suggest Explore Mode

## User Flows

### Flow 1: Learning and Exploration (Ask Mode)

**Scenario**: User is new to the platform and wants to understand how it works

```
1. User opens chat (defaults to Ask Mode)
2. User: "What are tools and how do they work?"
3. AI (Ask Mode): Explains tools, shows examples, reads existing tools
4. User: "Show me a workflow example"
5. AI (Ask Mode): Reads and explains a workflow
6. User: "How do I create my own tool?"
7. AI (Ask Mode): Explains the process, suggests switching to Design Mode
8. [Mode switch dialog appears]
9. User confirms → Switches to Design Mode
```

**Key Points**:
- Safe exploration without risk of accidental changes
- AI can read and explain everything
- Natural progression to Design Mode when ready to build

### Flow 2: Design-First Workflow

**Scenario**: User wants to build a complex feature and needs to plan first

```
1. User: "I need a system to track customer orders"
2. [Mode decision: Design Mode]
3. User confirms mode switch
4. AI (Design Mode):
   - Asks clarifying questions
   - Reads existing order-related tools
   - Identifies required integrations (e.g., payment, shipping)
   - Creates design document with:
     * Required integrations list
     * Tool specifications
     * Workflow design
     * View requirements
     * Implementation task list
5. User reviews design document
6. User: "This looks good, let's implement it"
7. [Mode decision: Coding Mode]
8. User confirms
9. AI (Coding Mode):
   - Reads the design document
   - Installs required integrations
   - Creates tools (one by one, following task list)
   - Creates workflows
   - Creates views
   - Updates design doc with implementation notes
```

**Key Points**:
- Clear separation between planning and implementation
- Design document serves as blueprint
- Coding mode follows design step-by-step
- Integrations installed automatically

### Flow 3: Quick Implementation (Direct to Coding)

**Scenario**: User knows exactly what they want and wants to build it immediately

```
1. User: "Create a tool that sends a welcome email"
2. [Mode decision: Coding Mode]
3. User confirms
4. AI (Coding Mode):
   - Checks if email integration exists
   - If not, installs it
   - Creates the tool with proper schema
   - Tests the tool
5. User: "Now create a workflow that uses this tool"
6. AI (Coding Mode): Creates workflow that calls the tool
```

**Key Points**:
- Can skip design phase for simple tasks
- AI still follows best practices
- Integrations installed on-demand

### Flow 4: Iterative Refinement

**Scenario**: User wants to improve existing code

```
1. User: "Show me the customer onboarding workflow"
2. AI (Ask Mode): Reads and displays workflow
3. User: "Add email notifications to it"
4. [Mode decision: Coding Mode]
5. User confirms
6. AI (Coding Mode):
   - Reads current workflow
   - Adds email notification step
   - Updates workflow
7. User: "What other workflows use this tool?"
8. [Mode decision: Ask Mode]
9. AI (Ask Mode): Searches and lists workflows using the tool
```

**Key Points**:
- Can switch between modes fluidly
- Ask Mode for understanding, Coding Mode for changes
- Mode switches are contextual and helpful

### Flow 5: Integration Exploration (Explore Mode)

**Scenario**: User wants to understand and test an integration before using it

```
1. User: "I want to use SendGrid for emails, show me how it works"
2. [Mode decision: Explore Mode]
3. User confirms
4. AI (Explore Mode):
   - Discovers SendGrid integration tools via filesystem/code exploration
   - Loads only relevant tool definitions (not all at once)
   - Writes code to test the integration:
     * Lists available SendGrid tools
     * Tests sending a sample email
     * Shows response structure
   - Executes code in sandbox
   - Returns filtered results (only what's relevant)
5. User: "Now create a tool that uses SendGrid"
6. [Mode decision: Coding Mode]
7. User confirms
8. AI (Coding Mode): Creates tool using knowledge from exploration
```

**Key Points**:
- Efficient exploration without loading all tool definitions
- Code execution allows testing and filtering
- Natural progression from Explore → Coding
- Token-efficient (98%+ reduction vs loading all tools)

### Flow 6: Large Dataset Exploration

**Scenario**: User needs to explore a large dataset efficiently

```
1. User: "Show me pending orders from the database"
2. [Mode decision: Explore Mode]
3. User confirms
4. AI (Explore Mode):
   - Writes code to query database integration
   - Filters results in code (only pending orders)
   - Transforms data (only relevant fields)
   - Returns summary + sample rows
   - Code: `const orders = await db.query({ status: 'pending' }); 
            const summary = { total: orders.length, ... };
            console.log(summary);
            console.log(orders.slice(0, 5));`
5. User sees: Summary + 5 sample rows (not 10,000 rows in context)
```

**Key Points**:
- Data filtering happens in code execution environment
- Model only sees processed results, not raw data
- Massive token savings for large datasets
- Privacy-preserving (sensitive data stays in sandbox)

## Design-to-Code Workflow

### The Complete Journey

This is the most powerful workflow, showing how Design Mode and Coding Mode work together:

#### Phase 1: Design (Design Mode)

**User**: "I want to build a customer feedback system"

**AI (Design Mode) Actions**:
1. Asks clarifying questions:
   - "What types of feedback do you want to collect?"
   - "Do you need email notifications?"
   - "Should feedback be public or private?"
2. Explores existing resources:
   - Reads existing feedback-related tools
   - Checks available integrations
   - Reviews similar systems
3. Creates design document with:
   - **Executive Summary**: Problem, solution, goals
   - **Required Integrations**:
     - `i:email` (for notifications)
     - `i:database` (for storing feedback)
   - **Tool Specifications**:
     - `FEEDBACK_CREATE`: Create new feedback
     - `FEEDBACK_LIST`: List feedback with filters
     - `FEEDBACK_UPDATE`: Update feedback status
   - **Workflow Design**:
     - Feedback submission workflow
     - Notification workflow
   - **View Specifications**:
     - Feedback form view
     - Feedback dashboard view
   - **Implementation Tasks** (ordered):
     1. Install email integration
     2. Install database integration
     3. Create FEEDBACK_CREATE tool
     4. Create FEEDBACK_LIST tool
     5. Create FEEDBACK_UPDATE tool
     6. Create feedback submission workflow
     7. Create notification workflow
     8. Create feedback form view
     9. Create feedback dashboard view

#### Phase 2: Integration Installation (Automatic)

When switching to Coding Mode, the system:
1. Reads the design document
2. Identifies required integrations
3. Checks which are already installed
4. Installs missing integrations automatically
5. Verifies installation before proceeding

#### Phase 3: Implementation (Coding Mode)

**User**: "Implement this design"

**AI (Coding Mode) Actions**:
1. Reads the design document
2. Follows implementation tasks in order:
   - **Task 1-2**: Install integrations (automatic)
   - **Task 3**: Create FEEDBACK_CREATE tool
     - Generates code with proper schema
     - Uses installed integrations
     - Tests the tool
     - Updates design doc: "✅ Task 3 completed"
   - **Task 4**: Create FEEDBACK_LIST tool
     - Follows same pattern
   - **Task 5**: Create FEEDBACK_UPDATE tool
   - **Task 6**: Create feedback submission workflow
     - Uses created tools
     - Follows workflow patterns
   - **Task 7**: Create notification workflow
   - **Task 8**: Create feedback form view
     - React component with form
     - Uses callTool() to submit feedback
   - **Task 9**: Create feedback dashboard view
     - Displays feedback list
     - Filtering and sorting
3. Updates design document with:
   - Implementation notes
   - Any deviations from original plan
   - Testing results
   - Next steps or improvements

## Use Cases

### Use Case 1: New Developer Onboarding

**User**: New team member learning the platform

**Flow**:
1. Starts in Ask Mode
2. Asks questions about concepts
3. Explores existing code
4. Gradually builds understanding
5. When ready, switches to Design Mode for first project

**Benefits**:
- Safe exploration without breaking things
- Clear learning path
- Natural progression to building

### Use Case 2: Feature Planning Session

**User**: Product manager planning a new feature

**Flow**:
1. Switches to Design Mode
2. Describes feature requirements
3. AI creates comprehensive design document
4. Team reviews design
5. When approved, switches to Coding Mode
6. Developer implements from design

**Benefits**:
- Clear separation of planning and implementation
- Design document serves as contract
- Implementation follows plan

### Use Case 3: Quick Prototyping

**User**: Developer wants to test an idea quickly

**Flow**:
1. Directly switches to Coding Mode
2. Describes what they want
3. AI creates minimal viable implementation
4. User tests and iterates
5. Can switch to Design Mode later for proper planning

**Benefits**:
- Fast iteration
- No overhead for simple tasks
- Can formalize later if needed

### Use Case 4: Code Review and Understanding

**User**: Developer reviewing existing code

**Flow**:
1. Uses Ask Mode to explore codebase
2. Asks specific questions about implementations
3. AI reads and explains code
4. If changes needed, switches to Coding Mode
5. Makes targeted improvements

**Benefits**:
- Safe exploration before changes
- Clear understanding before modification
- Contextual mode switching

### Use Case 5: Integration Discovery

**User**: Developer needs to find the right integration

**Flow**:
1. Ask Mode: "What integrations can send emails?"
2. AI lists available email integrations
3. Explore Mode: "Show me how to use the SendGrid integration"
4. AI (Explore Mode): Tests SendGrid via code, shows examples
5. Design Mode: "Design a system using SendGrid"
6. Coding Mode: Implements the system

**Benefits**:
- Discovery phase separate from implementation
- Clear understanding before building
- Natural workflow progression
- Efficient exploration without token bloat

### Use Case 6: Integration Testing and Learning

**User**: Developer wants to test an integration before committing to it

**Flow**:
1. Explore Mode: "Test the Stripe payment integration"
2. AI (Explore Mode):
   - Discovers Stripe tools via code exploration
   - Writes test code to create a payment intent
   - Executes in sandbox (no real charges)
   - Shows response structure and capabilities
3. User reviews results
4. If satisfied: Switch to Coding Mode to build with it
5. If not: Try different integration

**Benefits**:
- Safe testing without creating permanent resources
- Efficient exploration (only loads needed tools)
- Clear understanding of integration capabilities
- Can test multiple integrations quickly

## Mode Indicators and UI

### Visual Indicators

**Mode Badge**: Always visible in chat interface
- **Ask Mode**: Blue badge with "Ask Mode"
- **Design Mode**: Purple badge with "Design Mode"
- **Coding Mode**: Green badge with "Coding Mode"
- **Explore Mode**: Orange/Amber badge with "Explore Mode"

**Tool Availability Indicator**: Shows what AI can do
- "Read-only mode" for Ask Mode
- "Design documents only" for Design Mode
- "Full write access" for Coding Mode
- "Code execution with MCP tools" for Explore Mode

### Mode Switch Dialog

When mode change is needed:
- **Modal dialog** appears
- Shows current mode → proposed mode
- Displays AI's reasoning
- Shows confidence level
- Two buttons: "Keep Current Mode" | "Switch Mode"

### Contextual Hints

AI can suggest mode switches:
- "To create this, I'll need to switch to Coding Mode. Should I proceed?"
- "This sounds like a planning task. Would you like to switch to Design Mode?"
- "I can only read in Ask Mode. Switch to Coding Mode to make changes?"
- "To test this integration efficiently, I can switch to Explore Mode. Should I proceed?"

## Edge Cases and Special Scenarios

### Scenario 1: Ambiguous Request

**User**: "I want to improve the login system"

**Handling**:
- AI asks clarifying questions in current mode
- "Do you want me to explain how it works (Ask Mode) or modify it (Coding Mode)?"
- User clarifies, mode decision is made

### Scenario 2: Multi-Step Request

**User**: "Design and implement a payment system"

**Handling**:
- AI suggests: "I'll start in Design Mode to plan, then we can switch to Coding Mode to implement"
- User confirms
- Design phase completes
- AI suggests switching to Coding Mode
- Implementation follows

### Scenario 3: Mode Switch Rejection

**User**: Rejects mode switch from Ask → Coding

**Handling**:
- AI stays in Ask Mode
- Responds: "I can explain how to do this, but I can't make changes in Ask Mode. Would you like me to describe the steps, or switch to Coding Mode to implement?"
- User decides next action

### Scenario 4: Design Document References

**User in Coding Mode**: "Follow the design doc for customer onboarding"

**Handling**:
- AI reads the design document
- Identifies required integrations
- Installs them automatically
- Follows implementation tasks in order
- Updates task status as it progresses

### Scenario 5: Large Dataset Handling

**User in Explore Mode**: "Show me all customer orders"

**Handling**:
- AI writes code to query orders
- Filters/aggregates in code execution environment
- Returns summary + sample rows
- Full dataset never enters model context
- Token-efficient and privacy-preserving

## Benefits of This System

### For Users

1. **Clear Boundaries**: Know exactly what AI can do in each mode
2. **Safe Exploration**: Ask Mode lets you learn without risk
3. **Efficient Integration Testing**: Explore Mode enables testing without token bloat
4. **Structured Workflow**: Design → Code flow is natural and organized
5. **Control**: You decide when code is written
6. **Better Results**: Focused AI produces better outputs
7. **Cost Efficiency**: Explore Mode reduces token usage by 98%+ when working with many tools

### For AI

1. **Less Confusion**: Clear constraints reduce decision paralysis
2. **More Assertive**: Fewer options mean faster, clearer decisions
3. **Better Focus**: Each mode has specific purpose
4. **Improved Quality**: Focused capabilities lead to better outputs
5. **Token Efficiency**: Explore Mode loads tools on-demand instead of all upfront
6. **Better Tool Discovery**: Code-based exploration is more natural for LLMs

### For the Platform

1. **Better UX**: Clearer interactions, less confusion
2. **Reduced Errors**: Constraints prevent inappropriate actions
3. **Natural Workflows**: Design → Code is intuitive
4. **Scalability**: Easy to add new modes or capabilities
5. **Cost Reduction**: Explore Mode dramatically reduces token costs
6. **Privacy**: Sensitive data can stay in code execution environment

## How Explore Mode Works: Code Execution with MCP

### The Problem Explore Mode Solves

Traditional MCP clients load all tool definitions upfront into the model's context window. With hundreds or thousands of tools across dozens of MCP servers, this can consume 100,000+ tokens before the model even reads the user's request. Additionally, intermediate tool results must pass through the model, further increasing token usage.

### The Solution: Code-Based Tool Discovery

Explore Mode presents MCP tools as code APIs rather than direct tool calls. The agent discovers tools by exploring a filesystem-like structure or code tree, loading only the tools it needs for the current task.

### Tool Discovery Pattern

Instead of loading all tools:
```
TOOL: gdrive.getDocument
TOOL: gdrive.getSheet
TOOL: salesforce.updateRecord
... (hundreds more)
```

Explore Mode uses a filesystem structure:
```
servers/
├── google-drive/
│   ├── getDocument.ts
│   ├── getSheet.ts
│   └── index.ts
├── salesforce/
│   ├── updateRecord.ts
│   └── index.ts
└── ...
```

The agent explores this structure on-demand:
1. Lists `servers/` directory to find available integrations
2. Reads specific tool files it needs (e.g., `getDocument.ts`)
3. Understands the interface from the code
4. Writes code to call the tool

### Benefits of Code Execution

**1. Progressive Disclosure**
- Tools loaded on-demand, not all upfront
- Reduces initial token load from 150,000 to ~2,000 tokens (98.7% reduction)

**2. Context-Efficient Results**
- Large datasets filtered/transformed in code before reaching model
- Example: Query 10,000 rows → filter to 5 relevant rows → model sees only 5

**3. More Powerful Control Flow**
- Loops, conditionals, error handling in code
- Single code execution vs. multiple tool call rounds
- Example: Poll for deployment notification in a loop

**4. Privacy-Preserving Operations**
- Sensitive data stays in execution environment
- Model only sees what's explicitly logged/returned
- Can tokenize PII automatically before model sees it

**5. State Persistence**
- Code can write intermediate results to files
- Enables resuming work and tracking progress
- Agents can build reusable "skills" over time

### Example: Explore Mode in Action

**User**: "Test the SendGrid email integration"

**AI (Explore Mode)**:
```typescript
// Discovers SendGrid tools by exploring filesystem
import * as sendgrid from './servers/sendgrid';

// Tests the integration
const result = await sendgrid.sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  body: 'This is a test'
});

console.log('Email sent successfully');
console.log('Response:', { 
  messageId: result.messageId,
  status: result.status 
});
```

**Result**: User sees only the relevant output, not the full tool definition or raw API response.

### Security Considerations

Explore Mode requires:
- **Sandboxed execution environment**: Isolated from main system
- **Resource limits**: CPU, memory, execution time
- **Monitoring**: Track what code is executed
- **Access control**: Only allow access to approved integrations

These infrastructure requirements add operational overhead, but the benefits (98%+ token reduction, better tool composition, privacy) outweigh the costs.

## Future Enhancements

### Potential Additional Modes

- **Review Mode**: Code review and suggestions only
- **Debug Mode**: Focused on troubleshooting and fixing
- **Test Mode**: Creating and running tests
- **Documentation Mode**: Writing and updating docs

### Enhanced Mode Intelligence

- Learn from user patterns to suggest better mode switches
- Remember preferred modes for different types of tasks
- Context-aware mode suggestions based on time of day, project phase, etc.

### Mode Combinations

- **Hybrid Modes**: Limited combinations (e.g., "Design + Ask" for planning with exploration)
- **Mode Sequences**: Predefined workflows (e.g., "Design → Review → Code")

## Conclusion

The Multi-Mode AI Coding Editor creates a more focused, assertive, and user-friendly AI assistant by constraining capabilities into distinct modes. This design document outlines how the system works, why it exists, and how users interact with it through various scenarios.

The key insights are:

1. **Constraints enable better AI behavior** - By limiting what AI can do in each mode, we make it more decisive, focused, and effective.

2. **Code execution with MCP is transformative** - Explore Mode demonstrates that presenting tools as code APIs rather than direct tool calls reduces token usage by 98%+ while enabling more efficient exploration and testing.

3. **Natural workflow progression** - The flow from Ask → Explore → Design → Code provides a clear path from learning to testing to planning to implementation.

4. **Mode-based constraints scale** - As the number of connected tools grows, mode-based constraints become even more valuable, preventing context window bloat and decision paralysis.

---

**Document Status**: Design Phase
**Last Updated**: [Current Date]
**Next Steps**: Implementation planning and technical specification

