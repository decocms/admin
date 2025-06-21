import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import PromptInput from "../prompts/rich-text/index.tsx";
import { SelectPromptsDialog } from "../prompts/select-prompts-dialog.tsx";
import { usePrompts } from "@deco/sdk";
import { DATETIME_NOW_PROMPT_ID } from "@deco/sdk/utils/prompt-mentions.ts";

function PromptTab() {
  const {
    form,
    handleSubmit,
  } = useAgentSettingsForm();

  const { data: prompts } = usePrompts();

  const handleAddPrompts = (promptIds: string[]) => {
    try {
      const currentInstructions = form.getValues("instructions") || "";
      const promptsToAdd = promptIds
        .map((id) => {
          const prompt = prompts?.find((p) => p.id === id);
          if (!prompt) return null;
          // All prompts use mention format, including Date/Time Now
          return `<span data-type="mention" data-id="${id}"></span>`;
        })
        .filter(Boolean);

      if (promptsToAdd.length > 0) {
        const separator = currentInstructions.trim() ? "\n\n" : "";
        const newInstructions = currentInstructions + separator + promptsToAdd.join("\n\n");
        form.setValue("instructions", newInstructions);
      }
    } catch (error) {
      console.error("Error adding prompts:", error);
    }
  };

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 pt-2 mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <FormField
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PromptInput
                      placeholder="Add context or behavior to shape responses (e.g., 'Be concise and reply in English.')"
                      enableMentions
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <SelectPromptsDialog
                onSelect={handleAddPrompts}
                trigger={
                  <Button variant="outline" size="sm">
                    <Icon name="add" size={16} />
                    <span>Add Prompts</span>
                  </Button>
                }
              />
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default PromptTab;
