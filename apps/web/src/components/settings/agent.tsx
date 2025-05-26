import {
  type Integration as IntegrationType,
  useSDK,
  useWriteFile,
} from "@deco/sdk";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useRef, useState } from "react";
import { getPublicChatLink } from "../agent/chats.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { ModelSelector } from "../chat/ModelSelector.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { Integration } from "../toolsets/index.tsx";
import { ToolsetSelector } from "../toolsets/selector.tsx";

// Token limits for Anthropic models
const ANTHROPIC_MIN_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_MAX_TOKENS = 64000;

const AVATAR_FILE_PATH = "assets/avatars";

function CopyLinkButton(
  { className, link }: { className: string; link: string },
) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      aria-label="Copy link"
      className={className}
      onClick={() => {
        navigator.clipboard.writeText(link);
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      }}
    >
      <Icon name={isCopied ? "check" : "link"} size={16} />
      Copy link
    </Button>
  );
}

const useAvatarFilename = () => {
  const generate = (originalFile: File) => {
    const extension = originalFile.name.split(".").pop()?.toLowerCase() ||
      "png";
    return `avatar-${crypto.randomUUID()}.${extension}`;
  };

  return { generate };
};

function SettingsTab() {
  const {
    form,
    agent,
    handleSubmit,
    installedIntegrations,
  } = useAgentSettingsForm();

  const writeFileMutation = useWriteFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { generate: generateAvatarFilename } = useAvatarFilename();
  const [isUploading, setIsUploading] = useState(false);

  const toolsSet = form.watch("tools_set");
  const setIntegrationTools = (
    integrationId: string,
    tools: string[],
  ) => {
    const toolsSet = form.getValues("tools_set");
    const newToolsSet = { ...toolsSet };

    if (tools.length > 0) {
      newToolsSet[integrationId] = tools;
    } else {
      delete newToolsSet[integrationId];
    }

    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  const usedIntegrations = installedIntegrations.filter((integration) =>
    !!toolsSet[integration.id]?.length
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);

  const handleIntegrationClick = (integration: IntegrationType) => {
    setSelectedIntegrationId(integration.id);
    setIsModalOpen(true);
  };

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
                                className="w-16 h-16 group aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 cursor-pointer relative overflow-hidden"
                                onClick={triggerFileInput}
                              >
                                {isUploading
                                  ? (
                                    <Skeleton
                                      className={cn(
                                        "w-full h-full rounded-lg",
                                      )}
                                    />
                                  )
                                  : (
                                    <>
                                      <AgentAvatar
                                        name={agent.name}
                                        avatar={field.value || agent.avatar}
                                        className="rounded-lg"
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
                          className="rounded-md"
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

            <FormField
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Model</FormLabel>
                  <FormControl>
                    <ModelSelector
                      model={field.value}
                      onModelChange={(newValue) => field.onChange(newValue)}
                      variant="bordered"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>System Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the agent's system prompt"
                      className="min-h-36 border-slate-200"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Visibility Section */}
            <FormField
              name="visibility"
              render={({ field }) => {
                const { workspace } = useSDK();
                const isPublic = field.value === "PUBLIC";
                const publicLink = getPublicChatLink(agent.id, workspace);

                return (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-2">
                        <FormLabel>Visibility</FormLabel>
                        <FormDescription className="text-xs text-slate-400">
                          Control who can access and interact with this agent.
                        </FormDescription>
                      </div>

                      <CopyLinkButton
                        link={publicLink}
                        className={cn(isPublic ? "visible" : "invisible")}
                      />
                    </div>

                    <FormControl>
                      <Select
                        value={field.value ?? "PRIVATE"}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WORKSPACE">
                            <div className="flex items-center gap-2">
                              <Icon name="groups" />
                              <span>Team</span>
                              <span className="text-xs text-muted-foreground">
                                Members of your team can access and edit the
                                agent
                              </span>
                            </div>
                          </SelectItem>
                          <SelectItem value="PUBLIC">
                            <div className="flex items-center gap-2">
                              <Icon name="public" />
                              <span>Public</span>
                              <span className="text-xs text-muted-foreground">
                                Anyone with the link can view and use the agent.
                              </span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About this agent</FormLabel>
                  <FormDescription className="text-xs text-slate-400">
                    This appears on the agent card and helps others understand
                    its use. It does not affect the agent's behavior
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your agent's purpose"
                      className="min-h-18 border-slate-200"
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

            {/* Tools Section */}
            <div className="space-y-2 mb-8">
              <div className="flex items-center justify-between space-y-1">
                <div className="flex flex-col gap-2">
                  <FormLabel>Tools</FormLabel>
                  <FormDescription className="text-xs text-slate-400">
                    Extensions that expand the agent's abilities.
                  </FormDescription>
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="h-8 w-8 bg-slate-700 hover:bg-slate-600 rounded-lg"
                  onClick={() => {
                    setSelectedIntegrationId(null);
                    setIsModalOpen(true);
                  }}
                  aria-label="Add tools"
                >
                  <Icon name="add" />
                </Button>
              </div>
              <div className="flex-1">
                <div className="flex flex-col gap-2">
                  {usedIntegrations
                    .map((integration) => (
                      <Integration
                        key={integration.id}
                        integration={integration}
                        setIntegrationTools={setIntegrationTools}
                        enabledTools={toolsSet[integration.id] || []}
                        onIntegrationClick={handleIntegrationClick}
                      />
                    ))}
                </div>
              </div>
            </div>
          </form>
        </div>
        <ToolsetSelector
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) {
              setSelectedIntegrationId(null);
            }
          }}
          installedIntegrations={installedIntegrations}
          toolsSet={toolsSet}
          setIntegrationTools={setIntegrationTools}
          initialSelectedIntegration={selectedIntegrationId}
        />
      </Form>
    </ScrollArea>
  );
}

export default SettingsTab;
