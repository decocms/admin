import { type Integration, useInstall } from "@deco/sdk";
import {
  useCreateIntegration,
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
import { type ChangeEvent, useMemo, useReducer, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { useBasePath } from "../../../hooks/useBasePath.ts";
import { EmptyState } from "../../common/EmptyState.tsx";
import registryIntegrations from "../registry.json" with { type: "json" };

// Registry Integration type that matches the structure in registry.json
type RegistryIntegration = Omit<Integration, "connection"> & {
  category: string;
  url: string;
};

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
  return (
    <Card
      className="shadow-sm group cursor-pointer hover:shadow-md transition-shadow rounded-2xl"
      onClick={() => onConfigure(integration)}
    >
      <CardContent className="p-4">
        <div className="flex justify-between">
          <div className="h-16 w-16 rounded-md flex items-center justify-center overflow-hidden">
            {integration.icon && /^(data:)|(https?:)/.test(integration.icon)
              ? (
                <img
                  src={integration.icon}
                  alt={`${integration.name} icon`}
                  className="h-full w-full object-contain"
                />
              )
              : (
                <Icon
                  name="conversion_path"
                  className="text-muted-foreground text-4xl font-thin"
                />
              )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden group-hover:inline-flex hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(integration.id);
            }}
          >
            <Icon name="delete" />
          </Button>
        </div>
        <div className="mt-4">
          <h3 className="text-base font-semibold">{integration.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {integration.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Available Integration Card Component
function AvailableIntegrationCard(
  { integration }: {
    integration: RegistryIntegration;
  },
) {
  const { mutate: createIntegrationMutation, isPending: isCreating } =
    useCreateIntegration();
  const { mutate: installIntegration, isPending: isInstalling } = useInstall();

  const isPending = isInstalling || isCreating;

  const handleInstall = () => {
    installIntegration(integration.id, {
      onSuccess: async (data) => {
        if (typeof data.installation !== "string") {
          throw new Error("Failed to install integration");
        }

        // Create the integration using the SDK
        await createIntegrationMutation({
          ...integration,
          connection: { type: "SSE", url: data.installation },
        });
      },
      onError: (error) => {
        console.error("Error installing integration:", error);
      },
    });
  };

  return (
    <Card className="shadow-sm group hover:shadow-md transition-shadow rounded-2xl">
      <CardContent className="p-4">
        <div className="flex justify-between">
          <div className="h-16 w-16 rounded-md flex items-center justify-center overflow-hidden">
            <img
              src={integration.icon}
              alt={`${integration.name} icon`}
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={handleInstall}
              className="text-xs"
            >
              {isPending ? "Connecting..." : "Connect"}
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">{integration.name}</h3>
            <span className="text-xs px-2 py-1 bg-secondary rounded-full">
              {integration.category}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
            {integration.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Define the state interface
interface ListState {
  filter: string;
  registryFilter: string;
  deleteDialogOpen: boolean;
  integrationToDelete: string | null;
  deleting: boolean;
  selectedCategories: Set<string>;
}

// Define action types
type ListAction =
  | { type: "SET_FILTER"; payload: string }
  | { type: "SET_REGISTRY_FILTER"; payload: string }
  | { type: "CONFIRM_DELETE"; payload: string }
  | { type: "CANCEL_DELETE" }
  | { type: "DELETE_START" }
  | { type: "DELETE_END" }
  | { type: "TOGGLE_CATEGORY"; payload: string }
  | { type: "SET_SELECTED_CATEGORIES"; payload: Set<string> };

// Initial state
const initialState: ListState = {
  filter: "",
  registryFilter: "",
  deleteDialogOpen: false,
  integrationToDelete: null,
  deleting: false,
  selectedCategories: new Set(),
};

// Reducer function
function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_FILTER": {
      return { ...state, filter: action.payload };
    }
    case "SET_REGISTRY_FILTER": {
      return { ...state, registryFilter: action.payload };
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
    case "TOGGLE_CATEGORY": {
      const categories = new Set(state.selectedCategories);
      if (categories.has(action.payload)) {
        categories.delete(action.payload);
      } else {
        categories.add(action.payload);
      }
      return { ...state, selectedCategories: categories };
    }
    case "SET_SELECTED_CATEGORIES": {
      return { ...state, selectedCategories: action.payload };
    }
    default: {
      return state;
    }
  }
}

export default function List() {
  const availableIntegrationsSection = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(listReducer, initialState);
  const withBasePath = useBasePath();
  const navigate = useNavigate();
  const { mutate: removeIntegration } = useRemoveIntegration();
  const {
    filter,
    registryFilter,
    deleteDialogOpen,
    integrationToDelete,
    deleting,
    selectedCategories,
  } = state;

  // Use SDK's useIntegrations hook to get all integrations
  const { data: installedIntegrations } = useIntegrations();

  // Get unique categories from registry
  const categories = useMemo(() => {
    const categorySet = new Set(
      registryIntegrations.map((integration) => integration.category),
    );
    const sortedCategories = Array.from(categorySet).sort();
    return ["All", ...sortedCategories];
  }, []);

  // Filter registry integrations by name and category
  const filteredRegistryIntegrations = useMemo(() => {
    let filtered = registryIntegrations;

    // Apply text filter
    if (registryFilter) {
      filtered = filtered.filter(
        (integration: RegistryIntegration) =>
          integration.name.toLowerCase().includes(
            registryFilter.toLowerCase(),
          ) ||
          integration.category.toLowerCase().includes(
            registryFilter.toLowerCase(),
          ),
      );
    }

    // Apply category filter
    if (selectedCategories.size > 0 && !selectedCategories.has("All")) {
      filtered = filtered.filter(
        (integration: RegistryIntegration) =>
          selectedCategories.has(integration.category),
      );
    }

    return filtered;
  }, [registryFilter, selectedCategories]);

  // Filter installed integrations based on the filter text
  const filteredIntegrations = useMemo(() => {
    if (!installedIntegrations) return [];
    if (!filter) return installedIntegrations;

    return installedIntegrations.filter((integration) =>
      integration.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [installedIntegrations, filter]);

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
    } catch (error) {
      console.error("Error deleting integration:", error);
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
    <div className="flex flex-col gap-8 flex-grow">
      {/* Existing Integrations Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold mb-4">Installed Integrations</h2>
        <div className="flex items-center justify-between">
          <Input
            placeholder="Filter integrations..."
            className="max-w-[373px] rounded-[46px]"
            value={filter}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              dispatch({ type: "SET_FILTER", payload: e.target.value })}
          />
          <Link to={withBasePath("/integration/new")}>
            <Button>
              <Icon name="add" />
              Create Integration
            </Button>
          </Link>
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
                children: "See Available Integrations",
                onClick: () => {
                  availableIntegrationsSection.current?.scrollIntoView({
                    behavior: "smooth",
                  });
                },
              }}
            />
          )
          : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 peer">
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
                <Icon
                  name="search_off"
                  className="mb-2 text-4xl text-muted-foreground"
                />
                <p className="text-muted-foreground">
                  No integrations match your filter. Try adjusting your search.
                </p>
              </div>
            </>
          )}
      </div>

      {/* Available Integrations Section */}
      <div
        ref={availableIntegrationsSection}
        className="flex flex-col gap-4 mt-8"
      >
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold mb-4">Available Integrations</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategories.has(category) ||
                      (category === "All" && selectedCategories.size === 0)
                    ? "default"
                    : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    if (category === "All") {
                      dispatch({
                        type: "SET_SELECTED_CATEGORIES",
                        payload: new Set(),
                      });
                    } else {
                      dispatch({ type: "TOGGLE_CATEGORY", payload: category });
                    }
                  }}
                >
                  {category}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Search available integrations..."
              className="max-w-[373px] rounded-[46px]"
              value={registryFilter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                dispatch({
                  type: "SET_REGISTRY_FILTER",
                  payload: e.target.value,
                })}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
            {filteredRegistryIntegrations.map((integration) => (
              <AvailableIntegrationCard
                key={integration.id}
                integration={integration}
              />
            ))}
          </div>
        </div>
      </div>

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
  );
}
