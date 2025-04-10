import { type Integration, useCreateIntegration, useInstall } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { type ChangeEvent, useMemo, useReducer, useState } from "react";
import { useNavigate } from "react-router";
import { useBasePath } from "../../../hooks/useBasePath.ts";
import registryIntegrations from "../registry.json" with { type: "json" };
import { IntegrationTopbar } from "./breadcrumb.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";

// Registry Integration type that matches the structure in registry.json
type RegistryIntegration = Omit<Integration, "connection"> & {
  category: string;
  url: string;
};

// Available Integration Card Component
function AvailableIntegrationCard(
  { integration }: {
    integration: RegistryIntegration;
  },
) {
  const {
    mutate: createIntegrationMutation,
    isPending: isCreating,
  } = useCreateIntegration();
  const {
    mutate: installIntegration,
    isPending: isInstalling,
  } = useInstall();
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdIntegrationId, setCreatedIntegrationId] = useState<
    string | null
  >(null);
  const navigate = useNavigate();
  const withBasePath = useBasePath();

  const isPending = isInstalling || isCreating;

  const handleInstall = () => {
    installIntegration(integration.id, {
      onSuccess: (data) => {
        if (typeof data.installation !== "string") {
          setError("Failed to install integration: Invalid installation data");
          setShowModal(true);
          return;
        }

        // Create the integration using the SDK
        const newIntegrationId = crypto.randomUUID();
        setCreatedIntegrationId(newIntegrationId);
        createIntegrationMutation({
          ...integration,
          id: newIntegrationId,
          connection: { type: "SSE", url: data.installation },
        }, {
          onSuccess: () => {
            setShowModal(true);
          },
          onError: (error) => {
            setError(
              error instanceof Error
                ? error.message
                : "Failed to create integration",
            );
            setShowModal(true);
          },
        });
      },
      onError: (error) => {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to install integration",
        );
        setShowModal(true);
      },
    });
  };

  const handleEditIntegration = () => {
    if (!createdIntegrationId) return;
    navigate(withBasePath(`/integration/${createdIntegrationId}`));
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCreatedIntegrationId(null);
  };

  return (
    <>
      <Card
        className="shadow-sm group hover:shadow-md transition-shadow rounded-2xl cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        <CardContent className="p-4">
          <div className="grid grid-cols-[min-content_1fr] gap-4">
            <div className="h-16 w-16 rounded-md flex items-center justify-center overflow-hidden">
              <img
                src={integration.icon}
                alt={`${integration.name} icon`}
                className="h-full w-full object-contain"
              />
            </div>

            <div className="grid grid-cols-1 gap-1">
              <div className="text-base font-semibold truncate">
                {integration.name}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {integration.description}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="text-xs px-2 py-1 bg-secondary rounded-full">
              {integration.category}
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={handleCloseModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {error ? "Installation Failed" : `Connect to ${integration.name}`}
            </DialogTitle>
            <DialogDescription>
              {error
                ? <div className="text-destructive">{error}</div>
                : (
                  <div className="mt-4">
                    <div className="grid grid-cols-[80px_1fr] items-center gap-4">
                      <div className="rounded-md flex items-center justify-center overflow-hidden">
                        <img
                          src={integration.icon}
                          alt={`${integration.name} icon`}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {integration.description}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {error
              ? <Button onClick={handleCloseModal}>Close</Button>
              : isPending
              ? (
                <Button disabled={isPending}>
                  Connecting...
                </Button>
              )
              : createdIntegrationId
              ? (
                <Button onClick={handleEditIntegration}>
                  See Integration
                </Button>
              )
              : (
                <Button onClick={handleInstall}>
                  Connect
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Define the state interface
interface MarketplaceState {
  registryFilter: string;
  selectedCategories: Set<string>;
}

// Define action types
type MarketplaceAction =
  | { type: "SET_REGISTRY_FILTER"; payload: string }
  | { type: "TOGGLE_CATEGORY"; payload: string }
  | { type: "SET_SELECTED_CATEGORIES"; payload: Set<string> };

// Initial state
const initialState: MarketplaceState = {
  registryFilter: "",
  selectedCategories: new Set(),
};

// Reducer function
function marketplaceReducer(
  state: MarketplaceState,
  action: MarketplaceAction,
): MarketplaceState {
  switch (action.type) {
    case "SET_REGISTRY_FILTER": {
      return { ...state, registryFilter: action.payload };
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

export default function Marketplace() {
  const [state, dispatch] = useReducer(marketplaceReducer, initialState);
  const { registryFilter, selectedCategories } = state;

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

  return (
    <div className="flex flex-col gap-4">
      <IntegrationTopbar />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          <Input
            placeholder="Filter integrations..."
            className="max-w-[373px] rounded-[46px]"
            value={registryFilter}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              dispatch({
                type: "SET_REGISTRY_FILTER",
                payload: e.target.value,
              })}
          />
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
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
          {filteredRegistryIntegrations.map((integration) => (
            <AvailableIntegrationCard
              key={integration.id}
              integration={integration}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
