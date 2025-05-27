import { DEFAULT_MODEL, MODELS, useUpdateModel } from "@deco/sdk";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useState } from "react";
import Logo from "../common/Logo.tsx";
import { useFormContext } from "./context.ts";

export function DetailForm() {
  const {
    onSubmit,
    form,
  } = useFormContext();
  const updateModel = useUpdateModel();
  const [logo, setLogo] = useState("");

  const isMutating = updateModel.isPending;

  return (
    <ScrollArea className="h-full w-full p-6 text-slate-700">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 px-1 max-w-3xl mx-auto"
        >
          <div className="flex items-center gap-6">
            <Logo
              logo={logo}
              name={form.getValues("name")}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My GPT Model"
                      {...field}
                      disabled={isMutating}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief description of the model"
                    className="min-h-[100px]"
                    {...field}
                    disabled={isMutating}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model Identifier</FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    disabled={isMutating}
                    onValueChange={(value) => {
                      field.onChange(value);
                      const logo = MODELS.find((m) => m.model === value)?.logo;
                      if (logo) {
                        setLogo(logo);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS
                        .filter((m) => m.model !== DEFAULT_MODEL)
                        .map((model) => (
                          <SelectItem
                            key={model.model.split(":")[1]}
                            value={model.model}
                          >
                            {model.logo && (
                              <img
                                src={model.logo}
                                alt={model.name}
                                className="w-6 h-6"
                              />
                            )}
                            {model.model.split(":")[1]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>API Key</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    {...field}
                    disabled={isMutating}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </ScrollArea>
  );
}
