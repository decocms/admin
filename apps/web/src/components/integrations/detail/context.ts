import { type Integration } from "@deco/sdk";
import { createContext, useContext as useContextReact } from "react";
import { UseFormReturn } from "react-hook-form";

export interface IContext {
  form: UseFormReturn<Integration>;
  integration: Integration;
  onSubmit: (data: Integration) => void;
}

export const Context = createContext<IContext | null>(null);

export const useFormContext = () => {
  const context = useContextReact(Context);

  return context!;
};
