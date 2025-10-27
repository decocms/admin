import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@deco/ui/components/resizable.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import PromptInput from "../rich-text/index.tsx";
import { useFormContext } from "./context.ts";
import { useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import HistoryTab from "./history.tsx";

function FloatingPromptOptions({
  setHistoryOpen,
}: {
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    onSubmit,
    form,
    prompt,
    promptVersion,
    handleRestoreVersion,
    blocker,
    handleCancel,
    handleDiscard,
  } = useFormContext();

  const isMutating = form.formState.isSubmitting;
  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  return (
    <>
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave this page, your edits will
              be lost. Are you sure you want to discard your changes and
              navigate away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="absolute z-50 top-2 right-2 border border-border bg-background rounded-xl p-1">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHistoryOpen((prev) => !prev)}
              >
                <Icon name="history" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Version history</TooltipContent>
          </Tooltip>
          <div className={cn(promptVersion ? "block" : "hidden")}>
            <Button size="sm" variant="default" onClick={handleRestoreVersion}>
              Restore version
            </Button>
          </div>
          <div
            className={cn(
              "items-center gap-2",
              numberOfChanges > 0 ? "flex" : "hidden",
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-foreground"
              onClick={handleDiscard}
            >
              Discard
            </Button>
            <Button
              size="sm"
              variant="default"
              className="gap-2"
              disabled={!numberOfChanges || prompt.readonly}
              onClick={() => {
                onSubmit(form.getValues());
              }}
            >
              {isMutating ? (
                <>
                  <Spinner size="xs" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>
                  Save {numberOfChanges} change
                  {numberOfChanges > 1 ? "s" : ""}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function PromptDetail() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { onSubmit, form, prompt } = useFormContext();

  const isReadonly = prompt.readonly;

  return (
    <>
      <FloatingPromptOptions setHistoryOpen={setHistoryOpen} />

      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>
          <ScrollArea className="h-[calc(100vh-48px)] w-full p-6 text-foreground">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6 px-1 mx-auto"
              >
                <div className="flex items-center gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <input
                            placeholder="Untitled prompt"
                            disabled={isReadonly}
                            className="border-none! px-0 text-2xl! font-bold outline-none!"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <PromptInput
                          placeholder="Write instructions or '/’ for tools and more..."
                          className="min-h-[49lvh]"
                          disabled={isReadonly}
                          enableMentions
                          hideMentionsLabel
                          excludeIds={[form.getValues("id")]}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle />
        {historyOpen && (
          <ResizablePanel>
            <HistoryTab />
          </ResizablePanel>
        )}
      </ResizablePanelGroup>
    </>
  );
}
