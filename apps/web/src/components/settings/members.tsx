import { Button } from "@deco/ui/components/button.tsx";
import { useState } from "react";
import { Avatar } from "../common/Avatar.tsx";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
  avatar?: string;
};

const MOCK_MEMBERS: Member[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    role: "admin",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "member",
  },
  {
    id: "3",
    name: "Bob Johnson",
    email: "bob@example.com",
    role: "viewer",
  },
];

export default function MembersSettings() {
  const [members] = useState<Member[]>(MOCK_MEMBERS);

  return (
    <div className="container h-full max-w-7xl">
      <SettingsMobileHeader currentPage="members" />

      <div className="py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-muted-foreground">
            Manage team members and their permissions
          </p>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              {members.length} members in your workspace
            </p>
          </div>
          <Button>Invite Member</Button>
        </div>

        <div className="border rounded-md">
          <div className="grid grid-cols-4 gap-4 p-4 font-medium border-b">
            <div>User</div>
            <div>Email</div>
            <div>Role</div>
            <div className="text-right">Actions</div>
          </div>

          {members.map((member) => (
            <div
              key={member.id}
              className="grid grid-cols-4 gap-4 p-4 items-center border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                <Avatar
                  url={member.avatar}
                  fallback={member.name}
                  className="w-8 h-8"
                />
                <span>{member.name}</span>
              </div>
              <div>{member.email}</div>
              <div className="capitalize">{member.role}</div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm">
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive">
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
