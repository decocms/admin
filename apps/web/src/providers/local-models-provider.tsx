import type { Model } from "@deco/sdk";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import {
  discoverOllamaModels,
  getOllamaHost,
  setOllamaHost as saveOllamaHost,
} from "../lib/local-llm/ollama-discovery.ts";

interface LocalModelsContextValue {
  host: string;
  models: Model[];
  isDiscovering: boolean;
  setHost: (url: string) => void;
  refresh: () => Promise<void>;
}

const LocalModelsContext = createContext<LocalModelsContextValue | null>(null);

export function LocalModelsProvider({ children }: PropsWithChildren) {
  const [host, setHostState] = useState(getOllamaHost());
  const [models, setModels] = useState<Model[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  const discover = async () => {
    setIsDiscovering(true);
    try {
      const discovered = await discoverOllamaModels();
      setModels(discovered);
    } catch (error) {
      console.error("Failed to discover local models:", error);
      setModels([]);
    } finally {
      setIsDiscovering(false);
    }
  };

  const setHost = (url: string) => {
    setHostState(url);
    saveOllamaHost(url);
  };

  // Discover on mount and when host changes
  useEffect(() => {
    discover();
  }, [host]);

  const value: LocalModelsContextValue = {
    host,
    models,
    isDiscovering,
    setHost,
    refresh: discover,
  };

  return (
    <LocalModelsContext.Provider value={value}>
      {children}
    </LocalModelsContext.Provider>
  );
}

export function useLocalModels() {
  const context = useContext(LocalModelsContext);
  if (!context) {
    throw new Error("useLocalModels must be used within LocalModelsProvider");
  }
  return context;
}

