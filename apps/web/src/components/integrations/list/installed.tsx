import {
  type Integration,
  useIntegrations,
  useRemoveIntegration,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { type ChangeEvent, type MouseEvent, useReducer } from "react";
import { useNavigate } from "react-router";
import { useBasePath } from "../../../hooks/useBasePath.ts";
import { EmptyState } from "../../common/EmptyState.tsx";
import { IntegrationPage } from "./breadcrumb.tsx";
import { trackEvent } from "../../../hooks/analytics.ts";
import { useExplorerAgents } from "./useCreateExplorerAgent.ts";

// Integration Card Component
function IntegrationCard({
  integration,
  onConfigure,
  onDelete,
}: {
  integration: Integration;
  onConfigure: (integration: Integration) => void;
  onDelete: (integrationId: string) => void;
}) {
  const { goToAgentFor, isRedirecting } = useExplorerAgents();

  const handleChatClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    goToAgentFor(integration);
  };

  return (
    <Card
      className="shadow-sm group cursor-pointer hover:shadow-md transition-shadow rounded-2xl relative"
      onClick={() => onConfigure(integration)}
    >
      {/* Chat button - always visible */}
      <Button
        size="icon"
        className="absolute top-2 right-2 bg-green-500 hover:bg-green-600 text-white h-8 w-8 rounded-full flex items-center justify-center shadow-sm z-10"
        onClick={handleChatClick}
        disabled={isRedirecting}
      >
        {isRedirecting ? <Spinner size="sm" /> : <Icon name="chat" />}
      </Button>

      {/* Delete button - visible only on hover */}
      <Button
        size="icon"
        variant="ghost"
        className="absolute bottom-2 right-2 hover:text-destructive focus:bg-destructive/10 focus:text-destructive opacity-0 group-hover:opacity-100 transition-opacity z-20"
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          onDelete(integration.id);
        }}
      >
        <Icon name="delete" />
      </Button>

      <CardContent className="p-4">
        <div className="grid grid-cols-[min-content_1fr_min-content] gap-4">
          <div className="h-16 w-16 rounded-md flex items-center justify-center overflow-hidden">
            {integration.icon && /^(data:)|(https?:)/.test(integration.icon)
              ? (
                <img
                  src={integration.icon}
                  alt={`${integration.name} icon`}
                  className="h-full w-full object-contain"
                />
              )
              : <Icon name="conversion_path" />}
          </div>

          <div className="grid grid-cols-1 gap-1">
            <div className="text-base font-semibold truncate">
              {integration.name}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-3">
              {integration.description}
            </div>
          </div>

          <div className="w-8">
            {/* Empty div to maintain grid layout */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Define the state interface
interface ListState {
  filter: string;
  deleteDialogOpen: boolean;
  integrationToDelete: string | null;
  deleting: boolean;
}

// Define action types
type ListAction =
  | { type: "SET_FILTER"; payload: string }
  | { type: "CONFIRM_DELETE"; payload: string }
  | { type: "CANCEL_DELETE" }
  | { type: "DELETE_START" }
  | { type: "DELETE_END" };

// Initial state
const initialState: ListState = {
  filter: "",
  deleteDialogOpen: false,
  integrationToDelete: null,
  deleting: false,
};

// Reducer function
function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_FILTER": {
      return { ...state, filter: action.payload };
    }
    case "CONFIRM_DELETE": {
      return {
        ...state,
        deleteDialogOpen: true,
        integrationToDelete: action.payload,
      };
    }
    case "CANCEL_DELETE": {
      return { ...state, deleteDialogOpen: false, integrationToDelete: null };
    }
    case "DELETE_START": {
      return { ...state, deleting: true };
    }
    case "DELETE_END": {
      return {
        ...state,
        deleting: false,
        deleteDialogOpen: false,
        integrationToDelete: null,
      };
    }
    default: {
      return state;
    }
  }
}

export default function InstalledIntegrations() {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const withBasePath = useBasePath();
  const navigate = useNavigate();
  const { mutate: removeIntegration } = useRemoveIntegration();
  const { filter, deleteDialogOpen, integrationToDelete, deleting } = state;

  // Use SDK's useIntegrations hook to get all integrations
  const { data: installedIntegrations } = useIntegrations();

  // Filter installed integrations based on the filter text
  const filteredIntegrations =
    installedIntegrations?.filter((integration) =>
      integration.name.toLowerCase().includes(filter.toLowerCase())
    ) ?? [];

  // Function to handle configuring/editing an existing integration
  const handleConfigure = (integration: Integration) => {
    navigate(withBasePath(`/integration/${integration.id}`));
  };

  // Function to handle delete confirmation
  const handleDeleteConfirm = (integrationId: string) => {
    dispatch({ type: "CONFIRM_DELETE", payload: integrationId });
  };

  // Function to handle actual deletion
  const handleDelete = () => {
    if (!integrationToDelete) return;

    try {
      dispatch({ type: "DELETE_START" });

      // Use the removeIntegration mutation from the hook
      removeIntegration(integrationToDelete);

      trackEvent("integration_delete", {
        success: true,
        data: integrationToDelete,
      });
    } catch (error) {
      console.error("Error deleting integration:", error);

      trackEvent("integration_delete", {
        success: false,
        data: integrationToDelete,
        error,
      });
    } finally {
      dispatch({ type: "DELETE_END" });
    }
  };

  // Handle delete dialog close
  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !deleting) {
      dispatch({ type: "CANCEL_DELETE" });
    }
  };

  return (
    <IntegrationPage>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Input
            placeholder="Filter integrations..."
            className="max-w-[373px] rounded-[46px]"
            value={filter}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              dispatch({ type: "SET_FILTER", payload: e.target.value })}
          />
        </div>

        {!installedIntegrations
          ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner size="lg" />
            </div>
          )
          : installedIntegrations.length === 0
          ? (
            <EmptyState
              icon="conversion_path"
              title="No connected integrations yet"
              description="Connect services to expand what your agents can do."
              buttonProps={{
                children: "Connect an integration",
                onClick: () =>
                  navigate(withBasePath("/integrations/marketplace")),
              }}
            />
          )
          : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 peer">
                {filteredIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    onConfigure={handleConfigure}
                    onDelete={handleDeleteConfirm}
                  />
                ))}
              </div>
              <div className="flex-col items-center justify-center h-48 peer-empty:flex hidden">
                <Icon name="search_off" />
                <p className="text-muted-foreground">
                  No integrations match your filter. Try adjusting your search.
                </p>
              </div>
            </>
          )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={handleDeleteDialogOpenChange}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the integration. This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              >
                {deleting
                  ? (
                    <>
                      <Spinner />
                      Deleting...
                    </>
                  )
                  : (
                    "Delete"
                  )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </IntegrationPage>
  );
}
