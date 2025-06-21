import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { AgentAvatar } from "../common/avatar/index.tsx";
import PromptInput from "../prompts/rich-text/index.tsx";

function PromptTab() {
  const {
    form,
    handleSubmit,
  } = useAgentSettingsForm();

  return (
    <ScrollArea className="h-full w-full [&>div>div]:h-full">
      <Form {...form}>
        <div className="h-full w-full p-6 mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 h-full"
          >
            <div className="flex items-center gap-6">
              <AgentAvatar
                className="size-14"
                name={form.getValues("name")}
                avatar={form.getValues("avatar")}
              />
              <div className="flex flex-col w-full">
                <FormField
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Untitled agent"
                          className="border-none p-0 focus-visible:ring-0 font-medium rounded text-2xl md:text-2xl h-auto placeholder:text-muted-foreground placeholder:opacity-25"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Describe what this agent does..."
                          className="border-none resize-none min-h-auto p-0 shadow-none focus-visible:ring-0 text-sm rounded h-auto placeholder:text-muted-foreground"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <FormField
              name="instructions"
              render={({ field }) => (
                <FormItem className="h-full">
                  <FormControl>
                    <PromptInput
                      placeholder="Add context and behavior to shape responses, or '/' for tools and more..."
                      enableMentions
                      {...field}
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
