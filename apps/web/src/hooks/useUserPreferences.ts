import { DEFAULT_REASONING_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./useLocalStorage.ts";

export interface UserPreferences {
  defaultModel: string;
  useOpenRouter: boolean;
}

const USER_PREFERENCES_KEY = "user-preferences";

export function useUserPreferences() {
  const {
    value: preferences,
    update: setPreferences,
  } = useLocalStorage<UserPreferences>({
    key: USER_PREFERENCES_KEY,
    defaultValue: {
      defaultModel: DEFAULT_REASONING_MODEL,
      useOpenRouter: true,
    },
  });

  return {
    preferences,
    setPreferences,
  };
}
