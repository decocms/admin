import { type Integration } from "@deco/sdk";
import { UseMutationResult } from "@tanstack/react-query";
import { createContext, useContext as useContextReact } from "react";
import { UseFormReturn } from "react-hook-form";

export interface IContext {
  form: UseFormReturn<Integration>;
  integration: Integration;
  updateIntegration: UseMutationResult<Integration, Error, Integration>;
}

export const Context = createContext<IContext | null>(null);

export const useFormContext = () => {
  const context = useContextReact(Context);

  return context!;
};
