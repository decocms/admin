import type { Agent } from "@deco/sdk";
import { AgentAvatar } from "../common/Avatar.tsx";

export function Welcome({ agent }: { agent?: Agent }) {
  return (
    <div className="h-full flex flex-col justify-between py-12">
      <div className="flex flex-col items-center justify-center max-w-[800px] mx-auto p-4 duration-300 transition-all">
        <div className="flex flex-col items-center gap-6 mb-6">
          <div className="w-16 h-16 flex items-center justify-center ">
            <AgentAvatar agent={agent} variant="xl" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-3xl font-medium text-slate-800">
              {agent?.name
                ? `Hello, I'm ${agent.name}`
                : "Tell me who I am and how I should be"}
            </h2>
            <p className="text-slate-500 mx-6">
              {agent?.description ?? "The more you share, the better I get."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
