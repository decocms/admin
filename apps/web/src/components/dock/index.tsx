import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
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
  type Dispatch,
  ReactNode,
  type SetStateAction,
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const Context = createContext<
  {
    tabs: Record<string, Tab>;
    totalTabs: number;
    openPanels: Set<string>;
    setOpenPanels: Dispatch<SetStateAction<Set<string>>>;
  } | null
>(null);

const DOCKED_VIEWS_TAB = { id: "chat-docked-views", title: "Views" };
const NO_DROP_TARGET = "no-drop-target";

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
    const { openPanels } = useDock();

    if (openPanels.size === 1) {
      return null;
    }

    if (props.api.component === DOCKED_VIEWS_TAB.id) {
      return (
        <div className="flex items-center justify-between gap-2 py-3 px-2 bg-slate-50">
          <Icon name="layers" size={16} className="text-slate-700 p-1" />
          <span className="flex-1 text-sm">Views</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              togglePanel({
                id: DOCKED_VIEWS_TAB.id,
                component: DOCKED_VIEWS_TAB.id,
                title: DOCKED_VIEWS_TAB.title,
              })}
            aria-label="Close views menu"
          >
            <Icon name="close" size={16} />
          </Button>
        </div>
      );
    }

    return (
      <div className="p-2 bg-background w-min">
        <div
          data-active
          className={cn(
            "flex items-center justify-between gap-2 p-2",
            "rounded-xl",
          )}
        >
          <p className="text-sm whitespace-nowrap">{props.api.title}</p>
          <Button
            className="p-1 h-6 w-6"
            variant="ghost"
            size="icon"
            onClick={() => props.api.close()}
          >
            <Icon name="close" size={12} />
          </Button>
        </div>
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
  hideFromViews?: boolean;
}

type Props =
  & Partial<Omit<ComponentProps<typeof DockviewReact>, "components">>
  & { tabs: Record<string, Tab> };

function isMobile() {
  return globalThis.innerWidth <= 768;
}

const addPanel = (options: AddPanelOptions, api: DockviewApi) => {
  let targetGroup = api.groups[0];
  for (const group of api.groups) {
    if (group.locked === NO_DROP_TARGET || !group.isActive) {
      continue;
    }
    targetGroup = group;
  }

  const mobile = isMobile();
  const views = options.id === DOCKED_VIEWS_TAB.id;

  const panelOptions: AddPanelOptions = views
    ? {
      maximumWidth: 288,
      minimumWidth: 288,
      initialWidth: 288,
      position: { direction: "right" },
      ...options,
      floating: false,
    }
    : {
      minimumWidth: mobile ? globalThis.innerWidth : 300,
      maximumWidth: mobile ? globalThis.innerWidth : undefined,
      initialWidth: mobile ? globalThis.innerWidth : targetGroup?.width || 400,
      position: {
        direction: mobile || targetGroup?.id ? "within" : "right",
        referenceGroup: targetGroup?.id,
      },
      ...options,
      floating: false,
    };

  const panel = api.addPanel(panelOptions);

  if (views) {
    panel.group.locked = NO_DROP_TARGET;
  }

  return panel;
};

const equals = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) {
    return false;
  }

  return a.isSubsetOf(b) && b.isSubsetOf(a);
};

function Docked(
  { onReady, tabs, ...props }: Props,
) {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const { setOpenPanels } = useDock();
  const wrappedTabs = useMemo(
    () => {
      const entries = Object.entries(tabs).map(([key, value]) => [
        key,
        adapter(value.Component),
      ]);

      if (entries.length > 1) {
        entries.push([DOCKED_VIEWS_TAB.id, Docked.Views]);
      }

      return Object.fromEntries(entries);
    },
    [tabs],
  );

  const handleReady = useCallback((event: DockviewReadyEvent) => {
    setApi(event.api);

    const initialPanels = new Set<string>();
    Object.entries(tabs).forEach(([key, value]) => {
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
  }, [onReady, tabs]);

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
    <div className="h-full w-full">
      <DockviewReact
        components={wrappedTabs}
        defaultTabComponent={TAB_COMPONENTS.default}
        onReady={handleReady}
        className="h-full w-full dockview-theme-abyss deco-dockview-container"
        singleTabMode="fullwidth"
        disableTabsOverflowList
        disableFloatingGroups
        hideBorders
        {...props}
      />
    </div>
  );
}

Docked.Provider = (
  { children, tabs }: { children: ReactNode; tabs: Record<string, Tab> },
) => {
  const [openPanels, setOpenPanels] = useState(new Set<string>());
  const totalTabs =
    Object.values(tabs).filter((tab) => !tab.hideFromViews).length;

  return (
    <Context.Provider
      value={{
        tabs,
        totalTabs,
        openPanels,
        setOpenPanels,
      }}
    >
      {children}
    </Context.Provider>
  );
};

Docked.Views = () => {
  const { tabs, openPanels } = useDock();

  return (
    <div className="h-full flex flex-col gap-2 p-2 bg-slate-50">
      {Object.entries(tabs)
        .filter(([_id, tab]) => !tab.hideFromViews)
        .map(([id, tab]) => {
          const isActive = openPanels.has(id);

          return (
            <button
              key={id}
              type="button"
              onClick={() =>
                togglePanel({ id, component: id, title: tab.title })}
              className={cn(
                "flex items-center justify-between gap-3",
                "p-2 rounded-xl",
                "cursor-pointer",
                "hover:bg-slate-100 text-slate-700",
                isActive && "bg-slate-100 ",
              )}
            >
              <span className="flex-1 truncate text-sm text-left">
                {tab.title}
              </span>
              <div
                className={cn(
                  "p-1 flex items-center justify-center",
                  isActive ? "visible" : "invisible",
                )}
              >
                <Icon name="check" size={16} />
              </div>
            </button>
          );
        })}
    </div>
  );
};

Docked.ViewsTrigger = () => {
  const { openPanels } = useDock();

  return (
    <Button
      onClick={() =>
        togglePanel({
          id: DOCKED_VIEWS_TAB.id,
          component: DOCKED_VIEWS_TAB.id,
          title: DOCKED_VIEWS_TAB.title,
        })}
      variant="ghost"
      size="icon"
      className={openPanels.has(DOCKED_VIEWS_TAB.id) ? "bg-accent" : ""}
    >
      <Icon name="layers" />
    </Button>
  );
};

export default Docked;
