import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { Input } from "@deco/ui/components/input.tsx";

// Token limits for Anthropic models
const ANTHROPIC_MIN_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_MAX_TOKENS = 64000;

function PromptTab() {
  const {
    form,
    handleSubmit,
  } = useAgentSettingsForm();

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <FormField
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Guide your agent's behavior with custom instructions."
                      className="min-h-[170px] h-[170px] border-slate-200"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="max_tokens"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Tokens</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      className="rounded-md border-slate-200"
                      min={ANTHROPIC_MIN_MAX_TOKENS}
                      max={ANTHROPIC_MAX_MAX_TOKENS}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
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
