import {
  AgentNotFoundError,
  useAgent,
  useMessages,
  WELL_KNOWN_AGENT_IDS
} from "@deco/sdk";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { Chat as ChatUI } from "./Chat.tsx";

function Chat(
  { agentId, threadId, panels }: {
    agentId: string;
    threadId: string;
    panels: string[];
  },
) {
  const { data: messages } = useMessages(agentId, threadId);
  const { data: agent } = useAgent(agentId);

  return (
    <ChatUI
      initialMessages={messages}
      threadId={threadId}
      agent={agent}
      panels={panels}
    />
  );
}

function AgentNotFound(
  { agentId, threadId, panels }: {
    agentId: string;
    threadId: string;
    panels: string[];
  },
) {
  const { data: messages } = useMessages(agentId, threadId);

  return (
    <ChatUI initialMessages={messages} threadId={threadId} panels={panels} />
  );
}

const TEAM_AGENT = {
  id: WELL_KNOWN_AGENT_IDS.teamAgent,
  name: "Deco Chat",
  avatar: "https://deco.chat/logos/team-agent.png",
  description: "I can help you with anything you need.",
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
};

export default function AgentChat(
  { agentId, threadId, panels }: {
    agentId: string;
    threadId: string;
    panels: string[];
  },
) {
  return (
    <ErrorBoundary
      shouldCatch={(error) => error instanceof AgentNotFoundError}
      fallback={
        <AgentNotFound agentId={agentId} threadId={threadId} panels={panels} />
      }
    >
      <Chat agentId={agentId} threadId={threadId} panels={panels} />
    </ErrorBoundary>
  );
}
