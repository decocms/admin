import { DEFAULT_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./use-local-storage.ts";

export interface UserPreferences {
  useOpenRouter: boolean;
  smoothStream: boolean;
  sendReasoning: boolean;
  defaultModel: string;
  showDecopilot: boolean;
  pdfSummarization: boolean;
  enableWorkflowRuns: boolean;
}

export const userPreferencesLabels = {
  useOpenRouter: {
    label: "Use OpenRouter",
    description: "Improve availability of AI responses.",
  },
  smoothStream: {
    label: "Smooth Stream",
    description: "Smooth out the stream of AI responses.",
  },
  sendReasoning: {
    label: "Send Reasoning",
    description: "Send reasoning to the AI model.",
  },
  enableWorkflowRuns: {
    label: "Enable Workflow Runs (Beta)",
    description: "Show the new workflow runs tab in workflows section.",
  },
};

const USER_PREFERENCES_KEY = "user-preferences";

export function useUserPreferences() {
  const { value: preferences, update: setPreferences } =
    useLocalStorage<UserPreferences>({
      key: USER_PREFERENCES_KEY,
      defaultValue: {
        defaultModel: DEFAULT_MODEL.id,
        useOpenRouter: true,
        smoothStream: true,
        sendReasoning: true,
        showDecopilot: false,
        pdfSummarization: true,
        enableWorkflowRuns: false,
      },
    });

  return {
    preferences,
    setPreferences,
  };
}
