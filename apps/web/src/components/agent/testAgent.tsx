import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ChatInput } from "../chat/ChatInput.tsx";
import { ChatMessages } from "../chat/ChatMessages.tsx";
import { togglePanel } from "../dock/index.tsx";

export default function TestAgent() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
        <h2 className="text-sm font-medium">Test agent</h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="p-1 w-8 h-8"
            size="icon"
            onClick={() => {
              // TODO: Implement new thread creation
            }}
          >
            <Icon name="chat_add_on" size={20} />
          </Button>
          <Button 
            variant="ghost" 
            className="p-1 w-8 h-8"
            size="icon" 
            onClick={() => togglePanel({ id: "testAgent", component: "testAgent", title: "Test Agent" })}
          >
            <Icon name="close" size={12} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ChatMessages />
      </div>
      <ChatInput />
    </div>
  );
} 