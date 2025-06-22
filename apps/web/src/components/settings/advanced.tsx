import { useTeamRoles } from "@deco/sdk";
import {
  DEFAULT_MAX_STEPS,
  MAX_MAX_STEPS,
  MAX_MAX_TOKENS,
  MIN_MAX_TOKENS,
} from "@deco/sdk/constants";
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
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { Channels } from "./channels.tsx";
import { useTeam } from "@deco/sdk";

export const useCurrentTeamRoles = () => {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = team?.id;
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  return roles;
};

function AdvancedTab() {
  const {
    form,
    handleSubmit,
  } = useAgentSettingsForm();
  const roles = useCurrentTeamRoles();

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 py-2 pb-16"
          >
            <FormField
              name="max_steps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Steps</FormLabel>
                  <FormDescription className="text-xs text-muted-foreground">
                    Maximum number of sequential LLM calls an agent can make.
                  </FormDescription>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_MAX_STEPS}
                      defaultValue={DEFAULT_MAX_STEPS}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
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
                  <FormDescription className="text-xs text-muted-foreground">
                    The maximum number of tokens the agent can generate.
                  </FormDescription>
                  <FormControl>
                    <Input
                      type="number"
                      min={MIN_MAX_TOKENS}
                      max={MAX_MAX_TOKENS}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Team Access Section */}
            {roles.length > 0 && (
              <FormField
                name="access"
                control={form.control}
                render={({ field }) => {
                  return (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-2">
                          <FormLabel>Access</FormLabel>
                          <FormDescription className="text-xs text-muted-foreground">
                            Control who can access with this agent by role.
                          </FormDescription>
                        </div>
                      </div>

                      <FormControl>
                        <Select
                          value={`${field.value}`}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.name}>
                                <Icon
                                  name={role.name === "owner"
                                    ? "lock_person"
                                    : "groups"}
                                />
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}

            <div className="border-t pt-6">
              <Channels />
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default AdvancedTab;
