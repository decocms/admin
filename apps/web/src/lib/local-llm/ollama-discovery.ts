import type { Model } from "@deco/sdk";

const STORAGE_KEY = "OLLAMA_HOST";
const DEFAULT_HOST = "http://localhost:11434";

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

function isLocalEnvironment(): boolean {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getOllamaHost(): string {
  if (typeof window === "undefined") return DEFAULT_HOST;
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_HOST;
  } catch {
    return DEFAULT_HOST;
  }
}

export function setOllamaHost(url: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch (e) {
    console.warn("Failed to save OLLAMA_HOST to localStorage:", e);
  }
}

const MODEL_LOGOS: Record<string, string> = {
  qwen: "/logos/qwen.png",
  // Add more model family logos as needed
};

function getModelLogo(modelName: string): string {
  const lowerName = modelName.toLowerCase();
  
  // Check each model family
  for (const [family, logo] of Object.entries(MODEL_LOGOS)) {
    if (lowerName.startsWith(family)) {
      return logo;
    }
  }
  
  // Default Ollama logo
  return "https://assets.decocache.com/webdraw/ollama-icon.svg";
}

function formatModelName(tag: string): string {
  // Convert tags like "qwen2.5:7b-instruct" to "Local: Qwen2.5 7B Instruct"
  const parts = tag.split(":");
  const modelName = parts[0];
  const variant = parts[1] || "";
  
  const formattedName = modelName
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  
  const formattedVariant = variant
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  
  return `Local: ${formattedName}${formattedVariant ? ` ${formattedVariant}` : ""}`;
}

export async function discoverOllamaModels(): Promise<Model[]> {
  if (!isLocalEnvironment()) {
    return [];
  }

  const host = getOllamaHost();
  
  try {
    const response = await fetch(`${host}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}`);
    }

    const data: OllamaTagsResponse = await response.json();
    
    return data.models.map((model) => ({
      id: `ollama:${model.name}`,
      model: `ollama:${model.name}`,
      name: formatModelName(model.name),
      logo: getModelLogo(model.name),
      capabilities: [],
      byDeco: false,
      isEnabled: true,
      hasCustomKey: false,
    }));
  } catch (error) {
    console.debug("Failed to discover Ollama models:", error);
    return [];
  }
}

export async function testOllamaConnection(host: string): Promise<boolean> {
  try {
    const response = await fetch(`${host}/api/tags`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

