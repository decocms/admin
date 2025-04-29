import type { Agent } from "@deco/sdk";

/**
 * TODO: something is weird with the tools set here.
 * There's something off with the innate agents having to have
 * these tools hardcoded in here. Maybe a setup is missing?
 */
export const WELL_KNOWN_AGENTS: Record<string, Agent> = {
  teamAgent: {
    id: "teamAgent",
    name: "Deco Chat",
    avatar:
      "https://assets.decocache.com/webdraw/b010a0b9-d576-4d57-9c3a-b86aee1eca1f/explorer.jpeg",
    description: "I can help you with anything you need.",
    model: "google:gemini-2.5-pro-preview-03-25",
    tools_set: {
      DECO_AGENTS: [
        "DECO_AGENTS_CREATE",
        "DECO_AGENTS_CONFIGURATION",
        "DECO_AGENTS_CONFIGURE",
        "DECO_AGENTS_WHO_AM_I",
      ],
      DECO_INTEGRATIONS: [
        "DECO_INTEGRATIONS_SEARCH",
        "DECO_INTEGRATION_INSTALL",
        "DECO_INTEGRATION_ENABLE",
        "DECO_INTEGRATION_DISABLE",
        "DECO_INTEGRATION_LIST_TOOLS",
      ],
      DECO_WALLET: [
        "DECO_WALLET_PRE_AUTHORIZE_TRANSACTION",
      ],
    },
    views: [],
    instructions: `
    <system>
    You are an assistant on a platform designed to help users accomplish their tasks. Your primary objective is to guide users toward completing what they want to do in the simplest and most helpful way possible.
    
    <task_support>
    When a user describes a goal that depends on third-party systems, check the platform's marketplace for relevant integrations. Only suggest installing or enabling tools after getting the user's explicit confirmation. Once tools are installed, use them to identify which capabilities are available and assist the user accordingly.
    </task_support>
    
    <user_goal_handling>
    Users can have two types of goals:
    <one_time_task>When the user wants to do something once, help them complete the task directly. Do not suggest creating an agent unless the user implies the need for reuse.</one_time_task>
    <repeatable_workflow>When the user wants to set up a solution that can be used repeatedly or by others (e.g., sending emails, analyzing data from spreadsheets), propose creating a specialized agent focused on that purpose. Only proceed after receiving explicit confirmation from the user.</repeatable_workflow>
    
    If the user's intent is unclear, default to handling the request as a one-time task.
    NEVER perform actions without the user's explicit permission. Do not write/install/enable/create anything without the user's explicit permission.
    </user_goal_handling>
    
    <user_assumptions>
    Assume users are non-technical and unfamiliar with the tools or systems needed to complete their goals. Avoid technical jargon. Ask simple, clarifying questions before suggesting a solution to ensure it fits the user's actual need.
    </user_assumptions>
    
    <interaction_guidelines>
    Offer only 1–2 options at a time to avoid overwhelming the user. Focus on one clear action at a time and always request explicit confirmation before proceeding.
    </interaction_guidelines>
    
    <user_consent_rule>
    Never perform actions such as installing tools, enabling services, or creating agents without the user's explicit permission. Always ask for confirmation first.
    </user_consent_rule>
    </system>
    `,
  },
  setupAgent: {
    id: "setupAgent",
    name: "Integration configurator",
    avatar: "https://assets.webdraw.app/uploads/capy-5.png",
    description: "I can help you setting up this integration.",
    model: "google:gemini-2.5-pro-preview-03-25",
    tools_set: {
      DECO_INTEGRATIONS: [
        "DECO_INTEGRATIONS_SEARCH",
        "DECO_INTEGRATION_INSTALL",
        "DECO_INTEGRATION_ENABLE",
        "DECO_INTEGRATION_DISABLE",
        "DECO_INTEGRATION_LIST_TOOLS",
      ],
    },
    views: [],
    instructions: `
    <system>
    You are an assistant on a platform designed to help users accomplish their tasks. Your primary objective is to guide users toward completing what they want to do in the simplest and most helpful way possible.
    </system>
    `,
  },
};

export const NEW_AGENT_TEMPLATE: Omit<Agent, "id"> = {
  name: "Untitled",
  avatar: "https://assets.webdraw.app/uploads/capy-5.png",
  description:
    "Your AI agent is still a blank slate. Give it a role, a goal, or just a cool name to get started.",
  model: "google:gemini-2.5-pro-preview-03-25",
  tools_set: {
    DECO_AGENTS: [
      "DECO_AGENTS_CONFIGURATION",
      "DECO_AGENTS_CONFIGURE",
      "DECO_AGENTS_WHO_AM_I",
    ],
    DECO_INTEGRATIONS: [
      "DECO_INTEGRATIONS_SEARCH",
      "DECO_INTEGRATION_INSTALL",
      "DECO_INTEGRATION_ENABLE",
      "DECO_INTEGRATION_DISABLE",
      "DECO_INTEGRATION_LIST_TOOLS",
    ],
  },
  views: [],
  instructions: "This agent has not been configured yet.",
  max_steps: 10,
  max_tokens: 4096,
  memory: {
    last_messages: 10,
  },
};
