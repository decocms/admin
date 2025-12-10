import React, { useState } from "react";
import { Icon } from "../atoms/Icon";

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: string;
}

export function Accordion({
  title,
  children,
  defaultOpen = false,
  icon = "Bolt",
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="accordion my-6 border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between cursor-pointer p-4 text-left hover:bg-muted transition-colors h-full"
      >
        <div className="flex items-center gap-2">
          <Icon name={icon} size={16} className="text-foreground" />
          <span className="text-foreground font-normal">{title}</span>
        </div>
        <Icon
          name={isOpen ? "ChevronDown" : "ChevronRight"}
          size={16}
          className="text-foreground transition-transform duration-200"
        />
      </button>
      {isOpen && (
        <div className="px-4 py-4">
          <div className="text-muted-foreground">{children}</div>
        </div>
      )}
    </div>
  );
}
