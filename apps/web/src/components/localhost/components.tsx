import React from "react";
import { LayoutGrid } from "lucide-react";
import { EmptyState } from "../common/empty-state.tsx";

export default function ProductCatalogView() {
  return (
    <div className="p-6">
      <EmptyState
        icon={() => <LayoutGrid className="w-12 h-12 text-muted-foreground" />}
        title="Product Catalog View"
        description="This view displays and manages your e-commerce product catalog. Configure products, categories, and inventory here."
        buttonProps={{
          children: "Configure View",
          onClick: () => console.log("Configure Product Catalog"),
        }}
      />
    </div>
  );
}
