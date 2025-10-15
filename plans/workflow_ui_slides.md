# Workflow UI - Slide-Based Linear Canvas Implementation

## Overview

Replace React Flow with a custom slide-based UI that provides a linear,
presentation-style workflow editing experience. Each step is a full-screen slide
that users navigate horizontally.

## Architecture

### Visual Design

```
┌────────────────────────────────────────────────────────────────────┐
│                         Top Bar (Fixed)                            │
│  [← Back] Workflow Name                    [New] [Share] [Save]    │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                      Current Step (Full Screen)                    │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐     │
│   │                                                         │     │
│   │                    Step Content Area                   │     │
│   │                                                         │     │
│   │   • Title                                             │     │
│   │   • Description                                       │     │
│   │   • Prompt                                           │     │
│   │   • Generated Code (collapsible)                     │     │
│   │   • Execution Result (when available)                │     │
│   │                                                         │     │
│   │                   [Edit Step] [Test Step]            │     │
│   │                                                         │     │
│   └─────────────────────────────────────────────────────────┐     │
│                                                                     │
├────────────────────────────────────────────────────────────────────┤
│                    Navigation Bar (Fixed)                          │
│  [◀] Step 1 | Step 2 | [Step 3] | Step 4 | + Add Step [▶]        │
├────────────────────────────────────────────────────────────────────┤
│                 Developer Bar (Collapsible)                        │
│  Execution State | Configuration | Logs | Debug                    │
└────────────────────────────────────────────────────────────────────┘
```

## State Management with useReducer + Context

### 1. Workflow Context & Reducer

**File**: `apps/web/src/contexts/workflow-context.tsx`

```typescript
import { createContext, ReactNode, useContext, useReducer } from "react";
import type { StepExecutionResult, Workflow, WorkflowStep } from "@deco/sdk";

// ============= State Types =============

interface WorkflowState {
  // Core workflow data
  workflow: Workflow;

  // UI state
  currentStepIndex: number;
  isEditing: boolean;
  editingStepId: string | null;

  // Execution state
  isExecuting: boolean;
  executionResults: Record<string, StepExecutionResult>;

  // Developer tools
  showDevBar: boolean;
  devBarTab: "state" | "config" | "logs" | "debug";

  // Workflow metadata
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: string | null;

  // Error handling
  error: string | null;
}

// ============= Action Types =============

type WorkflowAction =
  | { type: "SET_WORKFLOW"; payload: Workflow }
  | { type: "ADD_STEP"; payload: WorkflowStep }
  | {
    type: "UPDATE_STEP";
    payload: { stepId: string; updates: Partial<WorkflowStep> };
  }
  | { type: "DELETE_STEP"; payload: string }
  | { type: "REORDER_STEPS"; payload: { from: number; to: number } }
  | { type: "NAVIGATE_TO_STEP"; payload: number }
  | { type: "NEXT_STEP" }
  | { type: "PREVIOUS_STEP" }
  | { type: "START_EDITING"; payload: string | null }
  | { type: "STOP_EDITING" }
  | { type: "START_EXECUTION"; payload: string }
  | {
    type: "EXECUTION_COMPLETE";
    payload: { stepId: string; result: StepExecutionResult };
  }
  | { type: "EXECUTION_ERROR"; payload: { stepId: string; error: string } }
  | { type: "TOGGLE_DEV_BAR" }
  | { type: "SET_DEV_TAB"; payload: "state" | "config" | "logs" | "debug" }
  | { type: "MARK_DIRTY" }
  | { type: "MARK_CLEAN" }
  | { type: "START_SAVING" }
  | { type: "SAVE_COMPLETE"; payload: string }
  | { type: "SAVE_ERROR"; payload: string }
  | { type: "SET_ERROR"; payload: string | null };

// ============= Reducer =============

function workflowReducer(
  state: WorkflowState,
  action: WorkflowAction,
): WorkflowState {
  switch (action.type) {
    case "SET_WORKFLOW":
      return {
        ...state,
        workflow: action.payload,
        currentStepIndex: 0,
        isDirty: false,
      };

    case "ADD_STEP": {
      const newStep = action.payload;
      const insertIndex = state.currentStepIndex + 1;
      const newSteps = [
        ...state.workflow.steps.slice(0, insertIndex),
        newStep,
        ...state.workflow.steps.slice(insertIndex),
      ];

      return {
        ...state,
        workflow: {
          ...state.workflow,
          steps: newSteps,
          updatedAt: new Date().toISOString(),
        },
        currentStepIndex: insertIndex,
        isDirty: true,
      };
    }

    case "UPDATE_STEP": {
      const { stepId, updates } = action.payload;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.map((step) =>
            step.id === stepId ? { ...step, ...updates } : step
          ),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }

    case "DELETE_STEP": {
      const stepId = action.payload;
      const stepIndex = state.workflow.steps.findIndex((s) => s.id === stepId);

      return {
        ...state,
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.filter((s) => s.id !== stepId),
          updatedAt: new Date().toISOString(),
        },
        currentStepIndex: Math.min(
          state.currentStepIndex,
          state.workflow.steps.length - 2,
        ),
        isDirty: true,
      };
    }

    case "NAVIGATE_TO_STEP":
      return {
        ...state,
        currentStepIndex: Math.max(
          0,
          Math.min(action.payload, state.workflow.steps.length),
        ),
      };

    case "NEXT_STEP":
      return {
        ...state,
        currentStepIndex: Math.min(
          state.currentStepIndex + 1,
          state.workflow.steps.length,
        ),
      };

    case "PREVIOUS_STEP":
      return {
        ...state,
        currentStepIndex: Math.max(0, state.currentStepIndex - 1),
      };

    case "START_EDITING":
      return {
        ...state,
        isEditing: true,
        editingStepId: action.payload,
      };

    case "STOP_EDITING":
      return {
        ...state,
        isEditing: false,
        editingStepId: null,
      };

    case "START_EXECUTION":
      return {
        ...state,
        isExecuting: true,
      };

    case "EXECUTION_COMPLETE":
      return {
        ...state,
        isExecuting: false,
        executionResults: {
          ...state.executionResults,
          [action.payload.stepId]: action.payload.result,
        },
        workflow: {
          ...state.workflow,
          executionState: {
            ...state.workflow.executionState,
            [action.payload.stepId]: action.payload.result,
          },
        },
      };

    case "TOGGLE_DEV_BAR":
      return {
        ...state,
        showDevBar: !state.showDevBar,
      };

    case "SET_DEV_TAB":
      return {
        ...state,
        devBarTab: action.payload,
      };

    case "MARK_DIRTY":
      return { ...state, isDirty: true };

    case "MARK_CLEAN":
      return { ...state, isDirty: false };

    case "START_SAVING":
      return { ...state, isSaving: true };

    case "SAVE_COMPLETE":
      return {
        ...state,
        isSaving: false,
        isDirty: false,
        lastSaved: action.payload,
        error: null,
      };

    case "SAVE_ERROR":
      return {
        ...state,
        isSaving: false,
        error: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
}

// ============= Context Provider =============

interface WorkflowContextValue {
  state: WorkflowState;
  dispatch: React.Dispatch<WorkflowAction>;

  // Computed values
  currentStep: WorkflowStep | null;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  totalSteps: number;

  // Helper functions
  navigateToStep: (index: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  addStep: (step: WorkflowStep) => void;
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  deleteStep: (stepId: string) => void;
  startEditing: (stepId?: string) => void;
  stopEditing: () => void;
  executeStep: (stepId: string) => Promise<void>;
  saveWorkflow: () => Promise<void>;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowProvider({
  children,
  initialWorkflow,
}: {
  children: ReactNode;
  initialWorkflow: Workflow;
}) {
  const [state, dispatch] = useReducer(workflowReducer, {
    workflow: initialWorkflow,
    currentStepIndex: 0,
    isEditing: false,
    editingStepId: null,
    isExecuting: false,
    executionResults: initialWorkflow.executionState || {},
    showDevBar: false,
    devBarTab: "state",
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    error: null,
  });

  // Computed values
  const currentStep = state.workflow.steps[state.currentStepIndex] || null;
  const canNavigateBack = state.currentStepIndex > 0;
  const canNavigateForward =
    state.currentStepIndex < state.workflow.steps.length;
  const totalSteps = state.workflow.steps.length;

  // Helper functions
  const navigateToStep = (index: number) => {
    dispatch({ type: "NAVIGATE_TO_STEP", payload: index });
  };

  const nextStep = () => dispatch({ type: "NEXT_STEP" });
  const previousStep = () => dispatch({ type: "PREVIOUS_STEP" });

  const addStep = (step: WorkflowStep) => {
    dispatch({ type: "ADD_STEP", payload: step });
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    dispatch({ type: "UPDATE_STEP", payload: { stepId, updates } });
  };

  const deleteStep = (stepId: string) => {
    dispatch({ type: "DELETE_STEP", payload: stepId });
  };

  const startEditing = (stepId?: string) => {
    dispatch({ type: "START_EDITING", payload: stepId || null });
  };

  const stopEditing = () => {
    dispatch({ type: "STOP_EDITING" });
  };

  const executeStep = async (stepId: string) => {
    dispatch({ type: "START_EXECUTION", payload: stepId });

    try {
      // TODO: Call actual execution API
      const result: StepExecutionResult = {
        executedAt: new Date().toISOString(),
        value: { success: true },
        duration: 1000,
      };

      dispatch({
        type: "EXECUTION_COMPLETE",
        payload: { stepId, result },
      });
    } catch (error) {
      dispatch({
        type: "EXECUTION_ERROR",
        payload: {
          stepId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  };

  const saveWorkflow = async () => {
    dispatch({ type: "START_SAVING" });

    try {
      // TODO: Call save API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      dispatch({
        type: "SAVE_COMPLETE",
        payload: new Date().toISOString(),
      });
    } catch (error) {
      dispatch({
        type: "SAVE_ERROR",
        payload: error instanceof Error ? error.message : "Save failed",
      });
    }
  };

  const value: WorkflowContextValue = {
    state,
    dispatch,
    currentStep,
    canNavigateBack,
    canNavigateForward,
    totalSteps,
    navigateToStep,
    nextStep,
    previousStep,
    addStep,
    updateStep,
    deleteStep,
    startEditing,
    stopEditing,
    executeStep,
    saveWorkflow,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflowContext() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflowContext must be used within WorkflowProvider");
  }
  return context;
}
```

## UI Components

### 2. Main Slide Canvas

**File**: `apps/web/src/components/workflow-builder/slide-canvas.tsx`

```typescript
import {
  useWorkflowContext,
  WorkflowProvider,
} from "@/contexts/workflow-context";
import { TopBar } from "./components/top-bar";
import { StepSlide } from "./components/step-slide";
import { NavigationBar } from "./components/navigation-bar";
import { DeveloperBar } from "./components/developer-bar";
import { StepCreator } from "./step-creator";
import { AnimatePresence, motion } from "framer-motion";

export function SlideCanvas({ workflow }: { workflow: Workflow }) {
  return (
    <WorkflowProvider initialWorkflow={workflow}>
      <SlideCanvasContent />
    </WorkflowProvider>
  );
}

function SlideCanvasContent() {
  const {
    state,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    previousStep,
  } = useWorkflowContext();

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area with Slide Animation */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {state.isEditing
            ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <StepCreator
                  step={state.editingStepId ? currentStep : null}
                  onComplete={(step) => {
                    if (state.editingStepId) {
                      updateStep(state.editingStepId, step);
                    } else {
                      addStep(step);
                    }
                    stopEditing();
                  }}
                  onCancel={stopEditing}
                />
              </motion.div>
            )
            : currentStep
            ? (
              <motion.div
                key={`step-${currentStep.id}`}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                <StepSlide step={currentStep} />
              </motion.div>
            )
            : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex items-center justify-center"
              >
                <EmptyState onCreateStep={() => startEditing()} />
              </motion.div>
            )}
        </AnimatePresence>

        {/* Keyboard Navigation Hints */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          <kbd className="px-2 py-1 bg-white rounded shadow text-xs">←</kbd>
          <span className="text-xs text-gray-500">Previous</span>
          <kbd className="px-2 py-1 bg-white rounded shadow text-xs">→</kbd>
          <span className="text-xs text-gray-500">Next</span>
        </div>

        {/* Step Counter */}
        <div className="absolute bottom-4 right-4 text-sm text-gray-500">
          {currentStep && `${state.currentStepIndex + 1} / ${totalSteps}`}
        </div>
      </div>

      {/* Navigation Bar */}
      <NavigationBar />

      {/* Developer Bar (Collapsible) */}
      {state.showDevBar && <DeveloperBar />}
    </div>
  );
}
```

### 3. Step Slide Component

**File**: `apps/web/src/components/workflow-builder/components/step-slide.tsx`

```typescript
export function StepSlide({ step }: { step: WorkflowStep }) {
  const { state, updateStep, executeStep, startEditing } = useWorkflowContext();
  const executionResult = state.executionResults[step.id];

  return (
    <div className="h-full flex items-center justify-center p-12">
      <div className="max-w-4xl w-full space-y-8">
        {/* Step Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            {step.title}
          </h1>
          {step.description && (
            <p className="text-xl text-gray-600">
              {step.description}
            </p>
          )}
        </div>

        {/* Prompt Display */}
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">
              PROMPT
            </h3>
            <p className="text-lg text-gray-800 leading-relaxed">
              {step.prompt}
            </p>
          </div>

          {/* Tools Used */}
          {step.usedTools.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">
                TOOLS USED
              </h3>
              <div className="flex flex-wrap gap-2">
                {step.usedTools.map((tool, idx) => (
                  <Badge key={idx} variant="secondary">
                    {tool.integrationId}.{tool.toolName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Generated Code (Collapsible) */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <ChevronRight className="w-4 h-4" />
              GENERATED CODE
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="mt-2 p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto">
                <code>{step.code}</code>
              </pre>
            </CollapsibleContent>
          </Collapsible>

          {/* Execution Result */}
          {executionResult && (
            <div
              className={`
              p-4 rounded-lg
              ${
                executionResult.error
                  ? "bg-red-50 border border-red-200"
                  : "bg-green-50 border border-green-200"
              }
            `}
            >
              <h3 className="text-sm font-medium mb-2">
                {executionResult.error ? "EXECUTION ERROR" : "EXECUTION RESULT"}
              </h3>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(
                  executionResult.error || executionResult.value,
                  null,
                  2
                )}
              </pre>
              <p className="text-xs text-gray-500 mt-2">
                Executed at{" "}
                {new Date(executionResult.executedAt).toLocaleString()}
                {executionResult.duration && ` • ${executionResult.duration}ms`}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            variant="outline"
            onClick={() => startEditing(step.id)}
          >
            <Edit className="w-5 h-5 mr-2" />
            Edit Step
          </Button>

          <Button
            size="lg"
            onClick={() => executeStep(step.id)}
            disabled={state.isExecuting}
          >
            {state.isExecuting
              ? (
                <>
                  <Spinner className="w-5 h-5 mr-2" />
                  Executing...
                </>
              )
              : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Test Step
                </>
              )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 4. Navigation Bar

**File**:
`apps/web/src/components/workflow-builder/components/navigation-bar.tsx`

```typescript
export function NavigationBar() {
  const {
    state,
    navigateToStep,
    nextStep,
    previousStep,
    canNavigateBack,
    canNavigateForward,
    startEditing,
  } = useWorkflowContext();

  return (
    <div className="h-16 bg-white border-t flex items-center justify-between px-6">
      {/* Previous Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={previousStep}
        disabled={!canNavigateBack}
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>

      {/* Step Pills */}
      <div className="flex items-center gap-2 overflow-x-auto max-w-2xl">
        {state.workflow.steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => navigateToStep(index)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium transition-all
              ${
              index === state.currentStepIndex
                ? "bg-blue-500 text-white shadow-md scale-105"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }
            `}
          >
            {step.title || `Step ${index + 1}`}
          </button>
        ))}

        {/* Add Step Button */}
        <button
          onClick={() => startEditing()}
          className="px-4 py-2 rounded-full text-sm font-medium 
                     bg-gray-100 text-gray-500 hover:bg-gray-200 
                     border-2 border-dashed border-gray-300"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Add Step
        </button>
      </div>

      {/* Next Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={nextStep}
        disabled={!canNavigateForward}
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  );
}
```

## Key Features

### 1. Linear Navigation

- Horizontal slide-based navigation
- Keyboard shortcuts (← →)
- Visual step indicators
- Smooth animations between steps

### 2. Full-Screen Steps

- Each step gets full screen real estate
- Clean, focused interface
- Large, readable text
- Generous spacing

### 3. Developer Tools

- Collapsible developer bar
- Execution state viewer
- Configuration panel
- Debug logs

### 4. Type Safety

- Full TypeScript throughout
- Strongly typed actions and state
- Type-safe context hooks

### 5. Performance

- useReducer for complex state logic
- Memoized computed values
- Efficient re-renders

## Implementation Steps

1. **Remove React Flow Dependencies**
   - Delete React Flow imports
   - Remove node/edge logic
   - Clean up old canvas component

2. **Implement Context & Reducer**
   - Create workflow context
   - Implement reducer with all actions
   - Add helper functions

3. **Build UI Components**
   - Create slide canvas
   - Build step slide component
   - Implement navigation bar
   - Add developer tools

4. **Add Animations**
   - Slide transitions
   - Smooth navigation
   - Loading states

5. **Keyboard Navigation**
   - Arrow keys for navigation
   - Escape to cancel editing
   - Enter to confirm

## Benefits Over React Flow

1. **Simpler Mental Model**: Linear progression is easier to understand
2. **Better Mobile Experience**: Touch-friendly navigation
3. **Cleaner UI**: Full screen for each step
4. **Easier State Management**: No graph complexity
5. **Better Performance**: Less DOM nodes to manage

## Migration Path

1. Keep existing components that are still useful:
   - StepCreator
   - WorkflowToolbar (adapt for top bar)
   - Step execution logic

2. Replace:
   - WorkflowCanvas → SlideCanvas
   - Node components → StepSlide
   - React Flow logic → Navigation logic

3. New additions:
   - WorkflowContext
   - Navigation bar
   - Developer bar
   - Slide animations
