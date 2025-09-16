import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Plus, Sparkles, X } from "lucide-react";
import type { Workflow, WorkflowStep } from "@deco/sdk/mcp/workflows/types";
import { useGenerateWorkflowStep, useIntegrations } from "@deco/sdk";
import { useDebouncedCallback } from "use-debounce";

const stepFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  prompt: z.string().min(10, "Please describe what this step should do"),
});

type StepFormData = z.infer<typeof stepFormSchema>;

interface StepCreatorProps {
  workflow: Workflow;
  editingStep?: WorkflowStep | null;
  onStepCreated: (step: WorkflowStep) => void;
  onCancel: () => void;
}

/**
 * AI-powered step creator with beautiful UX
 * Users describe what they want in natural language
 */
export function StepCreator({
  workflow,
  editingStep,
  onStepCreated,
  onCancel,
}: StepCreatorProps) {
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [suggestedTools, setSuggestedTools] = useState<string[]>([]);
  const [showAutoTools, setShowAutoTools] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: integrations } = useIntegrations();
  const generateStep = useGenerateWorkflowStep();

  const form = useForm<StepFormData>({
    resolver: zodResolver(stepFormSchema),
    defaultValues: {
      title: editingStep?.title || "",
      description: editingStep?.description || "",
      prompt: editingStep?.prompt || "",
    },
  });

  const prompt = form.watch("prompt");

  // TODO: This solution is not future-proof. We need to rely on an agent to
  // dynamically search tools using searchTools without wasting tokens
  const discoverTools = useDebouncedCallback(
    async (text: string) => {
      if (!showAutoTools || text.length < 10) return;

      // Simple keyword matching for now
      // In future, this should call an AI tool discovery service
      const keywords = text.toLowerCase().split(/\s+/);
      const suggested = integrations
        ?.filter((integration) => {
          const name = integration.name.toLowerCase();
          return keywords.some((keyword) => name.includes(keyword));
        })
        .map((i) => i.id.replace(/^[ia]_/, "")) // Clean IDs
        .slice(0, 3) || [];

      setSuggestedTools(suggested);
    },
    3000, // 3 second debounce as specified
  );

  // Watch prompt changes for tool discovery
  useMemo(() => {
    discoverTools(prompt);
  }, [prompt, discoverTools]);

  // Handle @ mentions in prompt
  const handlePromptChange = useCallback(
    (value: string) => {
      // Extract @ mentions
      const mentions = value.match(/@(\w+)/g) || [];
      const mentionedTools = mentions.map((m) => m.slice(1));

      // Add mentioned tools to selected
      const newTools = mentionedTools.filter((t) => !selectedTools.includes(t));
      if (newTools.length > 0) {
        setSelectedTools([...selectedTools, ...newTools]);
      }
    },
    [selectedTools],
  );

  const onSubmit = async (data: StepFormData) => {
    setIsGenerating(true);

    try {
      // Get previous steps for context
      const previousSteps = workflow.steps.slice(0, -1).map((s) => ({
        id: s.id,
        title: s.title,
        outputSchema: s.outputSchema,
      }));

      // Generate step code using AI
      const generatedStep = await generateStep.mutateAsync({
        prompt: data.prompt,
        selectedTools,
        previousSteps,
      });

      // Create the complete step
      const newStep: WorkflowStep = {
        id: editingStep?.id || `step-${Date.now()}`,
        title: data.title,
        description: data.description || "",
        prompt: data.prompt,
        code: generatedStep.code,
        inputSchema: generatedStep.inputSchema,
        outputSchema: generatedStep.outputSchema,
        usedTools: generatedStep.usedTools || [],
        config: {
          retry: 3,
          timeout: 30000,
        },
      };

      onStepCreated(newStep);
    } catch (error) {
      console.error("Failed to generate step:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const availableTools = useMemo(() => {
    return (
      integrations
        ?.filter((i) => !i.id.startsWith("a_")) // Filter out agents for now
        .map((i) => ({
          id: i.id.replace(/^[ia]_/, ""),
          name: i.name,
          icon: i.icon,
        })) || []
    );
  }, [integrations]);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {editingStep ? "Edit Step" : "Create New Step"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title field */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">Step Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Send Welcome Email"
                      className="h-12 text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">
                    Description (optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief description of what this step does"
                      className="h-12 text-base"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Prompt field - the main input */}
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg">
                    What should this step do?
                  </FormLabel>
                  <FormDescription className="text-base">
                    Describe in plain English. Use @ to mention tools (e.g.,
                    @gmail, @sheets)
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        handlePromptChange(e.target.value);
                      }}
                      placeholder="Get the user data from the previous step and send them a welcome email with their name and account details..."
                      className="min-h-[150px] text-base leading-relaxed resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                  <div className="text-sm text-gray-500 mt-2">
                    {field.value?.length || 0} characters
                  </div>
                </FormItem>
              )}
            />

            {/* Tool selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-lg">Available Tools</FormLabel>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-gray-600">Auto-discover</span>
                  <Switch
                    checked={showAutoTools}
                    onCheckedChange={setShowAutoTools}
                  />
                </label>
              </div>

              {/* Suggested tools */}
              {showAutoTools && suggestedTools.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Suggested tools:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedTools.map((toolId) => {
                      const tool = availableTools.find((t) => t.id === toolId);
                      if (!tool) return null;

                      return (
                        <Badge
                          key={tool.id}
                          variant={selectedTools.includes(tool.id)
                            ? "default"
                            : "outline"}
                          className="cursor-pointer"
                          onClick={() => {
                            if (selectedTools.includes(tool.id)) {
                              setSelectedTools(
                                selectedTools.filter((t) => t !== tool.id),
                              );
                            } else {
                              setSelectedTools([...selectedTools, tool.id]);
                            }
                          }}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          {tool.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected tools */}
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Selected tools:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTools.map((toolId) => {
                    const tool = availableTools.find((t) => t.id === toolId);
                    if (!tool) return null;

                    return (
                      <Badge
                        key={tool.id}
                        variant="default"
                        className="cursor-pointer"
                      >
                        {tool.name}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTools(
                              selectedTools.filter((t) => t !== tool.id),
                            )}
                          className="ml-2"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    );
                  })}

                  {/* Add tool manually button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6"
                    onClick={() => {
                      // TODO: Open tool selector dialog
                      console.log("Open tool selector");
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add tool
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isGenerating || !form.formState.isValid}
                className="min-w-[120px]"
              >
                {isGenerating
                  ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      Generating...
                    </>
                  )
                  : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {editingStep ? "Update Step" : "Create Step"}
                    </>
                  )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
