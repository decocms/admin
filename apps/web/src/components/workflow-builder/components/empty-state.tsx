import { Plus, Sparkles } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";

interface EmptyStateProps {
  onCreateStep: () => void;
}

export function EmptyState({ onCreateStep }: EmptyStateProps) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-gray-400" />
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-gray-900">
          Start Building Your Workflow
        </h2>
        <p className="text-lg text-gray-600">
          Create your first step by describing what you want to accomplish. Our
          AI will generate the code for you.
        </p>
      </div>

      <div className="space-y-4">
        <Button size="lg" onClick={onCreateStep} className="min-w-[200px]">
          <Plus className="w-5 h-5 mr-2" />
          Create First Step
        </Button>

        <div className="text-sm text-gray-500">
          <p>Or use keyboard shortcut</p>
          <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
            N
          </kbd>
        </div>
      </div>

      <div className="pt-8 border-t">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Examples to get started:
        </h3>
        <div className="grid gap-3 text-left max-w-md mx-auto">
          <button
            onClick={onCreateStep}
            className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            <span className="font-medium">Send a welcome email</span>
            <p className="text-gray-600 text-xs mt-1">
              When a new user signs up, send them a personalized welcome message
            </p>
          </button>
          <button
            onClick={onCreateStep}
            className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            <span className="font-medium">Process form submission</span>
            <p className="text-gray-600 text-xs mt-1">
              Validate data, store in database, and notify the team
            </p>
          </button>
          <button
            onClick={onCreateStep}
            className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            <span className="font-medium">Sync data between tools</span>
            <p className="text-gray-600 text-xs mt-1">
              Keep information updated across multiple platforms
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
