import { createContext, useContext, useState, type ReactNode } from "react";

export type OnboardingStep = "document" | "database" | "view" | "agent" | "workflow";

export interface OnboardingState {
  isActive: boolean;
  currentStep: OnboardingStep;
  completedSteps: Set<OnboardingStep>;
  userInput: string;
}

export interface OnboardingContextValue {
  state: OnboardingState;
  startOnboarding: () => void;
  completeStep: (step: OnboardingStep) => void;
  setCurrentStep: (step: OnboardingStep) => void;
  setUserInput: (input: string) => void;
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const INITIAL_STATE: OnboardingState = {
  isActive: false,
  currentStep: "document",
  completedSteps: new Set(),
  userInput: "",
};

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);

  const startOnboarding = () => {
    setState({
      ...INITIAL_STATE,
      isActive: true,
    });
  };

  const completeStep = (step: OnboardingStep) => {
    setState((prev) => ({
      ...prev,
      completedSteps: new Set([...prev.completedSteps, step]),
    }));
  };

  const setCurrentStep = (step: OnboardingStep) => {
    setState((prev) => ({
      ...prev,
      currentStep: step,
    }));
  };

  const setUserInput = (input: string) => {
    setState((prev) => ({
      ...prev,
      userInput: input,
    }));
  };

  const resetOnboarding = () => {
    setState(INITIAL_STATE);
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        startOnboarding,
        completeStep,
        setCurrentStep,
        setUserInput,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}

