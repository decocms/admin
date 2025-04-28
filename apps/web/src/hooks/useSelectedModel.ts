import { DEFAULT_REASONING_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./useLocalStorage.ts";

export function useSelectedModel() {
  return useLocalStorage<string>({
    key: "selected-model",
    defaultValue: DEFAULT_REASONING_MODEL,
    // dealing with strings only
    serializer: (value) => value,
    deserializer: (value) => value,
  });
}
