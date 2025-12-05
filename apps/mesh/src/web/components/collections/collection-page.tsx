import type { ReactNode } from "react";

interface CollectionPageProps {
  children: ReactNode;
}

export function CollectionPage({ children }: CollectionPageProps) {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {children}
    </div>
  );
}
