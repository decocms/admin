import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  AddPanelOptions,
  type DockviewApi,
  DockviewReact,
  type DockviewReadyEvent,
  IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from "dockview-react";
import {
  ComponentProps,
  ComponentType,
  createContext,
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const Context = createContext<
  {
    mainViewName: string;
    openPanels: Set<string>;
    availablePanels: Set<string>;
  } | null
>(null);

export const useDock = () => {
  const ctx = use(Context);

  if (!ctx) {
    throw new Error("Dock context not found");
  }

  return ctx;
};

const adapter =
  <T extends object>(Component: ComponentType<T>) =>
  (props: IDockviewPanelProps<T>) => {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        }
      >
        <Component {...props.params} />
      </Suspense>
    );
  };

const TAB_COMPONENTS = {
  default: (props: IDockviewPanelHeaderProps) => {
    const { mainViewName } = useDock();

    if (props.api.component === mainViewName) {
      return null;
    }

    return (
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <p className="text-sm">{props.api.title}</p>
        <Button
          className="p-1 h-6 w-6"
          variant="ghost"
          size="icon"
          onClick={() => props.api.close()}
        >
          <Icon name="close" size={12} />
        </Button>
      </div>
    );
  },
};

const channel = new EventTarget();

type Message = {
  type: "toggle" | "open" | "update";
  payload: AddPanelOptions<object>;
};

export const togglePanel = <T extends object>(
  detail: AddPanelOptions<T>,
) => {
  channel.dispatchEvent(
    new CustomEvent("message", { detail: { type: "toggle", payload: detail } }),
  );
};

export const openPanel = <T extends object>(
  detail: AddPanelOptions<T>,
) => {
  channel.dispatchEvent(
    new CustomEvent("message", { detail: { type: "open", payload: detail } }),
  );
};

export interface Tab {
  Component: ComponentType;
  initialOpen?: boolean;
  title: string;
}

type Props =
  & Partial<Omit<ComponentProps<typeof DockviewReact>, "components">>
  & {
    mainView: ComponentType;
    components: Record<string, Tab>;
  };

const NO_DROP_TARGET = "no-drop-target";

const addPanel = (options: AddPanelOptions, api: DockviewApi) => {
  const group = api.groups.find((group) => group.locked !== NO_DROP_TARGET);

  const panel = api.addPanel({
    ...options,
    position: {
      direction: group?.id ? "within" : "right",
      referenceGroup: group?.id,
    },
    minimumWidth: 300,
    initialWidth: group?.width || 400,
    floating: false,
  });

  return panel;
};

const equals = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) {
    return false;
  }

  return a.isSubsetOf(b) && b.isSubsetOf(a);
};

function Docked(
  { onReady, components, mainView, ...props }: Props,
) {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const [openPanels, setOpenPanels] = useState(new Set<string>());
  const mainViewName = mainView.displayName || "Main View";

  const wrappedComponents = useMemo(
    () => {
      const record = Object.fromEntries(
        Object.entries(components).map(([key, value]) => [
          key,
          adapter(value.Component),
        ]),
      );

      record[mainViewName] = adapter(mainView);

      return record;
    },
    [components, mainView, mainViewName],
  );

  const availablePanels = useMemo(() => {
    return new Set(Object.keys(components));
  }, [components]);

  const handleReady = useCallback((event: DockviewReadyEvent) => {
    setApi(event.api);

    const mainPanel = event.api.addPanel({
      id: mainViewName,
      component: mainViewName,
      title: mainViewName,
    });

    mainPanel.group.locked = NO_DROP_TARGET;

    const initialPanels = new Set<string>();
    Object.entries(components).forEach(([key, value]) => {
      if (value.initialOpen) {
        initialPanels.add(key);

        addPanel({ id: key, component: key, title: value.title }, event.api);
      }
    });

    setOpenPanels(initialPanels);

    event.api.onDidLayoutChange(() => {
      const currentPanels = new Set(event.api.panels.map((panel) => panel.id));

      setOpenPanels((prev) =>
        equals(prev, currentPanels) ? prev : currentPanels
      );
    });

    onReady?.(event);
  }, [onReady, mainViewName, components]);

  useEffect(() => {
    if (!api) {
      return;
    }

    const handleMessage = (
      event: CustomEvent<Message>,
    ) => {
      const { type, payload } = event.detail;
      const panel = api.getPanel(payload.id);

      if (panel) {
        if (type === "toggle") {
          panel.api.close();
        } else if (type === "open") {
          panel.api.updateParameters(payload.params || {});
        }
      } else {
        addPanel(payload, api);
      }
    };

    // @ts-expect-error - I don't really know how to properly type this
    channel.addEventListener("message", handleMessage);

    return () => {
      // @ts-expect-error - I don't really know how to properly type this
      channel.removeEventListener("message", handleMessage);
    };
  }, [api, channel]);

  return (
    <Context.Provider value={{ mainViewName, openPanels, availablePanels }}>
      <DockviewReact
        components={wrappedComponents}
        tabComponents={TAB_COMPONENTS}
        defaultTabComponent={TAB_COMPONENTS.default}
        onReady={handleReady}
        className="h-full w-full dockview-theme-abyss deco-dockview-container"
        singleTabMode="fullwidth"
        disableTabsOverflowList
        disableFloatingGroups
        hideBorders
        {...props}
      />
    </Context.Provider>
  );
}

export default Docked;
