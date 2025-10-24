import { memo } from "react";
import { getStatusBadgeVariant } from "../../workflows/utils";
import { Badge } from "@deco/ui/components/badge.tsx";

interface StepStatusBadgeProps {
  status: string;
}

export const StepStatusBadge = memo(function StepStatusBadge({
  status,
}: StepStatusBadgeProps) {
  return (
    <Badge
      variant={getStatusBadgeVariant(status)}
      className="capitalize text-xs shrink-0"
    >
      {status}
    </Badge>
  );
});
