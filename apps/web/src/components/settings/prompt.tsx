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
                      className="min-h-[170px] h-full border-border border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-xl border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription className="text-xs font-normal text-muted-foreground">
                    Hint: You can use the{" "}
                    <span className="font-bold">@mention</span>{" "}
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
