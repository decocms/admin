import { useEffect, useMemo } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import { AgentProvider } from "../agent/provider.tsx";
import { ChatInput } from "../chat/chat-input.tsx";
import { OnboardingStepsSidebar } from "./steps-sidebar.tsx";
import { StepCompletionTracker } from "./step-completion-tracker.tsx";
import { useOnboarding } from "./context.tsx";

const STEP_MESSAGES = {
  document: {
    en: "Welcome to deco! I will help you generate a working AI application. Start by telling me what you want to solve, and I will help you create a PRD (Product Requirements Document).",
    pt: "Bem-vindo ao deco! Vou te ajudar a gerar uma aplicação de AI funcional. Comece me contando o que você quer resolver, e vou te ajudar a criar um PRD (Documento de Requisitos do Produto).",
  },
  database: {
    en: "Great! Now let's read your PRD to implement the database tables and sample data.",
    pt: "Ótimo! Agora vamos ler seu PRD para implementar as tabelas do banco de dados e dados de exemplo.",
  },
  view: {
    en: "Perfect! Now let's create your view based on the PRD.",
    pt: "Perfeito! Agora vamos criar sua view baseada no PRD.",
  },
  agent: {
    en: "Excellent! Let's configure the agents that will power your application.",
    pt: "Excelente! Vamos configurar os agentes que vão alimentar sua aplicação.",
  },
  workflow: {
    en: "Almost there! Let's create the workflow to tie everything together.",
    pt: "Quase lá! Vamos criar o workflow para conectar tudo.",
  },
};

function getStepMessage(step: keyof typeof STEP_MESSAGES, userLanguage: "en" | "pt" = "en") {
  return STEP_MESSAGES[step][userLanguage];
}

function OnboardingChat({ initialMessage }: { initialMessage: string }) {
  const threadId = useMemo(() => crypto.randomUUID(), [initialMessage]);

  return (
    <AgentProvider
      key={threadId}
      agentId={WELL_KNOWN_AGENTS.decopilotAgent.id}
      threadId={threadId}
      uiOptions={{
        showThreadTools: false,
        showModelSelector: true,
        showThreadMessages: false,
        showAgentVisibility: false,
        showEditAgent: false,
      }}
    >
      <OnboardingChatContent initialMessage={initialMessage} />
    </AgentProvider>
  );
}

function OnboardingChatContent({ initialMessage }: { initialMessage: string }) {
  const timestamp = useMemo(() => 
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }), 
    []
  );

  return (
    <div className="w-full flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="flex flex-col gap-4 min-w-0 p-4">
          {/* Initial Assistant Message */}
          {initialMessage && (
            <div className="w-full min-w-0 group relative flex items-start gap-4 px-4 text-foreground flex-row">
              <div className="flex flex-col gap-1 min-w-0 w-full items-start max-w-[85%]">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{timestamp}</span>
                </div>
                <div className="w-full min-w-0 rounded-2xl text-base break-words overflow-wrap-anywhere bg-muted/50 p-4">
                  <p className="text-foreground">{initialMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-2">
        <ChatInput />
      </div>
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

