import { DEFAULT_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./use-local-storage.ts";

export interface UserPreferences {
  useOpenRouter: boolean;
  sendReasoning: boolean;
  defaultModel: string;
  showDecopilot: boolean;
  pdfSummarization: boolean;
  storeAdminMode: boolean;
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
  storeAdminMode: {
    label: "Store Admin Mode",
    description: "Enable admin features in the Store to manage app visibility.",
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
        sendReasoning: true,
        showDecopilot: false,
        pdfSummarization: true,
        storeAdminMode: false,
      },
    });

  return {
    preferences,
    setPreferences,
  };
}
