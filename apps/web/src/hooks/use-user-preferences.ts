import { DEFAULT_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./use-local-storage.ts";

export interface UserPreferences {
  useOpenRouter: boolean;
  smoothStream: boolean;
  sendReasoning: boolean;
  defaultModel: string;
  pdfSummarization: boolean;
  showDecopilot: boolean;
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
  pdfSummarization: {
    label: "Summarize PDFs",
    description:
      "Summarize large PDFs to reduce token usage and enable larger PDF support.",
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
        pdfSummarization: true,
        showDecopilot: false,
      },
    });

  return {
    preferences,
    setPreferences,
  };
}
