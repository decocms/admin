import { useDeleteTeam, useUpdateTeam } from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@deco/ui/components/alert-dialog.tsx";
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
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "../common/avatar/index.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { SettingsMobileHeader } from "./settings-mobile-header.tsx";

interface GeneralSettingsFormValues {
  teamName: string;
  teamSlug: string;
  workspaceEmailDomain: boolean;
  teamSystemPrompt: string;
  personalSystemPrompt: string;
}

const generalSettingsSchema = z.object({
  teamName: z.string(),
  teamSlug: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]+$/, {
      message:
        "Team slug can only contain letters, numbers, dashes, underscores, and dots.",
    }),
  workspaceEmailDomain: z.boolean(),
  teamSystemPrompt: z.string(),
  personalSystemPrompt: z.string(),
});

function DeleteTeamDialog({
  isOpen,
  onOpenChange,
  isReadOnly,
  isPending,
  onDelete,
  error,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isReadOnly: boolean;
  isPending: boolean;
  onDelete: () => Promise<void>;
  error: string | null;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          className="w-fit"
          variant="destructive"
          disabled={isReadOnly || isPending}
        >
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Team?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the team
            and all its data.
          </AlertDialogDescription>
          {error && (
            <div className="text-destructive text-sm mt-2">
              {error}
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                await onDelete();
              }}
            >
              {isPending
                ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="xs" /> Deleting...
                  </span>
                )
                : (
                  "Delete"
                )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function GeneralSettings() {
  const {
    label: currentTeamName,
    slug: currentTeamSlug,
    avatarUrl,
    id: currentTeamId,
  } = useCurrentTeam();

  // If slug is empty, it's a personal team
  const isPersonalTeam = !currentTeamSlug;

  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const form = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      teamName: currentTeamName,
      teamSlug: currentTeamSlug,
      workspaceEmailDomain: true,
      teamSystemPrompt: "",
      personalSystemPrompt: "",
    },
    mode: "onChange",
  });

  async function onSubmit(data: GeneralSettingsFormValues) {
    if (isPersonalTeam) return;
    const prevSlug = currentTeamSlug;
    await updateTeam.mutateAsync({
      id: typeof currentTeamId === "number"
        ? currentTeamId
        : Number(currentTeamId) || 0,
      data: {
        name: data.teamName,
        slug: data.teamSlug,
      },
    });
    form.reset(data);
    // If the slug changed, navigate to the new team's settings page
    if (data.teamSlug !== prevSlug) {
      globalThis.location.href = `/${data.teamSlug}/settings`;
    }
  }

  const isReadOnly = isPersonalTeam;

  return (
    <ScrollArea className="h-full text-foreground">
      <div className="container h-full max-w-7xl text-foreground">
        <SettingsMobileHeader currentPage="general" />
        <div className="h-full overflow-auto py-20 md:px-[120px]">
          <div className="flex flex-col gap-6 w-full">
            <div className="w-full hidden md:block">
              <h2 className="text-2xl">General</h2>
            </div>
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Avatar
                    fallback={currentTeamName}
                    url={avatarUrl}
                    className="w-[120px] h-[120px]"
                  />
                </div>
              </div>
              <Form {...form}>
                <form
                  className="space-y-8"
                  onSubmit={form.handleSubmit(onSubmit)}
                >
                  <FormField
                    control={form.control}
                    name="teamName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="The name of your company or organization"
                            readOnly={isReadOnly}
                            disabled={isReadOnly}
                          />
                        </FormControl>
                        <FormDescription>
                          The name of your company or organization
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teamSlug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team Slug</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="your-team"
                            readOnly={isReadOnly}
                            disabled={isReadOnly}
                          />
                        </FormControl>
                        <FormDescription>
                          Changing the team slug will redirect you to the new
                          address
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="teamSystemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Team System Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="This prompt is added at the start of all agent messages for your team. Use it to set tone, context, or rules."
                            rows={6}
                            disabled
                            readOnly={isReadOnly}
                          />
                        </FormControl>
                        <FormDescription>
                          This prompt is added at the start of all agent
                          messages for your team. Use it to set tone, context,
                          or rules.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <Separator />
                  <FormField
                    control={form.control}
                    name="personalSystemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal System Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="This prompt is added at the end of agent messages just for you. Use it to personalize style or add your own context."
                            rows={6}
                            disabled
                            readOnly={isReadOnly}
                          />
                        </FormControl>
                        <FormDescription>
                          This prompt is added at the end of agent messages just
                          for you. Use it to personalize style or add your own
                          context.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <div className="p-6 bg-muted rounded-lg">
                    <div className="flex flex-col gap-2">
                      <h3 className="font-semibold">Delete Team</h3>
                      <p className="text-xs text-muted-foreground">
                        Permanently remove this team, all its connected
                        integrations and uploaded data
                      </p>
                      <DeleteTeamDialog
                        isOpen={isDeleteDialogOpen}
                        onOpenChange={(open) => {
                          setIsDeleteDialogOpen(open);
                          if (!open) setDeleteError(null);
                        }}
                        isReadOnly={isReadOnly}
                        isPending={deleteTeam.isPending}
                        error={deleteError}
                        onDelete={async () => {
                          setDeleteError(null);
                          if (!currentTeamId) return;
                          try {
                            await deleteTeam.mutateAsync(
                              typeof currentTeamId === "number"
                                ? currentTeamId
                                : Number(currentTeamId) || 0,
                            );
                            // Do not close the dialog automatically
                            globalThis.location.href = "/";
                          } catch (err) {
                            setDeleteError(
                              err instanceof Error
                                ? err.message
                                : "Failed to delete team.",
                            );
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => form.reset()}
                      disabled={isReadOnly || !form.formState.isDirty ||
                        form.formState.isSubmitting}
                    >
                      Discard
                    </Button>
                    <Button
                      type="submit"
                      variant="default"
                      disabled={isReadOnly || !form.formState.isDirty ||
                        form.formState.isSubmitting || updateTeam.isPending}
                    >
                      {updateTeam.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export default GeneralSettings;
