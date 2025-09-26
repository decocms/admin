import type { Prompt } from "@deco/sdk";
import { createContext, useContext as useContextReact } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Blocker } from "react-router";

export interface IContext {
  form: UseFormReturn<Prompt>;
  prompt: Prompt;
  setSelectedPrompt: (prompt: Prompt) => void;
  promptVersion: string | null;
  setPromptVersion: (version: string | null) => void;
  onSubmit: (data: Prompt) => void;
  handleRestoreVersion: () => void;
  handleCancel: () => void;
  handleDiscard: () => void;
  blocker: Blocker;
}

export const Context = createContext<IContext | null>(null);

export const useFormContext = () => {
  const context = useContextReact(Context);

  return context!;
};
