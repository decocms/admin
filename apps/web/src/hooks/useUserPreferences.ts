import { DEFAULT_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./useLocalStorage.ts";

export interface UserPreferences {
  defaultModel: string;
  useOpenRouter: boolean;
  smoothStream: boolean;
}

const USER_PREFERENCES_KEY = "user-preferences";

export function useUserPreferences() {
  const {
    value: preferences,
    update: setPreferences,
  } = useLocalStorage<UserPreferences>({
    key: USER_PREFERENCES_KEY,
    defaultValue: {
      defaultModel: DEFAULT_MODEL.id,
      useOpenRouter: true,
      smoothStream: true,
    },
  });

  return {
    preferences,
    setPreferences,
  };
}
