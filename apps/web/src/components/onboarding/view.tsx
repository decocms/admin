import { useEffect, useMemo } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import { AgentProvider } from "../agent/provider.tsx";
import { MainChat } from "../agent/chat.tsx";
import { OnboardingStepsSidebar } from "./steps-sidebar.tsx";
import { StepCompletionTracker } from "./step-completion-tracker.tsx";
import { useOnboarding } from "./context.tsx";
import { useDecopilotContext } from "../decopilot/context.tsx";
import { useAppAdditionalTools } from "../decopilot/use-app-additional-tools.ts";

const STEP_MESSAGES = {
  document: {
    en: "Welcome to deco! I will help you generate a working AI application. Start by telling me what you want to solve, and I will help you create a PRD (Product Requirements Document).",
    pt: "Bem-vindo ao deco! Vou te ajudar a gerar uma aplicação de AI funcional. Comece me contando o que você quer resolver, e vou te ajudar a criar um PRD (Documento de Requisitos do Produto).",
  },
  database: {
    en: "Great! Now let's read your PRD to implement the database tables and sample data.",
    pt: "Ótimo! Agora vamos ler seu PRD para implementar as tabelas do banco de dados e dados de exemplo.",
  },
  agent: {
    en: "Perfect! Now let's create an agent that can take input and transform it into structured data for your tables.",
    pt: "Perfeito! Agora vamos criar um agente que pode receber entrada e transformá-la em dados estruturados para suas tabelas.",
  },
  view: {
    en: "Excellent! Let's create your view to display the entities from your database.",
    pt: "Excelente! Vamos criar sua view para exibir as entidades do seu banco de dados.",
  },
  workflow: {
    en: "Almost there! Let's create the workflow to automate data collection and use your agent to fill your tables.",
    pt: "Quase lá! Vamos criar o workflow para automatizar a coleta de dados e usar seu agente para preencher suas tabelas.",
  },
};

function getStepMessage(step: keyof typeof STEP_MESSAGES, userLanguage: "en" | "pt" = "en") {
  return STEP_MESSAGES[step][userLanguage];
}

function OnboardingChat({ initialMessage }: { initialMessage: string }) {
  const threadId = useMemo(() => crypto.randomUUID(), [initialMessage]);
  const appAdditionalTools = useAppAdditionalTools();
  const {
    additionalTools: contextTools,
    rules,
    onToolCall,
  } = useDecopilotContext();

  // Merge all additional tools
  const allAdditionalTools = {
    ...appAdditionalTools,
    ...contextTools,
  };

  // Create onboarding-specific rules
  const onboardingRules = useMemo(() => {
    const baseRules = rules || [];
    const stepRules = [
      "You are helping a user through the onboarding process to create their first AI application.",
      `Current step guidance: ${initialMessage}`,
      "Guide them step by step, and help them create the necessary components using the available tools.",
    ];
    return [...baseRules, ...stepRules];
  }, [rules, initialMessage]);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Floating instruction banner - centered vertically */}
      {initialMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 max-w-lg w-full px-4">
          <div className="bg-background/80 border border-primary/20 rounded-xl p-4 shadow-lg backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg">👋</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-foreground">{initialMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat area */}
      <AgentProvider
        key={threadId}
        agentId={WELL_KNOWN_AGENTS.decopilotAgent.id}
        threadId={threadId}
        additionalTools={allAdditionalTools}
        initialRules={onboardingRules}
        onToolCall={onToolCall}
        uiOptions={{
          showThreadTools: false,
          showModelSelector: true,
          showThreadMessages: false,
          showAgentVisibility: false,
          showEditAgent: false,
        }}
      >
        <MainChat showInput={true} initialScrollBehavior="bottom" />
      </AgentProvider>
    </div>
  );
}

export function OnboardingView() {
  const { state, startOnboarding } = useOnboarding();
  const navigateWorkspace = useNavigateWorkspace();

  // Detect user language from browser
  const userLanguage = (navigator.language.startsWith("pt") ? "pt" : "en") as "en" | "pt";

  // Start onboarding when component mounts
  useEffect(() => {
    if (!state.isActive) {
      startOnboarding();
    }
  }, []);

  // Get the initial assistant message based on current step
  const initialMessage = state.isActive 
    ? getStepMessage(state.currentStep, userLanguage)
    : "";

  return (
    <div className="flex h-full">
      <StepCompletionTracker />
      <OnboardingStepsSidebar />
      <div className="flex-1">
        <OnboardingChat 
          key={state.currentStep} 
          initialMessage={initialMessage}
        />
      </div>
    </div>
  );
}

