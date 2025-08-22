import React from "react";
import { Workflow } from "lucide-react";
import { EmptyState } from "../common/empty-state.tsx";

export default function CheckoutFlowView() {
  return (
    <div className="p-6">
      <EmptyState
        icon={() => <Workflow className="w-12 h-12 text-muted-foreground" />}
        title="Checkout Flow View"
        description="This view manages the complete checkout process flow. Configure payment methods, shipping options, and order confirmation."
        buttonProps={{
          children: "Configure View",
          onClick: () => console.log("Configure Checkout Flow"),
        }}
      />
    </div>
  );
}
