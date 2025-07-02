import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@deco/ui/components/avatar.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  renamePromptVersion,
  usePromptVersions,
  useSDK,
  useTeamMembers,
  useTeams,
  useUpdatePrompt,
} from "../../../../../../packages/sdk/src/index.ts";
import { useUser } from "../../../hooks/use-user.ts";
import { useFormContext } from "./context.ts";
import { cn } from "@deco/ui/lib/utils.ts";

export default function HistoryTab() {
  const { id } = useParams();
  const { workspace } = useSDK();
  const { data: versions, refetch } = usePromptVersions(id ?? "");
  const updatePrompt = useUpdatePrompt();
  const {
    form,
    prompt,
  } = useFormContext();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const user = useUser();
  const params = useParams();
  const resolvedTeamSlug = params.teamSlug;
  const { data: teams } = useTeams();
  const teamId = useMemo(
    () => teams?.find((t) => t.slug === resolvedTeamSlug)?.id ?? null,
    [teams, resolvedTeamSlug],
  );
  const { data: { members: teamMembers = [] } } = useTeamMembers(
    teamId ?? null,
  );

  const filteredVersions = useMemo(() => {
    return versions?.filter((version, idx) => {
      return version.content !== "" && idx !== 0;
    });
  }, [versions, selectedVersion]);

  // Create a lookup map for team members to avoid calling useMemo inside map
  const teamMembersMap = useMemo(() => {
    if (!teamMembers.length) return new Map();
    return new Map(teamMembers.map((member) => [member.user_id, member]));
  }, [teamMembers]);

  const handleRestoreVersion = async (versionId: string) => {
    const version = versions?.find((v) => v.id === versionId);
    await updatePrompt.mutateAsync({
      id: prompt.id,
      data: {
        content: version?.content ?? "",
      },
      versionName: version?.name ?? "",
    });
    await refetch();
    setSelectedVersion(null);
  };

  const handleStartEditing = (versionId: string, currentLabel: string) => {
    setEditingVersionId(versionId);
    setEditingLabel(currentLabel);
  };

  const handleSaveLabel = async (versionId: string) => {
    // Here you can implement the function to save the label
    console.log(`Saving label "${editingLabel}" for version ${versionId}`);
    await renamePromptVersion(workspace, {
      id: versionId,
      name: editingLabel,
    });
    await refetch();
    // Example: await updateVersionLabel(versionId, editingLabel);

    setEditingVersionId(null);
    setEditingLabel("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, versionId: string) => {
    if (e.key === "Enter") {
      handleSaveLabel(versionId);
    } else if (e.key === "Escape") {
      setEditingVersionId(null);
      setEditingLabel("");
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingVersionId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingVersionId]);

  useEffect(() => {
    if (selectedVersion) {
      setSelectedVersion(null);
    }
  }, [versions]);

  return (
    <div className="flex flex-col py-1">
      <div className="relative">
        <div className="flex flex-col relative z-10">
          <div
            className={`flex items-center gap-6 h-[64px] group relative hover:bg-muted rounded-md px-6 cursor-pointer ${
              !selectedVersion ? "bg-muted" : ""
            }`}
            onClick={() => {
              setSelectedVersion(null);
              form.setValue("content", prompt.content);
            }}
          >
            <div className="flex flex-col justify-end items-center gap-2 h-[64px]">
              <div
                className="w-[2px] bg-border b z-0 h-[36px] mt-1"
                style={{ minHeight: 36, pointerEvents: "none" }}
              />
              <span className="w-6 h-6 bg-foreground rounded-full absolute top-1/2 -translate-y-1/2 flex items-center justify-center">
                <span className="w-4 h-4 bg-background rounded-full flex items-center justify-center">
                  <span className="w-3 h-3 bg-foreground rounded-full flex items-center justify-center">
                    <span className="w-2 h-2 bg-background rounded-full flex items-center justify-center">
                      <span className="w-1 h-1 bg-foreground rounded-full flex items-center justify-center">
                      </span>
                    </span>
                  </span>
                </span>
              </span>
            </div>
            <span className="font-semibold text-sm">
              {versions[0]?.name ?? "Current Version"}
            </span>
          </div>
          {filteredVersions.map((version, idx) => {
            const userId = version.created_by;

            // If userId matches current user, use user data directly
            const isCurrentUser = userId && user && userId === user.id;

            // Use the lookup map instead of useMemo inside the map
            const member = (!isCurrentUser && teamId !== null)
              ? teamMembersMap.get(userId)
              : undefined;
            // Data source for avatar and name/email
            const avatarUrl = isCurrentUser
              ? user.metadata.avatar_url
              : member?.profiles?.metadata?.avatar_url;
            const name = isCurrentUser
              ? user.metadata.full_name
              : member?.profiles?.metadata?.full_name;

            return (
              <div
                key={version.id}
                className={cn(
                  "flex items-center h-[64px] group relative hover:bg-muted rounded-md px-6 cursor-pointer",
                  selectedVersion === version.id ? "bg-muted" : "",
                )}
                onClick={() => {
                  form.setValue("content", version.content);
                  setSelectedVersion(version.id);
                }}
              >
                <div className="flex flex-col justify-center items-center gap-2 h-full relative">
                  <div
                    className={cn(
                      "w-[2px] bg-border b z-0 h-full",
                      idx === filteredVersions.length - 1
                        ? "h-[36px] mt-[-28px]"
                        : "",
                    )}
                    style={{ minHeight: 36, pointerEvents: "none" }}
                  />
                  <span className="w-2 h-2 bg-foreground rounded-full absolute mt-2 -translate-y-1/2">
                  </span>
                </div>
                {/* Conteúdo da versão */}
                <div className="flex-1 flex items-center gap-2 pl-6 pr-2">
                  <div className="flex flex-col justify-start items-start gap-2">
                    {editingVersionId === version.id
                      ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, version.id)}
                          onBlur={() => handleSaveLabel(version.id)}
                          className="text-sm font-semibold border-none outline-none focus:ring-0 p-0 px-1 bg-white"
                          placeholder="Enter version label..."
                        />
                      )
                      : (
                        <span
                          className="text-sm font-semibold cursor-pointer hover:bg-muted px-1 py-0.5 rounded"
                          onClick={() =>
                            handleStartEditing(
                              version.id,
                              version.name ??
                                new Date(version.created_at).toLocaleString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  },
                                ),
                            )}
                        >
                          {version.name ??
                            new Date(version.created_at).toLocaleString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )}
                        </span>
                      )}
                    <div className="flex items-center gap-1">
                      <Avatar className="size-4">
                        {avatarUrl
                          ? (
                            <AvatarImage
                              src={avatarUrl}
                              alt={name}
                            />
                          )
                          : (
                            <AvatarFallback className="text-xs">
                              {name?.split(" ").map((n: string) => n[0]).join(
                                "",
                              )}
                            </AvatarFallback>
                          )}
                      </Avatar>
                      <span className="text-xs text-muted-foreground font-normal">
                        {name}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 p-0 ml-1"
                      >
                        <Icon name="more_vert" size={18} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Icon name="border_color" size={12} />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          handleRestoreVersion(version.id);
                        }}
                      >
                        <Icon name="replay" size={12} />
                        Restore this version
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
