import React from "react";

interface AccordionGroupProps {
  children: React.ReactNode;
}

export function AccordionGroup({ children }: AccordionGroupProps) {
  return (
    <div className="accordion-group my-6 border border-border rounded-xl overflow-hidden">
      {children}
    </div>
  );
}
