import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useRef, useState } from "react";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { ModelSelector } from "../chat/model-selector.tsx";
import { AgentAvatar } from "../common/avatar/index.tsx";
import PromptInput from "../prompts/rich-text/index.tsx";
import { useWriteFile } from "@deco/sdk";
import { Switch } from "@deco/ui/components/switch.tsx";
import { Label } from "@deco/ui/components/label.tsx";

const AVATAR_FILE_PATH = "assets/avatars";


const useAvatarFilename = () => {
  const generate = (originalFile: File) => {
    const extension = originalFile.name.split(".").pop()?.toLowerCase() ||
      "png";
    return `avatar-${crypto.randomUUID()}.${extension}`;
  };

  return { generate };
};

function AgentProfileTab() {
  const {
    form,
    agent,
    handleSubmit,
  } = useAgentSettingsForm();

  const writeFileMutation = useWriteFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { generate: generateAvatarFilename } = useAvatarFilename();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    try {
      setIsUploading(true);
      const filename = generateAvatarFilename(file);
      const path = `${AVATAR_FILE_PATH}/${filename}`;
      const buffer = await file.arrayBuffer();
      await writeFileMutation.mutateAsync({
        path,
        contentType: file.type,
        content: new Uint8Array(buffer),
      });

      form.setValue("avatar", path, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      console.error("Failed to upload avatar:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 py-2 pb-16"
          >
            {/* Icon and Name */}
            <FormField
              name="name"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-6">
                    <FormField
                      control={form.control}
                      name="avatar"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-center items-center">
                            <input
                              type="file"
                              ref={fileInputRef}
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                            <FormControl>
                              <div
                                className="w-16 h-16 group aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer relative overflow-hidden"
                                onClick={triggerFileInput}
                              >
                                {isUploading
                                  ? (
                                    <Skeleton
                                      className={cn(
                                        "w-full h-full rounded-xl",
                                      )}
                                    />
                                  )
                                  : (
                                    <>
                                      <AgentAvatar
                                        name={agent.name}
                                        avatar={field.value || agent.avatar}
                                      />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <Icon
                                          name="upload"
                                          className="text-white text-xl"
                                        />
                                      </div>
                                      <Input type="hidden" {...field} />
                                    </>
                                  )}
                              </div>
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex-1 flex flex-col gap-1">
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter agent name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    Used for search and organization, it does not affect agent
                    behavior.
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Helps write product descriptions for the online store"
                      className="min-h-18 border-border"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Model & System Prompt */}
            <FormItem>
              <FormLabel>Model & System Prompt</FormLabel>
              <FormField
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PromptInput
                        placeholder="Add context or behavior to shape responses."
                        enableMentions
                        showToggle={false}
                        renderToggle={(view, setView) => (
                          <div className="flex items-center gap-4 mb-3 pt-1">
                            <FormField
                              name="model"
                              render={({ field }) => (
                                <FormItem className="w-1/3">
                                  <FormControl>
                                    <ModelSelector
                                      model={field.value}
                                      onModelChange={(newValue) =>
                                        field.onChange(newValue)}
                                      variant="bordered"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex-1 flex justify-between items-center gap-2 px-3 py-2 rounded-xl border">
                              <p className="text-xs text-muted-foreground">
                                You can use{" "}
                                <a
                                  href="https://www.commonmark.org/help/"
                                  className="underline text-primary-dark font-medium"
                                >
                                  markdown
                                </a>{" "}
                                here.
                              </p>
                              <div className="flex items-center gap-2">
                                <Switch
                                  id="markdown-view"
                                  checked={view === "markdown"}
                                  onCheckedChange={(checked: boolean) => {
                                    setView(checked ? "markdown" : "raw");
                                  }}
                                  className="cursor-pointer"
                                />
                                <Label
                                  htmlFor="markdown-view"
                                  className="text-xs text-foreground cursor-pointer"
                                >
                                  Markdown
                                </Label>
                              </div>
                            </div>
                          </div>
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormItem>

          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default AgentProfileTab;
