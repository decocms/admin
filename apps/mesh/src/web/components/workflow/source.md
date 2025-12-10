function NewStepButton({ index }: { index: number }) {
    const [isCreatingStep, setIsCreatingStep] = useState(false);
  
    const { isFinished } = useStepResults();
    const trackingExecutionId = useTrackingExecutionId();
  
    // const isDisabled = !isFinished && !!trackingExecutionId;
    // const isDisabled = true;
    const isDisabled = false;
    return (
      <div className="flex flex-col items-center justify-center transition-all ease-in-out group">
        <div
          className={cn(
            "h-0 w-0.5 bg-border transition-all ease-in-out mb-2",
            isDisabled && "mb-0 h-2",
          )}
        />
  <div className={cn("min-w-6 h-6 rounded-lg border border-primary transition-all ease-in-out cursor-pointer"
    
    , "group-hover:bg-primary/40"
    // ,isCreatingStep && "group-hover:bg-primary/40"
  
  )
  
  }
    
    >
    <div className="w-full h-full flex items-center justify-center">
      <div
        className={cn(
          "transition-all duration-200 ease-in-out flex items-center justify-center w-full h-full",
          isDisabled && "scale-0 opacity-0",
        )}
      >
        <div
          className={cn(
            "absolute transition-all duration-200 ease-in-out flex items-center justify-center w-full h-full",
            isCreatingStep && "scale-0 opacity-0 pointer-events-none",
          )}
        >
          <button
            type="button"
            onClick={() => setIsCreatingStep(true)}
            className="bg-transparent peer rounded-lg flex items-center justify-center cursor-pointer new-step-button transition-all ease-in-out"
          >
            <Plus className="w-4 h-4 text-primary-foreground transition-all ease-in-out" />
          </button>
        </div>
  
        <div
          className={cn(
            "absolute transition-all duration-200 ease-in-out",
            !isCreatingStep && "scale-0 opacity-0 pointer-events-none",
          )}
        >
          <NewStepMenu
            index={index}
            onClose={() => setIsCreatingStep(false)}
          />
        </div>
      </div>
    </div>
  </div>
        <div
          className={cn(
            "h-0 w-0.5 bg-border transition-all ease-in-out mt-2",
            isDisabled && "mt-0 h-2",
          )}
        />
      </div>
    );
  }
  
  function SignalStepButton({ step }: { step: Step }) {
    return (
      <div>
        <span>Signal</span>
      </div>
    );
  }
  
  function NewStepMenu(
    { index, onClose }: { index: number; onClose: () => void },
  ) {
    const { addStepAtIndex } = useWorkflowActions();
  
    const handleAddStep = (type: StepType) => {
      addStepAtIndex(index, { type });
      onClose();
    };
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleAddStep("code")}
          className="w-5 h-5 p-0.5 bg-background rounded-lg flex items-center justify-center hover:bg-primary/40 transition-all ease-in-out cursor-pointer"
        >
          <CodeXml className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleAddStep("tool")}
          className="w-5 h-5 p-0.5 bg-background rounded-lg flex items-center justify-center hover:bg-primary/40 transition-all ease-in-out cursor-pointer"
        >
          <Wrench className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onClose()}
          className="w-5 h-5 p-px rounded-full bg-transparent transition-all ease-in-out cursor-pointer flex items-center justify-center"
        >
          <X
            onClick={() => onClose()}
            className={cn(
              "w-4 h-4 text-primary-foreground transition-all ease-in-out",
            )}
          />
        </button>
        <button
          onClick={() => handleAddStep("sleep")}
          className="w-5 h-5 p-0.5 bg-background rounded-lg flex items-center justify-center hover:bg-primary/40 transition-all ease-in-out cursor-pointer"
        >
          <ClockIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleAddStep("wait_for_signal")}
          className="w-5 h-5 p-0.5 bg-background rounded-lg flex items-center justify-center hover:bg-primary/40 transition-all ease-in-out cursor-pointer"
        >
          <BellIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }