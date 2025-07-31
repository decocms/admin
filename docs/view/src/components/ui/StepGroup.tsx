import React from "react";

interface StepGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function StepGroup({ children, className = "" }: StepGroupProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Connecting line */}
      <div className="absolute left-4 top-4 bottom-0 w-px bg-border" />

      {/* Steps container */}
      <div className="space-y-8">{children}</div>
    </div>
  );
}
