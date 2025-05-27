import { createContext, useContext as useContextReact } from "react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";

export const createModelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  model: z.string().min(1, "Model is required"),
  apiKey: z.string().min(1, "API Key is required"),
});

export type CreateModelInput = z.infer<typeof createModelSchema>;

export interface IContext {
  form: UseFormReturn<CreateModelInput>;
  onSubmit: (data: CreateModelInput) => void;
}

export const Context = createContext<IContext | null>(null);

export const useFormContext = () => {
  const context = useContextReact(Context);

  return context!;
};
