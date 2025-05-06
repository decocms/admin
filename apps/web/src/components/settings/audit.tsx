import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@deco/ui/components/select.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";

type AuditLogType = "all" | "login" | "agent" | "integration" | "settings";
type AuditLogEvent = {
  id: string;
  user: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
  type: AuditLogType;
};

const MOCK_AUDIT_LOGS: AuditLogEvent[] = [
  {
    id: "1",
    user: "john@example.com",
    action: "Login",
    resource: "System",
    details: "Successful login from 192.168.1.1",
    timestamp: "2023-09-12T14:32:10Z",
    type: "login",
  },
  {
    id: "2",
    user: "john@example.com",
    action: "Created",
    resource: "Agent",
    details: "Created new agent 'Customer Support'",
    timestamp: "2023-09-11T11:20:05Z",
    type: "agent",
  },
  {
    id: "3",
    user: "jane@example.com",
    action: "Updated",
    resource: "Integration",
    details: "Updated Google Sheets integration",
    timestamp: "2023-09-10T09:15:40Z",
    type: "integration",
  },
  {
    id: "4",
    user: "admin@example.com",
    action: "Invited",
    resource: "User",
    details: "Invited bob@example.com to the workspace",
    timestamp: "2023-09-09T16:45:22Z",
    type: "settings",
  },
  {
    id: "5",
    user: "admin@example.com",
    action: "Changed",
    resource: "Settings",
    details: "Changed workspace name to 'Acme Inc'",
    timestamp: "2023-09-08T13:12:54Z",
    type: "settings",
  },
];

export default function AuditSettings() {
  const [logs] = useState<AuditLogEvent[]>(MOCK_AUDIT_LOGS);
  const [filterType, setFilterType] = useState<AuditLogType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLogs = logs.filter((log) => {
    // Filter by type if not "all"
    if (filterType !== "all" && log.type !== filterType) {
      return false;
    }
    
    // Filter by search query if not empty
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.user.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.resource.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  return (
    <div className="container h-full max-w-7xl">
      <SettingsMobileHeader currentPage="audit" />
      
      <div className="py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="text-muted-foreground">
            View a record of all activities in your workspace
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center gap-4 mb-6">
              <div className="flex-1">
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-40">
                <Select value={filterType} onValueChange={(value) => setFilterType(value as AuditLogType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="integration">Integration</SelectItem>
                    <SelectItem value="settings">Settings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon">
                <Icon name="download" />
              </Button>
            </div>

            {filteredLogs.length > 0 ? (
              <div className="border rounded-md">
                <div className="grid grid-cols-5 gap-4 p-4 font-medium border-b">
                  <div>User</div>
                  <div>Action</div>
                  <div>Resource</div>
                  <div>Details</div>
                  <div>Timestamp</div>
                </div>

                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="grid grid-cols-5 gap-4 p-4 items-center border-b last:border-0"
                  >
                    <div className="truncate">{log.user}</div>
                    <div>{log.action}</div>
                    <div>{log.resource}</div>
                    <div className="truncate">{log.details}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Icon name="search_off" size={36} className="mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No matching logs found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 