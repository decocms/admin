export * from "./assertions.ts";
export * from "./context.ts";
export * from "./errors.ts";
import * as agentsAPI from "./agents/api.ts";
import { AppContext } from "./context.ts";
import * as hostingAPI from "./hosting/api.ts";
import * as integrationsAPI from "./integrations/api.ts";
import * as membersAPI from "./members/api.ts";
import * as profilesAPI from "./profiles/api.ts";
import { createMCPToolsStub, MCPClientStub } from "./stub.ts";
import * as teamsAPI from "./teams/api.ts";
import * as threadsAPI from "./threads/api.ts";
import * as triggersAPI from "./triggers/api.ts";

// Register tools for each API handler
export const GLOBAL_TOOLS = [
  teamsAPI.getTeam,
  teamsAPI.createTeam,
  teamsAPI.updateTeam,
  teamsAPI.deleteTeam,
  teamsAPI.listTeams,
  membersAPI.getTeamMembers,
  membersAPI.updateTeamMember,
  membersAPI.removeTeamMember,
  membersAPI.registerMemberActivity,
  membersAPI.getMyInvites,
  membersAPI.acceptInvite,
  membersAPI.inviteTeamMembers,
  membersAPI.teamRolesList,
  profilesAPI.getProfile,
  profilesAPI.updateProfile,
  integrationsAPI.callTool,
  integrationsAPI.listTools,
] as const;
export type GlobalTools = typeof GLOBAL_TOOLS;
// Tools tied to an specific workspace
export const WORKSPACE_TOOLS = [
  agentsAPI.getAgent,
  agentsAPI.deleteAgent,
  agentsAPI.createAgent,
  agentsAPI.updateAgent,
  agentsAPI.listAgents,
  integrationsAPI.getIntegration,
  integrationsAPI.createIntegration,
  integrationsAPI.updateIntegration,
  integrationsAPI.deleteIntegration,
  integrationsAPI.listIntegrations,
  threadsAPI.listThreads,
  threadsAPI.getThread,
  threadsAPI.getThreadMessages,
  threadsAPI.getThreadTools,
  hostingAPI.listApps,
  hostingAPI.deployFiles,
  hostingAPI.deleteApp,
  hostingAPI.getAppInfo,
  triggersAPI.listTriggers,
  triggersAPI.createTrigger,
  triggersAPI.createCronTrigger,
  triggersAPI.createWebhookTrigger,
  triggersAPI.deleteTrigger,
  triggersAPI.getWebhookTriggerUrl,
  triggersAPI.activateTrigger,
  triggersAPI.deactivateTrigger,
] as const;

export type WorkspaceTools = typeof WORKSPACE_TOOLS;

const global = createMCPToolsStub({
  tools: GLOBAL_TOOLS,
});
export const MCPClient = new Proxy(
  {} as typeof global & {
    forContext: (ctx: AppContext) => MCPClientStub<WorkspaceTools>;
  },
  {
    get(_, name) {
      if (name === "forContext") {
        return (ctx: AppContext) =>
          createMCPToolsStub({
            tools: WORKSPACE_TOOLS,
            context: ctx,
          });
      }
      return global[name as keyof typeof global];
    },
  },
);

export { Entrypoint } from "./hosting/api.ts";
