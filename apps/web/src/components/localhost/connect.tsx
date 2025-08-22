import React from "react";
import { LineChart } from "lucide-react";
import { EmptyState } from "../common/empty-state.tsx";

export default function AdminDashboardView() {
  return (
    <div className="p-6">
      <EmptyState
        icon={() => <LineChart className="w-12 h-12 text-muted-foreground" />}
        title="Admin Dashboard View"
        description="This view provides administrative insights and controls for your e-commerce platform. Monitor sales, users, and system health."
        buttonProps={{
          children: "Configure View",
          onClick: () => console.log("Configure Admin Dashboard"),
        }}
      />
    </div>
  );
}
