import { useEffect } from "react";
import { useAgents, usePrompts } from "@deco/sdk";
import { useOnboarding } from "./context.tsx";

/**
 * Component that tracks completion of onboarding steps
 * by monitoring created resources
 */
export function StepCompletionTracker() {
  const { state, completeStep, setCurrentStep } = useOnboarding();
  const { data: prompts } = usePrompts();
  const { data: agents } = useAgents();

  // Track document creation
  useEffect(() => {
    if (state.isActive && state.currentStep === "document" && prompts && prompts.length > 0) {
      // Check if any document was created during onboarding
      const hasDocument = prompts.some((prompt) => {
        const createdAt = new Date(prompt.createdAt);
        const now = new Date();
        const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;
        // Consider documents created in the last 30 minutes
        return diffMinutes < 30;
      });

      if (hasDocument && !state.completedSteps.has("document")) {
        completeStep("document");
        // Move to next step: database
        setTimeout(() => {
          setCurrentStep("database");
        }, 2000);
      }
    }
  }, [prompts, state.isActive, state.currentStep, state.completedSteps]);

  // Track database creation
  // Note: This would need to be implemented with actual database monitoring
  // For now, we'll auto-complete after document is done and user confirms
  useEffect(() => {
    if (
      state.isActive &&
      state.currentStep === "database" &&
      state.completedSteps.has("document")
    ) {
      // In a real implementation, this would check for created database tables
      // For now, we can add a manual trigger or wait for user confirmation
    }
  }, [state]);

  // Track agent creation
  useEffect(() => {
    if (state.isActive && state.currentStep === "agent" && agents && agents.length > 0) {
      const hasAgent = agents.some((agent) => {
        const createdAt = new Date(agent.createdAt);
        const now = new Date();
        const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;
        return diffMinutes < 30;
      });

      if (hasAgent && !state.completedSteps.has("agent")) {
        completeStep("agent");
        // Move to next step: view
        setTimeout(() => {
          setCurrentStep("view");
        }, 2000);
      }
    }
  }, [agents, state.isActive, state.currentStep, state.completedSteps]);

  // This component doesn't render anything
  return null;
}

