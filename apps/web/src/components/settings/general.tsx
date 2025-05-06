import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import { useState } from "react";
import { useUser } from "../../hooks/data/useUser.ts";
import { useParams } from "react-router";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";

export default function GeneralSettings() {
  const { teamSlug } = useParams();
  const user = useUser();
  const [workspaceName, setWorkspaceName] = useState(teamSlug || user?.metadata?.full_name || "");
  const [notifications, setNotifications] = useState(true);

  const handleSave = () => {
    // Implement save functionality here
    console.log("Saving general settings:", { workspaceName, notifications });
  };

  return (
    <div className="container h-full max-w-7xl">
      <SettingsMobileHeader currentPage="general" />
      
      <div className="py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your workspace settings and preferences
          </p>
        </div>
        
        <div className="flex flex-col gap-8">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Workspace Information</h3>
              <p className="text-sm text-muted-foreground">
                Configure your workspace identity and preferences.
              </p>
            </div>
            
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Enter workspace name"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Configure your notification preferences.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="notifications" 
                checked={notifications} 
                onCheckedChange={setNotifications} 
              />
              <Label htmlFor="notifications">Enable email notifications</Label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 