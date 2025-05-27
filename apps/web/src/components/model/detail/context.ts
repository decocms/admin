import type { Model } from "@deco/sdk";
import { createContext, useContext as useContextReact } from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

export const updateModelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  model: z.string().min(1, "Model is required"),
  isEnabled: z.boolean(),
  apiKey: z.string().optional(),
});

export type UpdateModelInput = z.infer<typeof updateModelSchema>;

export interface IContext {
  form: UseFormReturn<UpdateModelInput>;
  model: Model;
  onSubmit: (data: UpdateModelInput) => void;
}

export const Context = createContext<IContext | null>(null);

export const useFormContext = () => {
  const context = useContextReact(Context);

  return context!;
};
