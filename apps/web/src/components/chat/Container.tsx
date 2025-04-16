import { ReactNode } from "react";

export function ChatContainer({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[800px] mx-auto overflow-y-auto px-4 py-2">
      {children}
    </div>
  );
}
