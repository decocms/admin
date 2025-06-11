import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import RichTextArea from "../prompts/rich-text.tsx";

function PromptTab() {
  const {
    form,
    handleSubmit,
  } = useAgentSettingsForm();

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
                    <RichTextArea
                      placeholder="Add context or behavior to shape responses (e.g., 'Be concise and reply in English.')"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs font-normal text-muted-foreground">
                    Hint: You can use the <span className="font-bold">/</span>
                    {" "}
                    to insert a prompt.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default PromptTab;
