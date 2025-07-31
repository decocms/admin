import React from "react";

interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Step({ number, title, children, className = "" }: StepProps) {
  return (
    <div className={`flex gap-4 mt-8 ${className}`}>
      {/* Numbered badge */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center relative z-10">
        <span className="text-sm font-medium text-foreground">{number}</span>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <div className="text-lg font-semibold text-foreground mb-3 m-0 not-prose">
          {title}
        </div>

        {/* Content */}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
