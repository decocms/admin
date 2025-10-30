import { Badge } from "@deco/ui/components/badge.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

interface StatusBadgeProps {
  status: "active" | "inactive" | "error" | "pending";
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants = {
    active: "bg-green-500/10 text-green-600 hover:bg-green-500/20",
    inactive: "bg-muted text-muted-foreground hover:bg-muted",
    error: "bg-red-500/10 text-red-600 hover:bg-red-500/20",
    pending: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20",
  };

  return (
    <Badge variant="secondary" className={cn(variants[status], className)}>
      {status}
    </Badge>
  );
}

interface MetricCellProps {
  value: number | string;
  suffix?: string;
  className?: string;
}

export function MetricCell({ value, suffix, className }: MetricCellProps) {
  return (
    <span className={cn("font-mono text-sm tabular-nums", className)}>
      {value}
      {suffix && <span className="text-muted-foreground ml-0.5">{suffix}</span>}
    </span>
  );
}

interface VendorBadgeProps {
  vendor: string;
  className?: string;
}

export function VendorBadge({ vendor, className }: VendorBadgeProps) {
  const isExternal = vendor.toLowerCase() === "external";
  const isDeco = vendor.toLowerCase().includes("deco");
  
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        isExternal && "border-blue-200 text-blue-700 bg-blue-50",
        isDeco && "border-primary/20 text-primary bg-primary/5",
        className
      )}
    >
      {vendor}
    </Badge>
  );
}

// Mock data generator for metrics
export function generateMockMetrics(seed: string) {
  // Simple hash function for deterministic values
  const hash = seed.split("").reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  
  const calls = Math.abs(hash % 5000) + 100;
  const errors = Math.abs(hash % 50);
  const latency = Math.abs(hash % 300) + 20;
  
  return {
    calls,
    errors,
    latency,
    errorRate: calls > 0 ? ((errors / calls) * 100).toFixed(2) : "0.00",
  };
}

