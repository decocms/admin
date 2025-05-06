import { useState } from "react";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { useCurrentTeam } from "../sidebar/TeamSelector.tsx";
import { Avatar } from "../common/Avatar.tsx";

export default function GeneralSettings() {
  const { label: currentTeamName, url: currentTeamUrl, avatarURL } =
    useCurrentTeam();
  const [teamName, setTeamName] = useState(currentTeamName);
  const [teamUrl, setTeamUrl] = useState(currentTeamUrl.replace("/", ""));
  const [workspaceEmailDomain, setWorkspaceEmailDomain] = useState(true);
  const [teamSystemPrompt, setTeamSystemPrompt] = useState("");
  const [personalSystemPrompt, setPersonalSystemPrompt] = useState("");

  return (
    <div className="container h-full max-w-7xl text-slate-700">
      <SettingsMobileHeader currentPage="general" />
      <div className="p-6 h-full overflow-auto pb-20 md:px-[120px]">
        <div className="flex flex-col gap-6 w-full">
          <div className="w-full hidden md:block">
            <h2 className="text-2xl">General</h2>
          </div>
          <div className="max-w-[500px] mx-auto space-y-8">
            {/* Team Logo and Basic Info */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full bg-green-800 flex items-center justify-center mb-4">
                <Avatar
                  fallback={teamName}
                  url={avatarURL}
                  className="w-[120px] h-[120px]"
                />
              </div>
            </div>

            {/* Team Information */}
            <div className="p-6 space-y-4 bg-background rounded-lg">
              <div className="space-y-2">
                <label htmlFor="team-name" className="text-sm font-medium">
                  Team Name
                </label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="The name of your company or organization"
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  The name of your company or organization
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="team-url" className="text-sm font-medium">
                  Team URL
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="team-url"
                    value={teamUrl}
                    onChange={(e) => setTeamUrl(e.target.value)}
                    placeholder="your-team"
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Changing the team URL will redirect you to the new address
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <h3 className="font-medium">Workspace email domain</h3>
                  <p className="text-xs text-muted-foreground">
                    Allow others with a @acme.com email to join this workspace
                  </p>
                </div>
                <Switch
                  disabled
                  checked={workspaceEmailDomain}
                  onCheckedChange={setWorkspaceEmailDomain}
                />
              </div>
            </div>

            {/* System Prompts */}
            <div className="p-6 space-y-6 bg-background rounded-lg">
              <div className="space-y-2">
                <label
                  htmlFor="team-system-prompt"
                  className="text-sm font-medium"
                >
                  Team System Prompt
                </label>
                <Textarea
                  id="team-system-prompt"
                  value={teamSystemPrompt}
                  onChange={(e) => setTeamSystemPrompt(e.target.value)}
                  placeholder="This prompt is added at the start of all agent messages for your team. Use it to set tone, context, or rules."
                  rows={6}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  This prompt is added at the start of all agent messages for
                  your team. Use it to set tone, context, or rules.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <label
                  htmlFor="personal-system-prompt"
                  className="text-sm font-medium"
                >
                  Personal System Prompt
                </label>
                <Textarea
                  id="personal-system-prompt"
                  value={personalSystemPrompt}
                  onChange={(e) => setPersonalSystemPrompt(e.target.value)}
                  placeholder="This prompt is added at the end of agent messages just for you. Use it to personalize style or add your own context."
                  rows={6}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  This prompt is added at the end of agent messages just for
                  you. Use it to personalize style or add your own context.
                </p>
              </div>

              <div className="p-6 bg-slate-50 rounded-lg">
                <div className="flex flex-col gap-2">
                  <h3 className="font-semibold">Delete Team</h3>
                  <p className="text-xs text-muted-foreground">
                    Permanently remove this team, all its connected integrations
                    and uploaded data
                  </p>
                  <Button
                    className="w-fit"
                    variant="destructive"
                    disabled
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
