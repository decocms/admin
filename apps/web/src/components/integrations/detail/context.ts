import { type Integration } from "@deco/sdk";
import { createContext, useContext as useContextReact } from "react";
import { UseFormReturn } from "react-hook-form";

export interface IContext {
  form: UseFormReturn<Integration>;
  integration?: Integration;
}

export const Context = createContext<IContext | null>(null);

export const useContext = () => {
  const context = useContextReact(Context);

  return context!;
};
