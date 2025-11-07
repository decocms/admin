import { DEFAULT_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./use-local-storage.ts";

export interface UserPreferences {
  useOpenRouter: boolean;
  sendReasoning: boolean;
  defaultModel: string;
  showDecopilot: boolean;
  pdfSummarization: boolean;
  showLegacyPrompts?: boolean;
  showLegacyWorkflowRuns?: boolean;
  showLegacyAgents?: boolean;
}

export const userPreferencesLabels = {
  useOpenRouter: {
    label: "Use OpenRouter",
    description: "Improve availability of AI responses.",
  },
  sendReasoning: {
    label: "Send Reasoning",
    description: "Send reasoning to the AI model.",
  },
  showLegacyPrompts: {
    label: "Show Legacy Prompts",
    description: "Show legacy prompts in the documents view.",
  },
  showLegacyWorkflowRuns: {
    label: "Show Legacy Workflow Runs",
    description: "Show legacy workflow runs in the workflows view.",
  },
  showLegacyAgents: {
    label: "Show Legacy Agents",
    description: "Show legacy agents in the agents view.",
  },
};

const USER_PREFERENCES_KEY = "user-preferences";

export function useUserPreferences() {
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>(
    USER_PREFERENCES_KEY,
    (existing) => {
      const defaultValue = {
        defaultModel: DEFAULT_MODEL.id,
        useOpenRouter: true,
        sendReasoning: true,
        showDecopilot: false,
        pdfSummarization: true,
        // Legacy features default to false (hidden) for new users
        showLegacyPrompts: false,
        showLegacyWorkflowRuns: false,
        showLegacyAgents: false,
      };

      if (!existing) {
        return defaultValue;
      }

      // If user has existing preferences, set legacy features to true (show)
      // This handles the case where user already has preferences in localStorage
      const hasExistingPreferences =
        existing.defaultModel !== undefined ||
        existing.useOpenRouter !== undefined ||
        existing.sendReasoning !== undefined;

      if (hasExistingPreferences) {
        return {
          ...existing,
          // Set legacy features to true for existing users
          showLegacyPrompts: existing.showLegacyPrompts ?? true,
          showLegacyWorkflowRuns: existing.showLegacyWorkflowRuns ?? true,
          showLegacyAgents: existing.showLegacyAgents ?? true,
        };
      }

      // New users get the default values (false = hide)
      return { ...defaultValue, ...existing };
    },
  );

  return {
    preferences,
    setPreferences,
  };
}
