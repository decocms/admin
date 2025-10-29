import {
  PopoverContent,
  Popover,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  useWorkflow,
  useWorkflowStepData,
} from "../../../stores/workflows/hooks.ts";
import { useMemo, useState } from "react";
import { DEFAULT_WORKFLOW_STEP_CONFIG, useUpsertWorkflow } from "@deco/sdk";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useForm } from "react-hook-form";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@deco/ui/components/select.tsx";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@deco/ui/components/collapsible.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

export function StepOptions({ stepName }: { stepName: string }) {
  const step = useWorkflowStepData(stepName);

  const mergedOptions = useMemo(
    () => ({ ...DEFAULT_WORKFLOW_STEP_CONFIG, ...step.options }),
    [step.options],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8 rounded-xl p-0")}
        >
          <Icon name="settings" className="text-muted-foreground" size={20} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2">
        <OptionsForm options={mergedOptions} stepName={stepName} />
      </PopoverContent>
    </Popover>
  );
}

function OptionsForm({
  options,
  stepName,
}: {
  options: typeof DEFAULT_WORKFLOW_STEP_CONFIG;
  stepName: string;
}) {
  const workflow = useWorkflow();
  const { mutateAsync, isPending } = useUpsertWorkflow();

  const handleSave = async (data: typeof DEFAULT_WORKFLOW_STEP_CONFIG) => {
    try {
      await mutateAsync({
        ...workflow,
        steps: workflow.steps.map((step) => {
          if (step.def.name === stepName) {
            return { ...step, options: data };
          }
          return step;
        }),
      });
      form.reset(data);
      toast.success("Options saved successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save options");
    }
  };
  const [isRetriesOpen, setIsRetriesOpen] = useState(true);
  const form = useForm<typeof DEFAULT_WORKFLOW_STEP_CONFIG>({
    defaultValues: options,
  });
  const handleSubmit = (data: typeof DEFAULT_WORKFLOW_STEP_CONFIG) => {
    handleSave(data);
  };

  const backoff = form.watch("retries.backoff");
  const formState = form.formState;
  const isDirty = formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-2">
        <Collapsible open={isRetriesOpen} onOpenChange={setIsRetriesOpen}>
          <div className="flex w-full justify-between items-center">
            <h2 className="text-md font-medium">Retries</h2>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="icon">
                <Icon
                  name="keyboard_arrow_down"
                  className={cn(
                    "text-muted-foreground",
                    !isRetriesOpen && "rotate-180",
                  )}
                  size={20}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-2">
            <FormItem className="flex flex-col gap-1">
              <FormLabel className="uppercase text-xs">Limit</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...form.register("retries.limit", {
                    valueAsNumber: true,
                  })}
                />
              </FormControl>
            </FormItem>
            <FormItem className="flex flex-col gap-1">
              <FormLabel className="uppercase text-xs">Delay</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  {...form.register("retries.delay", {
                    valueAsNumber: true,
                  })}
                />
              </FormControl>
            </FormItem>
            <FormItem className="flex flex-col gap-1">
              <FormLabel className="uppercase text-xs">Backoff</FormLabel>
              <FormControl>
                <Select
                  value={backoff}
                  onValueChange={(value) =>
                    form.setValue(
                      "retries.backoff",
                      value as "constant" | "linear" | "exponential",
                      { shouldDirty: true },
                    )
                  }
                >
                  <SelectTrigger className="bg-background text-foreground w-full">
                    <SelectValue placeholder="Select a backoff type" />
                  </SelectTrigger>
                  <SelectContent className="bg-background text-foreground">
                    <SelectItem value="exponential">Exponential</SelectItem>
                    <SelectItem value="linear">Linear</SelectItem>
                    <SelectItem value="constant">Constant</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          </CollapsibleContent>
        </Collapsible>
        <Separator />
        <FormItem className="flex flex-col gap-1 mt-4">
          <FormLabel className="uppercase text-xs">
            Timeout{" "}
            <small className="text-[10px] text-muted-foreground">
              in milliseconds
            </small>
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              {...form.register("timeout", {
                valueAsNumber: true,
              })}
            />
          </FormControl>
        </FormItem>
        <Button
          className="mt-2 w-full"
          type="submit"
          disabled={isPending || !isDirty}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </form>
    </Form>
  );
}
