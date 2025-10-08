import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { type OnboardingStep, useOnboarding } from "./context.tsx";

interface StepConfig {
  id: OnboardingStep;
  label: string;
  icon: string;
  description: string;
}

const STEPS: StepConfig[] = [
  {
    id: "document",
    label: "Document",
    icon: "docs",
    description: "Create a PRD with AI assistance",
  },
  {
    id: "database",
    label: "Database",
    icon: "database",
    description: "Define your data models",
  },
  {
    id: "view",
    label: "View",
    icon: "grid_view",
    description: "Design the UI/UX",
  },
  {
    id: "agent",
    label: "Agent",
    icon: "robot_2",
    description: "Configure AI agents",
  },
  {
    id: "workflow",
    label: "Workflow",
    icon: "flowchart",
    description: "Build automation",
  },
];

export function OnboardingStepsSidebar() {
  const { state } = useOnboarding();

  return (
    <div className="w-64 border-r border-border bg-background/50 p-6">
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Getting Started</h2>
        <p className="text-sm text-muted-foreground">
          Let's build your AI application together
        </p>
      </div>

      <div className="space-y-1">
        {STEPS.map((step, index) => {
          const isCompleted = state.completedSteps.has(step.id);
          const isCurrent = state.currentStep === step.id;
          const isUpcoming = !isCompleted && !isCurrent;

          return (
            <div
              key={step.id}
              className={cn(
                "relative flex items-start gap-3 p-3 rounded-lg transition-colors",
                isCurrent && "bg-accent",
                isCompleted && "opacity-75",
              )}
            >
              {/* Step number or checkmark */}
              <div
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0",
                  isCompleted &&
                    "bg-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary/20 text-primary border-2 border-primary",
                  isUpcoming &&
                    "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <Icon name="check" size={14} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "flex items-center gap-2 mb-1",
                    isCurrent && "font-semibold",
                  )}
                >
                  <Icon
                    name={step.icon}
                    size={16}
                    className={cn(
                      "text-muted-foreground",
                      isCurrent && "text-primary",
                    )}
                  />
                  <span className="text-sm truncate">{step.label}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

