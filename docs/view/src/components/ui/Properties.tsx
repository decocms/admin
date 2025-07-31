import React, { useState } from "react";
import { Icon } from "../atoms/Icon";

interface Property {
  name: string;
  type: string;
  description: string;
}

interface PropertiesProps {
  properties: Property[];
  title?: string;
}

export function Properties({
  properties,
  title = "Properties",
}: PropertiesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="properties my-6 relative rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left cursor-pointer hover:bg-muted transition-colors"
      >
        <span className="text-foreground text-sm">{title}</span>
        <Icon
          name={isExpanded ? "ChevronDown" : "ChevronRight"}
          size={16}
          className="text-foreground transition-transform duration-200"
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-4">
          <div className="space-y-4">
            {properties.map((property, index) => (
              <div key={index}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="text-primary text-sm font-mono tracking-tight">
                      {property.name}
                    </code>
                    <span className="bg-muted px-2 py-px rounded-md text-muted-foreground font-mono text-xs">
                      {property.type}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {property.description}
                  </p>
                </div>
                {index < properties.length - 1 && (
                  <div className="border-t border-border mt-4" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
