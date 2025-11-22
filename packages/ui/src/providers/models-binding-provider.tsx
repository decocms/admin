import { createContext, useContext, type ReactNode } from "react";

export interface ModelInfo {
  id: string;
  model: string;
  name: string;
  logo?: string | null;
  description?: string | null;
  capabilities?: string[];
  contextWindow?: number | null;
  inputCost?: number | null;
  outputCost?: number | null;
  outputLimit?: number | null;
  provider?: "openai" | "anthropic" | "google" | "xai" | "deepseek" | "openai-compatible" | null;
  endpoint?: {
    url: string;
    method?: string;
    contentType?: string;
    stream?: boolean;
  } | null;
}

export interface MCPConnection {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface ModelsBindingContext {
  models: ModelInfo[];
  selectedModel?: string;
  setSelectedModel: (id: string) => void;
  isLoading: boolean;
  error?: Error | null;
  connection?: MCPConnection;
}

const ModelsBindingContext = createContext<ModelsBindingContext | null>(null);

export interface ModelsBindingProviderProps {
  value: ModelsBindingContext;
  children: ReactNode;
}

export function ModelsBindingProvider({
  value,
  children,
}: ModelsBindingProviderProps) {
  return (
    <ModelsBindingContext.Provider value={value}>
      {children}
    </ModelsBindingContext.Provider>
  );
}

export function useModelsBinding(): ModelsBindingContext {
  const context = useContext(ModelsBindingContext);
  if (!context) {
    throw new Error(
      "useModelsBinding must be used within a ModelsBindingProvider",
    );
  }
  return context;
}
