import {
  type Member,
  useRejectInvite,
  useRemoveTeamMember,
  useTeam,
  useTeamMembers,
  useTeamRoles,
  useUpdateMemberRole,
  useInviteTeamMember,
  useAgents,
  useIntegrations,
  listTools,
  useTeams,
  useTools,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import React, { Suspense, useDeferredValue, useMemo, useState, useEffect } from "react";
import { useParams } from "react-router";
import { UserAvatar } from "../common/avatar/user.tsx";
import { useUser } from "../../hooks/use-user.ts";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { InviteTeamMembersDialog } from "../common/invite-team-members-dialog.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { RolesDropdown } from "../common/roles-dropdown.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { ActivityStatusCell, UserInfo } from "../common/table/table-cells.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { Avatar, AvatarFallback } from "@deco/ui/components/avatar.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { useCallback } from "react";
import { IntegrationListItem } from "../toolsets/selector.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { MultiSelect } from "@deco/ui/components/multi-select.tsx";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@deco/ui/components/sidebar.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";

function MemberTableHeader(
  { onChange, disabled, teamId }: {
    disabled?: boolean;
    onChange: (value: string) => void;
    teamId?: number;
  },
) {
  return (
    <div className="flex items-center justify-between">
      <Input
        placeholder="Search"
        onChange={(e) => onChange(e.currentTarget.value)}
        className="w-80"
        disabled={disabled}
      />
      <InviteTeamMembersDialog
        teamId={teamId}
        trigger={
          <Button>
            <Icon name="add" />
            Invite Members
          </Button>
        }
      />
    </div>
  );
}

function MembersViewLoading() {
  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <MemberTableHeader disabled onChange={() => {}} teamId={undefined} />
      <div className="flex justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading members...</span>
      </div>
    </div>
  );
}

const getMemberName = (member: Member) =>
  member.profiles.metadata.full_name ||
  member.profiles.email;

// Add type for combined member/invite data
type MemberTableRow = {
  type: "member" | "invite";
  id: string | number;
  name: string;
  email: string;
  roles: Array<{ id: number; name: string }>;
  lastActivity?: string | null;
  avatarUrl?: string;
  isPending?: boolean;
  userId?: string; // For actual members, undefined for pending invites
  member?: Member;
  invite?: {
    id: string | number;
    email: string;
    roles: Array<{ id: number; name: string }>;
  };
};

interface RoleFormData {
  name: string;
  description: string;
  tools: Record<string, string[]>; // integrationId -> tool names
  agents: string[]; // agent IDs
  members: string[]; // user IDs
}

// Custom UserInfo component for role dialog with 14px titles
function RoleDialogUserInfo({ userId }: { userId: string }) {
  const user = useUser();
  const params = useParams();
  const resolvedTeamSlug = params.teamSlug;
  const { data: teams } = useTeams();
  const teamId = useMemo(
    () => teams?.find((t) => t.slug === resolvedTeamSlug)?.id ?? null,
    [teams, resolvedTeamSlug],
  );

  // If userId matches current user, use user data directly
  const isCurrentUser = userId && user && userId === user.id;

  const { data: { members: teamMembers = [] } } = useTeamMembers(
    teamId ?? null,
  );
  const members = (!isCurrentUser && teamId !== null) ? teamMembers : [];
  const member = useMemo(
    () => members.find((m) => m.user_id === userId),
    [members, userId],
  );

  // Data source for avatar and name/email
  const avatarUrl = isCurrentUser
    ? user.metadata.avatar_url
    : member?.profiles?.metadata?.avatar_url;
  const name = isCurrentUser
    ? user.metadata.full_name
    : member?.profiles?.metadata?.full_name;
  const email = isCurrentUser ? user.email : member?.profiles?.email;

  return (
    <div className="flex items-center gap-2 min-w-[48px]">
      <UserAvatar
        url={avatarUrl}
        fallback={name}
        size="base"
      />
      <div className="flex flex-col items-start text-left leading-tight w-full">
        <span
          className="truncate block text-sm font-medium text-foreground"
          style={{ maxWidth: "300px" }}
        >
          {name || "Unknown"}
        </span>
        <span
          className="truncate block text-xs font-normal text-muted-foreground"
          style={{ maxWidth: "300px" }}
        >
          {email || ""}
        </span>
      </div>
    </div>
  );
}

// Custom IntegrationListItem component for role dialog with 14px titles
function RoleDialogIntegrationListItem({
  toolsSet,
  setIntegrationTools,
  integration,
  searchTerm = "",
}: {
  toolsSet: Record<string, string[]>;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  integration: any;
  searchTerm?: string;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const { data: toolsData, isLoading } = useTools(integration.connection);

  const total = toolsData?.tools?.length ?? 0;
  const allTools = toolsData?.tools || [];
  const enabledCount = allTools.filter((tool) => toolsSet[integration.id]?.includes(tool.name)).length;
  const isAll = enabledCount === total && total > 0;
  const isEmpty = !isLoading && allTools.length === 0;

  // Helper function to check if a tool matches the search term
  const toolMatchesSearch = (tool: any, lowerSearchTerm: string) => {
    if (!lowerSearchTerm) return true;
    const toolNameFormatted = tool.name.replace(/_/g, " ").toLowerCase();
    const toolNameOriginal = tool.name.toLowerCase();
    const toolDescription = tool.description?.toLowerCase() || "";
    return toolNameFormatted.includes(lowerSearchTerm) ||
      toolNameOriginal.includes(lowerSearchTerm) ||
      toolDescription.includes(lowerSearchTerm);
  };

  // Filter tools based on search term
  const filteredTools = allTools.filter((tool) => toolMatchesSearch(tool, searchTerm));

  // Hide integration if searching and no tools match
  if (searchTerm && filteredTools.length === 0 && !isLoading) {
    return null;
  }

  // Auto-expand tools when searching
  const shouldExpandTools = searchTerm && filteredTools.length > 0;
  const effectiveToolsOpen = toolsOpen || shouldExpandTools;

  function handleAll(checked: boolean) {
    setIntegrationTools(
      integration.id,
      checked ? allTools.map((tool) => tool.name) : [],
    );
  }

  return (
    <div className="w-full flex flex-col rounded-xl transition-colors border border-border relative">
      <div className="flex gap-4 p-3 rounded-t-xl">
        <div className="flex gap-4 items-center justify-between w-full">
          <div>
                         <IntegrationIcon
               icon={integration.icon}
               name={integration.name}
               className="h-10 w-10"
             />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <span className="text-sm text-foreground font-medium text-left truncate">
              {integration.name}
            </span>
          </div>
        </div>
      </div>
      {isEmpty && (
        <div className="flex gap-2 items-center justify-between px-4 py-4 border-t border-border">
          <div className="flex gap-2 items-center">
            <Icon name="settings" size={16} />
            <span className="text-xs font-medium">Connection settings</span>
          </div>
          <Badge variant="destructive">
            <Icon name="error" size={10} />
            Error
          </Badge>
        </div>
      )}
      {!isEmpty && (
        <div className="flex flex-col items-start gap-1 min-w-0 border-t border-border cursor-pointer bg-background rounded-b-xl">
          <span
            onClick={() => setToolsOpen(!toolsOpen)}
            className="text-muted-foreground text-sm h-10 flex items-center w-full pl-2 pr-4"
          >
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Icon
                  name="chevron_right"
                  filled
                  size={14}
                  className={`inline-block mr-1 align-text-bottom text-foreground ${effectiveToolsOpen ? "rotate-90" : ""}`}
                />
                <span className={`text-xs font-medium text-muted-foreground ${isLoading ? "animate-pulse" : ""}`}>
                  {isLoading
                    ? "Loading tools..."
                    : searchTerm
                    ? `${filteredTools.length} matching tools`
                    : "All tools"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {enabledCount}/{total}
                </span>
                <Checkbox
                  className="cursor-pointer"
                  checked={isAll}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAll(!isAll);
                  }}
                  disabled={isLoading}
                />
              </div>
            </div>
          </span>
          {effectiveToolsOpen && (
            <div className="space-y-2 rounded-b-xl max-h-[350px] w-full overflow-y-auto">
              {filteredTools?.map((tool) => {
                const enabled = toolsSet[integration.id]?.includes(tool.name) ?? false;
                const handleCheckboxChange = (checked: boolean) => {
                  const withoutTool = toolsSet[integration.id]?.filter((t) => t !== tool.name);
                  const withTool = [...(toolsSet[integration.id] || []), tool.name];
                  const toolsToUpdate = checked ? withTool : withoutTool;
                  setIntegrationTools(integration.id, toolsToUpdate);
                };

                return (
                  <label
                    key={tool.name}
                    className="flex items-center justify-between gap-3 px-4 cursor-pointer"
                  >
                    <div className="flex flex-col min-w-0 border-l border-border border-dashed p-4 pr-0">
                      <span className={`text-sm truncate cursor-pointer ${enabled ? "text-foreground" : "text-muted-foreground"}`}>
                        {tool.name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {tool.description || "No description"}
                      </span>
                    </div>
                    <Checkbox
                      checked={enabled}
                      onCheckedChange={handleCheckboxChange}
                      className="cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddRoleDialog({ 
  open, 
  onOpenChange,
  role = null,
  teamId, // Add teamId as prop
  onSave, // Add onSave callback
  initialTab = "general", // Add initialTab prop
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: any;
  teamId?: number;
  onSave: (roleData: RoleFormData, isEditing: boolean) => void;
  initialTab?: string;
}) {
  const { data: { members } } = useTeamMembers(teamId ?? null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: role?.name || "",
    description: role?.description || "",
    tools: role?.tools || {},
    agents: role?.agents || [],
    members: role?.members || [],
  });
  const [selectedTab, setSelectedTab] = useState(initialTab);
  const { data: integrations = [] } = useIntegrations();
  const { data: agents = [] } = useAgents();
  
  // Search states for each section
  const [toolsSearch, setToolsSearch] = useState("");
  const [agentsSearch, setAgentsSearch] = useState("");
  const [membersSearch, setMembersSearch] = useState("");
  const [selectingAllTools, setSelectingAllTools] = useState(false);

  // Reset selected tab when dialog opens/closes or role changes
  useEffect(() => {
    if (open) {
      setSelectedTab(initialTab);
    }
  }, [open, initialTab]);

  const availableIntegrations = integrations.filter(i => 
    i.id.startsWith("i:") && 
    !["i:user-management", "i:workspace-management"].includes(i.id)
  );
  
  // Filtered data based on search
  const filteredIntegrations = availableIntegrations.filter(integration =>
    integration.name.toLowerCase().includes(toolsSearch.toLowerCase())
  );
  
  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(agentsSearch.toLowerCase()) ||
    (agent.description || "").toLowerCase().includes(agentsSearch.toLowerCase())
  );
  
  const filteredMembers = members.filter(member => {
    const name = member.profiles.metadata.full_name || "";
    const email = member.profiles.email || "";
    const searchTerm = membersSearch.toLowerCase();
    return name.toLowerCase().includes(searchTerm) || email.toLowerCase().includes(searchTerm);
  });

  const setIntegrationTools = useCallback((integrationId: string, tools: string[]) => {
    setFormData(prev => ({
      ...prev,
      tools: {
        ...prev.tools,
        [integrationId]: tools,
      }
    }));
  }, []);

  const enableAllTools = useCallback((integrationId: string) => {
    const integration = availableIntegrations.find(i => i.id === integrationId);
    if (!integration?.connection) return;

    // Set empty array initially
    setIntegrationTools(integrationId, []);

    // Fetch all tools for this integration
    listTools(integration.connection)
      .then(result => {
        setIntegrationTools(integrationId, result.tools.map(tool => tool.name));
      })
      .catch(console.error);
  }, [availableIntegrations, setIntegrationTools]);

  const disableAllTools = useCallback((integrationId: string) => {
    setFormData(prev => {
      const newTools = { ...prev.tools };
      delete newTools[integrationId];
      return { ...prev, tools: newTools };
    });
  }, []);

  const handleAgentToggle = (agentId: string, checked: boolean) => {
    if (checked) {
      // Check if agent has tools that this role doesn't have
      const agent = agents.find(a => a.id === agentId);
      const agentTools = agent?.tools_set || {};
      const roleTools = formData.tools;
      
      const missingIntegrations: string[] = [];
      Object.keys(agentTools).forEach(integrationId => {
        if (!roleTools[integrationId] || roleTools[integrationId].length === 0) {
          missingIntegrations.push(integrationId);
        }
      });

      if (missingIntegrations.length > 0) {
        // Show alert about missing tools
        // For now, we'll automatically add the missing tools
        missingIntegrations.forEach(integrationId => {
          const agentIntegrationTools = agentTools[integrationId] || [];
          setIntegrationTools(integrationId, agentIntegrationTools);
        });
      }

      setFormData(prev => ({
        ...prev,
        agents: [...prev.agents, agentId]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        agents: prev.agents.filter(id => id !== agentId)
      }));
    }
  };

  const handleMemberToggle = (userId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      members: checked 
        ? [...prev.members, userId]
        : prev.members.filter(id => id !== userId)
    }));
  };

  // Update formData when role prop changes
  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || "",
        description: role.description || "",
        tools: role.tools || {},
        agents: role.agents || [],
        members: role.members || [],
      });
    } else {
      setFormData({
        name: "",
        description: "",
        tools: {},
        agents: [],
        members: [],
      });
    }
  }, [role]);

  const handleSave = () => {
    onSave(formData, !!role);
    onOpenChange(false);
    toast.success(role ? "Role updated successfully" : "Role created successfully");
  };

  // Calculate counts for display
  const selectedToolsCount = Object.values(formData.tools).reduce((total, tools) => total + tools.length, 0);
  const selectedAgentsCount = formData.agents.length;
  const selectedMembersCount = formData.members.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-fit min-w-[600px] max-w-[90vw] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{role ? "Edit Role" : "Add New Role"}</DialogTitle>
        </DialogHeader>

        <div className="flex h-[60vh]">
          {/* Left sidebar menu */}
          <div className="w-48 pr-4 flex-shrink-0">
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={selectedTab === "general"}
                  onClick={() => setSelectedTab("general")}
                  className="cursor-pointer justify-between"
                >
                  <span>General</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={selectedTab === "tools"}
                  onClick={() => setSelectedTab("tools")}
                  className="cursor-pointer justify-between"
                >
                  <span>Tools</span>
                  {selectedToolsCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {selectedToolsCount}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={selectedTab === "agents"}
                  onClick={() => setSelectedTab("agents")}
                  className="cursor-pointer justify-between"
                >
                  <span>Agents</span>
                  {selectedAgentsCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {selectedAgentsCount}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={selectedTab === "members"}
                  onClick={() => setSelectedTab("members")}
                  className="cursor-pointer justify-between"
                >
                  <span>Members</span>
                  {selectedMembersCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {selectedMembersCount}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>

          {/* Right content area */}
          <div className="flex-1 pl-6 overflow-y-auto min-w-0">
            {selectedTab === "general" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role-name" className="text-sm font-medium">Name</Label>
                  <Input
                    id="role-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter role name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-description" className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="role-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this role can do"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {selectedTab === "tools" && (
              <div className="space-y-4">
                <Input
                  placeholder="Search integrations..."
                  value={toolsSearch}
                  onChange={(e) => setToolsSearch(e.target.value)}
                  className="w-full"
                />
                
                {/* Tools counter and select all button */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {(() => {
                      const totalSelectedTools = Object.values(formData.tools).reduce((acc, tools) => acc + tools.length, 0);
                      const selectedIntegrations = Object.keys(formData.tools).filter(id => formData.tools[id].length > 0).length;
                      return `${totalSelectedTools} tools from ${selectedIntegrations} integrations`;
                    })()}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={selectingAllTools}
                    onClick={async () => {
                      const hasAnySelected = Object.values(formData.tools).some(tools => tools.length > 0);
                      
                      if (hasAnySelected) {
                        // Deselect all
                        setFormData(prev => ({ ...prev, tools: {} }));
                      } else {
                        // Select all - fetch tools for each integration
                        setSelectingAllTools(true);
                        const newTools: Record<string, string[]> = {};
                        
                        try {
                          for (const integration of filteredIntegrations) {
                            try {
                              const toolsData = await listTools(integration.connection);
                              const toolNames = toolsData.tools?.map(tool => tool.name) || [];
                              newTools[integration.id] = toolNames;
                            } catch (error) {
                              console.error(`Failed to load tools for ${integration.name}:`, error);
                              newTools[integration.id] = [];
                            }
                          }
                          
                          setFormData(prev => ({ ...prev, tools: newTools }));
                        } finally {
                          setSelectingAllTools(false);
                        }
                      }
                    }}
                  >
                    {selectingAllTools 
                      ? "Loading..." 
                      : Object.values(formData.tools).some(tools => tools.length > 0) 
                        ? "Deselect All" 
                        : "Select All"
                    }
                  </Button>
                </div>

                <div className="space-y-2 grid grid-cols-1" style={{ maxWidth: 420 }}>
                  {filteredIntegrations.map(integration => (
                    <RoleDialogIntegrationListItem
                      key={integration.id}
                      toolsSet={formData.tools}
                      setIntegrationTools={setIntegrationTools}
                      integration={integration}
                      searchTerm=""
                    />
                  ))}
                  {filteredIntegrations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No integrations found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedTab === "agents" && (
              <div className="space-y-4">
                <Input
                  placeholder="Search agents..."
                  value={agentsSearch}
                  onChange={(e) => setAgentsSearch(e.target.value)}
                  className="w-full"
                />
                
                {/* Agents counter and select all button */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {formData.agents.length} agents selected
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (formData.agents.length > 0) {
                        // Deselect all
                        setFormData(prev => ({ ...prev, agents: [] }));
                      } else {
                        // Select all
                        const allAgentIds = filteredAgents.map(agent => agent.id);
                        setFormData(prev => ({ ...prev, agents: allAgentIds }));
                      }
                    }}
                  >
                    {formData.agents.length > 0 ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                {formData.agents.some(agentId => {
                  const agent = agents.find(a => a.id === agentId);
                  const agentTools = agent?.tools_set || {};
                  return Object.keys(agentTools).some(integrationId => 
                    !formData.tools[integrationId] || formData.tools[integrationId].length === 0
                  );
                }) && (
                  <Alert variant="warning">
                    <Icon name="warning" className="h-4 w-4" />
                    <AlertDescription>
                      Some selected agents have tools that this role doesn't have access to. Those tools will be automatically added.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-col gap-2" style={{ maxWidth: 420 }}>
                  {filteredAgents.map(agent => (
                    <Card 
                      key={agent.id} 
                      className="w-full cursor-pointer"
                      onClick={() => handleAgentToggle(agent.id, !formData.agents.includes(agent.id))}
                    >
                      <CardContent className="flex items-start p-3 w-full">
                        <AgentAvatar url={agent.avatar} fallback={agent.name} size="base" />
                        <div className="flex flex-col items-start text-left leading-tight w-full min-w-0 ml-3 pr-3">
                          <span
                            className="truncate block text-sm font-medium text-foreground"
                            style={{ maxWidth: "300px" }}
                          >
                            {agent.name}
                          </span>
                          <span
                            className="block text-xs font-normal text-muted-foreground break-words whitespace-pre-line"
                            style={{ maxWidth: "300px", wordBreak: "break-word" }}
                          >
                            {agent.description || "No description"}
                          </span>
                        </div>
                        <div className="ml-auto flex items-start" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={formData.agents.includes(agent.id)}
                            onCheckedChange={(checked) => handleAgentToggle(agent.id, checked as boolean)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredAgents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No agents found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedTab === "members" && (
              <div className="space-y-4">
                <Input
                  placeholder="Search members..."
                  value={membersSearch}
                  onChange={(e) => setMembersSearch(e.target.value)}
                  className="w-full"
                />
                
                {/* Members counter and select all button */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {formData.members.length} members selected
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (formData.members.length > 0) {
                        // Deselect all
                        setFormData(prev => ({ ...prev, members: [] }));
                      } else {
                        // Select all
                        const allMemberIds = filteredMembers.map(member => member.user_id);
                        setFormData(prev => ({ ...prev, members: allMemberIds }));
                      }
                    }}
                  >
                    {formData.members.length > 0 ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div className="flex flex-col gap-2" style={{ maxWidth: 420 }}>
                  {filteredMembers.map(member => {
                    const memberCurrentRoles = member.roles || [];
                    
                    return (
                      <Card 
                        key={member.id} 
                        className="w-full cursor-pointer"
                        onClick={() => handleMemberToggle(member.user_id, !formData.members.includes(member.user_id))}
                      >
                        <CardContent className="flex items-start p-3 w-full">
                          <div className="flex flex-col w-full pr-3">
                            <RoleDialogUserInfo userId={member.user_id} />
                            {memberCurrentRoles.length > 0 && (
                              <div className="mt-2">
                                <span className="text-xs text-muted-foreground">
                                  Current roles: 
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {memberCurrentRoles.map((role) => (
                                    <Badge key={role.id} variant="outline" className="text-xs">
                                      {role.name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="ml-auto flex items-start" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={formData.members.includes(member.user_id)}
                              onCheckedChange={(checked) => handleMemberToggle(member.user_id, checked as boolean)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {filteredMembers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No members found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {role ? "Update Role" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Default roles configuration
const DEFAULT_ROLES = [
  {
    id: 1,
    name: "Admin",
    description: "Full access to all platform features and settings."
  },
  {
    id: 2,
    name: "Manager", 
    description: "Manages resources, agents, and integrations, but no access to billing."
  },
  {
    id: 3,
    name: "Builder",
    description: "Creates and maintains agents, integrations, and automations, without user or billing management."
  },
  {
    id: 4,
    name: "Member",
    description: "Collaborates in threads and uses agents and integrations, with no administrative permissions."
  }
];

function MembersViewContent() {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = team?.id;
  const { data: { members, invites } } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const removeMemberMutation = useRemoveTeamMember();
  const rejectInvite = useRejectInvite();
  const updateRoleMutation = useUpdateMemberRole();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const deferredQuery = useDeferredValue(query);
  const isMobile = useIsMobile();
  const user = useUser();
  const [tab, setTab] = useState<'members' | 'roles'>('members');
  const [rolesQuery, setRolesQuery] = useState("");
  const [rolesSortKey, setRolesSortKey] = useState<string>("role");
  const [rolesSortDirection, setRolesSortDirection] = useState<"asc" | "desc">("asc");
  const inviteTeamMember = useInviteTeamMember();
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const { data: agents = [] } = useAgents();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleDialogInitialTab, setRoleDialogInitialTab] = useState("general");
  const { data: integrations = [] } = useIntegrations();
  
  // Local state for roles management
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [editedDefaultRoles, setEditedDefaultRoles] = useState<any[]>(DEFAULT_ROLES);
  
  // Combined roles (edited defaults + custom)
  const allRoles = useMemo(() => [...editedDefaultRoles, ...customRoles], [editedDefaultRoles, customRoles]);

  // Convert members and invites to unified data structure
  const tableData: MemberTableRow[] = useMemo(() => {
    const memberRows: MemberTableRow[] = members.map((member) => ({
      type: "member" as const,
      id: member.id,
      name: getMemberName(member),
      email: member.profiles.email,
      roles: member.roles,
      lastActivity: member.lastActivity,
      avatarUrl: member.profiles.metadata.avatar_url,
      userId: member.user_id, // Add userId for UserInfo component
      member,
    }));

    const inviteRows: MemberTableRow[] = invites.map((invite) => ({
      type: "invite" as const,
      id: invite.id,
      name: invite.email,
      email: invite.email,
      roles: invite.roles,
      isPending: true,
      // No userId for invites since they haven't accepted yet
      invite,
    }));

    return [...inviteRows, ...memberRows];
  }, [members, invites]);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!deferredQuery) return tableData;
    return tableData.filter((row) =>
      row.name.toLowerCase().includes(deferredQuery.toLowerCase()) ||
      row.email.toLowerCase().includes(deferredQuery.toLowerCase())
    );
  }, [tableData, deferredQuery]);

  // Remove member
  const handleRemoveMember = async (memberId: number) => {
    if (!teamId) return;
    try {
      await removeMemberMutation.mutateAsync({
        teamId,
        memberId,
      });
    } catch (error) {
      console.error("Failed to remove team member:", error);
    }
  };

  // Update member role
  const handleUpdateMemberRole = async (
    userId: string,
    role: { id: number; name: string },
    checked: boolean,
  ) => {
    if (!teamId) return;
    try {
      await updateRoleMutation.mutateAsync({
        teamId,
        userId,
        roleId: role.id,
        roleName: role.name,
        action: checked ? "grant" : "revoke",
      });
      toast.success(
        checked ? "Role assigned successfully" : "Role removed successfully",
      );
    } catch (error) {
      toast.error(
        // deno-lint-ignore no-explicit-any
        typeof error === "object" && (error as any)?.message ||
          "Failed to update role",
      );
      console.error("Failed to update member role:", error);
    }
  };

  // Define table columns with updated role column
  const columns: TableColumn<MemberTableRow>[] = useMemo(() => {
    const baseColumns: TableColumn<MemberTableRow>[] = [
      {
        id: "name",
        header: "Name",
        render: (row) => {
          // For actual members, use the standardized UserInfo component
          if (row.type === "member" && row.userId) {
            return (
              <UserInfo
                userId={row.userId}
                showDetails
                maxWidth="250px"
              />
            );
          }

          // For pending invites, use custom implementation since they don't have userId yet
          return (
            <div className="flex gap-2 items-center min-w-[48px]">
              <UserAvatar
                fallback={row.email}
                size="sm"
                muted
              />
              <div className="flex flex-col items-start text-left leading-tight w-full">
                <span
                  className="truncate block text-xs font-medium text-foreground"
                  style={{ maxWidth: "250px" }}
                >
                  {row.email}
                </span>
                <span
                  className="truncate block text-xs font-normal text-muted-foreground"
                  style={{ maxWidth: "250px" }}
                >
                  Pending
                </span>
              </div>
            </div>
          );
        },
        sortable: true,
      },
            {
        id: "roles",
        header: "Roles",
        render: (row) => {
          if (row.type === "member" && row.member) {
            const selectedRoleIds = row.roles.map(r => r.id.toString());
            const roleOptions = allRoles.map(role => ({
              label: role.name,
              value: role.id.toString(),
            }));
            
            return (
              <MultiSelect
                options={roleOptions}
                defaultValue={selectedRoleIds}
                onValueChange={async (newValues) => {
                  // Find roles to add and remove
                  const currentRoleIds = row.roles.map(r => r.id.toString());
                  const rolesToAdd = newValues.filter(id => !currentRoleIds.includes(id));
                  const rolesToRemove = currentRoleIds.filter(id => !newValues.includes(id));
                  
                  // Process role changes
                  for (const roleId of rolesToAdd) {
                    const role = allRoles.find(r => r.id.toString() === roleId);
                    if (role) {
                      await handleUpdateMemberRole(row.member!.user_id, role, true);
                    }
                  }
                  
                  for (const roleId of rolesToRemove) {
                    const role = allRoles.find(r => r.id.toString() === roleId);
                    if (role) {
                      await handleUpdateMemberRole(row.member!.user_id, role, false);
                    }
                  }
                }}
                placeholder="Select roles"
                variant="secondary"
                className="min-w-[140px] max-w-[216px]"
                disabled={updateRoleMutation.isPending}
                maxCount={2}
              />
            );
          } else if (row.type === "invite" && row.invite) {
            const selectedRoleIds = row.invite.roles.map(r => r.id.toString());
            const roleOptions = allRoles.map(role => ({
              label: role.name,
              value: role.id.toString(),
            }));
            
            return (
              <MultiSelect
                options={roleOptions}
                defaultValue={selectedRoleIds}
                onValueChange={() => {}} // No-op for invites
                placeholder="Select roles"
                variant="secondary"
                className="min-w-[140px] max-w-[216px]"
                disabled={true}
                maxCount={2}
              />
            );
          }
          return null;
        },
        sortable: true,
      },
    ];

    // Add Last Activity column if not mobile
    if (!isMobile) {
      baseColumns.push({
        id: "lastActivity",
        header: "Last active",
        render: (row) => <ActivityStatusCell lastActivity={row.lastActivity} />,
        sortable: true,
      });
    }

    // Add actions column - keep existing implementation
    baseColumns.push({
      id: "actions",
      header: "",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <span className="sr-only">Open menu</span>
              <Icon name="more_horiz" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.type === "invite" && row.invite && (
              <DropdownMenuItem
                onClick={async () => {
                  setResendingInviteId(row.invite!.id.toString());
                  try {
                    if (!teamId) return;
                    await inviteTeamMember.mutateAsync({
                      teamId,
                      invitees: [
                        {
                          email: row.invite!.email,
                          roles: row.invite!.roles,
                        },
                      ],
                    });
                    toast.success("Invitation resent");
                  } catch (err) {
                    toast.error("Failed to resend invitation");
                  } finally {
                    setResendingInviteId(null);
                  }
                }}
                disabled={resendingInviteId === row.invite.id.toString() || inviteTeamMember.isPending}
              >
                <Icon name="mail" />
                {resendingInviteId === row.invite.id.toString() || inviteTeamMember.isPending ? "Resending..." : "Resend invite"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (row.type === "invite" && row.invite && teamId) {
                  rejectInvite.mutateAsync({
                    id: String(row.invite.id),
                    teamId,
                  });
                } else if (row.type === "member" && row.member) {
                  handleRemoveMember(row.member.id);
                }
              }}
              disabled={removeMemberMutation.isPending || rejectInvite.isPending}
            >
              {(() => {
                const isCurrentUser = row.type === "member" && row.userId &&
                  user && row.userId === user.id;

                if (row.type === "invite") {
                  return (
                    <>
                      <Icon name="delete" />
                      {rejectInvite.isPending &&
                          rejectInvite.variables?.id === row.id
                        ? "Removing..."
                        : "Delete invitation"}
                    </>
                  );
                } else if (isCurrentUser) {
                  return (
                    <>
                      <Icon name="waving_hand" />
                      {removeMemberMutation.isPending &&
                          removeMemberMutation.variables?.memberId === row.id
                        ? "Leaving..."
                        : "Leave team"}
                    </>
                  );
                } else {
                  return (
                    <>
                      <Icon name="waving_hand" />
                      {removeMemberMutation.isPending &&
                          removeMemberMutation.variables?.memberId === row.id
                        ? "Removing..."
                        : "Remove Member"}
                    </>
                  );
                }
              })()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });

    return baseColumns;
  }, [
    teamId,
    isMobile,
    user,
    handleUpdateMemberRole,
    updateRoleMutation.isPending,
    removeMemberMutation.isPending,
    rejectInvite.isPending,
    removeMemberMutation.variables,
    rejectInvite.variables,
    inviteTeamMember.isPending,
    resendingInviteId,
  ]);

  // Sorting logic
  function getSortValue(row: MemberTableRow, key: string): string {
    switch (key) {
      case "name":
        return row.name.toLowerCase();
      case "roles":
        return row.roles.map((r) => r.name).sort().join(",").toLowerCase();
      case "lastActivity":
        return row.lastActivity
          ? new Date(row.lastActivity).getTime().toString()
          : "0";
      default:
        return "";
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function handleRolesSort(key: string) {
    if (rolesSortKey === key) {
      setRolesSortDirection((prev) => prev === "asc" ? "desc" : "asc");
    } else {
      setRolesSortKey(key);
      setRolesSortDirection("asc");
    }
  }

  function getRoleSortValue(role: any, key: string): string {
    switch (key) {
      case "role":
        return role.name.toLowerCase();
      case "tools":
        const roleTools = role.tools || {};
        const toolCount = Object.values(roleTools).flat().length;
        return toolCount.toString().padStart(5, '0');
      case "agents":
        return (role.agents || []).length.toString().padStart(5, '0');
      case "members":
        return (role.members || []).length.toString().padStart(5, '0');
      default:
        return "";
    }
  }

  // Sort the filtered data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Toggle chiplets for ListPageHeader - use allRoles instead of DEFAULT_ROLES
  const toggleItems = [
    { id: 'members', label: 'Members', count: members.length + invites.length, active: tab === 'members' },
    { id: 'roles', label: 'Roles', count: allRoles.length, active: tab === 'roles' },
  ];

  // Roles table columns - updated to use DEFAULT_ROLES
  const rolesColumns = [
    {
      id: "role",
      header: "Role",
      render: (role: any) => (
        <div 
          className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            setEditingRole(role);
            setRoleDialogInitialTab("general");
            setRoleDialogOpen(true);
          }}
        >
          <span className="font-medium">{role.name}</span>
          <span className="text-xs text-muted-foreground">{role.description}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "tools",
      header: "Tools", 
      render: (role: any) => {
        const roleTools = role.tools || {};
        const integrationsWithTools = integrations.filter(integration => 
          roleTools[integration.id] && roleTools[integration.id].length > 0
        );
        
        if (integrationsWithTools.length === 0) {
          return (
            <span 
              className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors"
              onClick={() => {
                setEditingRole(role);
                setRoleDialogInitialTab("tools");
                setRoleDialogOpen(true);
              }}
            >
              No tools
            </span>
          );
        }
        
        return (
          <div 
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setEditingRole(role);
              setRoleDialogInitialTab("tools");
              setRoleDialogOpen(true);
            }}
          >
            <div className="flex -space-x-1">
              {integrationsWithTools.slice(0, 3).map((integration) => (
                <IntegrationAvatar
                  key={integration.id}
                  url={integration.icon}
                  fallback={integration.name}
                  size="sm"
                  className="border border-background"
                />
              ))}
            </div>
            {integrationsWithTools.length > 3 && (
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                +{integrationsWithTools.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "agents",
      header: "Agents",
      render: (role: any) => {
        const roleAgents = role.agents || [];
        const roleAgentsList = agents.filter(agent => roleAgents.includes(agent.id));
        
        if (roleAgentsList.length === 0) {
          return (
            <span 
              className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors"
              onClick={() => {
                setEditingRole(role);
                setRoleDialogInitialTab("agents");
                setRoleDialogOpen(true);
              }}
            >
              No agents
            </span>
          );
        }
        
        return (
          <div 
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setEditingRole(role);
              setRoleDialogInitialTab("agents");
              setRoleDialogOpen(true);
            }}
          >
            <div className="flex -space-x-1">
              {roleAgentsList.slice(0, 3).map((agent) => (
                <AgentAvatar
                  key={agent.id}
                  url={agent.avatar}
                  fallback={agent.name}
                  size="sm"
                  className="border border-background"
                />
              ))}
            </div>
            {roleAgentsList.length > 3 && (
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                +{roleAgentsList.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "members",
      header: "Members",
      render: (role: any) => {
        const roleMembers = role.members || [];
        const roleMembersList = members.filter(member => 
          roleMembers.includes(member.profiles.id)
        );
        
        if (roleMembersList.length === 0) {
          return (
            <span 
              className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors"
              onClick={() => {
                setEditingRole(role);
                setRoleDialogInitialTab("members");
                setRoleDialogOpen(true);
              }}
            >
              No members
            </span>
          );
        }
        
        return (
          <div 
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setEditingRole(role);
              setRoleDialogInitialTab("members");
              setRoleDialogOpen(true);
            }}
          >
            <div className="flex -space-x-1">
              {roleMembersList.slice(0, 3).map((member) => (
                <UserAvatar
                  key={member.profiles.id}
                  url={member.profiles.metadata.avatar_url}
                  fallback={member.profiles.metadata.full_name || member.profiles.email}
                  size="sm"
                  className="border border-background"
                />
              ))}
            </div>
            {roleMembersList.length > 3 && (
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                +{roleMembersList.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      render: (role: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Icon name="more_horiz" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => {
                setEditingRole(role);
                setRoleDialogOpen(true);
              }}
            >
              <Icon name="edit" />
              Edit role
            </DropdownMenuItem>
            <DropdownMenuItem 
              variant="destructive"
              disabled={DEFAULT_ROLES.some(r => r.id === role.id)}
              onClick={() => {
                if (!DEFAULT_ROLES.some(r => r.id === role.id)) {
                  setCustomRoles(prev => prev.filter(r => r.id !== role.id));
                  toast.success("Role deleted successfully");
                }
              }}
            >
              <Icon name="delete" />
              Delete role
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Filter roles based on search - use allRoles
  const filteredRoles = allRoles.filter(role => 
    role.name.toLowerCase().includes(rolesQuery.toLowerCase())
  );

  // Sort the filtered roles
  const sortedRoles = [...filteredRoles].sort((a, b) => {
    const aValue = getRoleSortValue(a, rolesSortKey);
    const bValue = getRoleSortValue(b, rolesSortKey);
    
    if (rolesSortDirection === "asc") {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  // Remove the updatedColumns mapping since we're using the main columns directly now

  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <ListPageHeader
          filter={{
            items: toggleItems,
            onClick: (item) => setTab(item.id as 'members' | 'roles'),
          }}
        />
        {tab === 'members' ? (
          <>
            <MemberTableHeader onChange={setQuery} teamId={teamId} />
            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No members found. Add team members to get started.
              </div>
            ) : (
              <Table
                columns={columns}
                data={sortedData}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Input
                placeholder="Search roles..."
                value={rolesQuery}
                onChange={(e) => setRolesQuery(e.target.value)}
                className="w-80"
              />
              <Button onClick={() => {
                setEditingRole(null);
                setRoleDialogOpen(true);
              }}>
                <Icon name="add" />
                Add Role
              </Button>
            </div>
            {filteredRoles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No roles found.
              </div>
            ) : (
              <Table
                columns={rolesColumns}
                data={sortedRoles}
                sortKey={rolesSortKey}
                sortDirection={rolesSortDirection}
                onSort={handleRolesSort}
              />
            )}
          </div>
        )}
      </div>
      
      <AddRoleDialog 
        open={roleDialogOpen} 
        onOpenChange={(open) => {
          setRoleDialogOpen(open);
          if (!open) {
            setEditingRole(null);
            setRoleDialogInitialTab("general");
          }
        }}
        role={editingRole}
        teamId={teamId}
        initialTab={roleDialogInitialTab}
        onSave={(roleData, isEditing) => {
          if (isEditing && editingRole) {
            // Editing existing role
            if (DEFAULT_ROLES.some(r => r.id === editingRole.id)) {
              // Editing default role
              setEditedDefaultRoles(prev => 
                prev.map(role => 
                  role.id === editingRole.id 
                    ? { ...role, ...roleData }
                    : role
                )
              );
            } else {
              // Editing custom role
              setCustomRoles(prev => 
                prev.map(role => 
                  role.id === editingRole.id 
                    ? { ...role, ...roleData }
                    : role
                )
              );
            }
          } else {
            // Creating new role
            const newRole = {
              id: Date.now(), // Simple ID generation for demo
              ...roleData,
            };
            setCustomRoles(prev => [...prev, newRole]);
          }
          setEditingRole(null);
        }}
      />
    </div>
  );
}



export default function MembersSettings() {
  return (
    <ScrollArea className="h-full text-foreground">
      <Suspense fallback={<MembersViewLoading />}>
        <MembersViewContent />
      </Suspense>
    </ScrollArea>
  );
}
