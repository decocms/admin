import { ArrowLeft, Plus, Save, Share2, Terminal } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useWorkflowContext } from "../../../contexts/workflow-context.tsx";
import { useNavigate } from "react-router";

export function TopBar() {
  const { state, dispatch, saveWorkflow, startEditing } = useWorkflowContext();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(-1);
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    console.log("Share workflow");
  };

  const toggleDevBar = () => {
    dispatch({ type: "TOGGLE_DEV_BAR" });
  };

  return (
    <div className="h-16 bg-white border-b px-6 flex items-center justify-between shadow-sm">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{state.workflow.name}</h1>
          {state.isDirty && !state.isSaving && (
            <span className="text-sm text-orange-600 font-medium">
              • Unsaved changes
            </span>
          )}
          {state.isSaving && (
            <span className="text-sm text-blue-600 font-medium flex items-center gap-1">
              <Spinner className="w-3 h-3" />
              Saving...
            </span>
          )}
          {!state.isDirty && !state.isSaving && state.lastSaved && (
            <span className="text-sm text-green-600 font-medium">✓ Saved</span>
          )}
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDevBar}
          className={state.showDevBar ? "bg-gray-100" : ""}
        >
          <Terminal className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="sm" onClick={() => startEditing()}>
          <Plus className="w-4 h-4 mr-2" />
          New Step
        </Button>

        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>

        <Button
          onClick={saveWorkflow}
          disabled={!state.isDirty || state.isSaving}
          size="sm"
        >
          {state.isSaving ? (
            <>
              <Spinner className="w-4 h-4 mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
