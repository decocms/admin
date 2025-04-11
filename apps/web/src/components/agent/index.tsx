import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
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
  ComponentType,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "react-router";

interface Props {
  agentId?: string;
  threadId?: string;
}

const AgentChat = lazy(
  () => import("../chat/index.tsx"),
);

const AgentSettings = lazy(
  () => import("../settings/index.tsx"),
);

const AgentPreview = lazy(
  () => import("./preview.tsx"),
);

const AgentThreads = lazy(
  () => import("../threads/index.tsx"),
);

const adapter =
  <T extends object>(Component: ComponentType<T>) =>
  (props: IDockviewPanelProps<T>) => (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      }
    >
      <ScrollArea className="h-full w-full">
        <Component {...props.params} />
      </ScrollArea>
    </Suspense>
  );

const COMPONENTS = {
  chat: adapter(AgentChat),
  settings: adapter(AgentSettings),
  preview: adapter(AgentPreview),
  threads: adapter(AgentThreads),
};

const TAB_COMPONENTS = {
  default: (props: IDockviewPanelHeaderProps) => {
    if (props.api.component === "chat") {
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

export const togglePanel = <T extends object>(detail: AddPanelOptions<T>) => {
  channel.dispatchEvent(
    new CustomEvent("message", { detail }),
  );
};

function Agent(props: Props) {
  const [api, setApi] = useState<DockviewApi | null>(null);
  const params = useParams();

  const agentId = useMemo(
    () => props.agentId || params.id || crypto.randomUUID(),
    [props.agentId, params.id],
  );
  const threadId = useMemo(
    () => props.threadId || params.threadId || crypto.randomUUID(),
    [props.threadId, params.threadId],
  );
  const key = useMemo(
    () => `${agentId}-${threadId}`,
    [agentId, threadId],
  );

  const handleReady = useCallback((event: DockviewReadyEvent) => {
    setApi(event.api);

    const params = { agentId, threadId, panels: [] };

    const chatPanel = event.api.addPanel({
      id: "chat",
      component: "chat",
      title: "Chat View",
      params,
    });

    chatPanel.group.locked = "no-drop-target";

    let prev: string[] = [];
    event.api.onDidLayoutChange(() => {
      const currentPanels = event.api.panels.map((panel) => panel.id);
      if (JSON.stringify(prev) !== JSON.stringify(currentPanels)) {
        prev = currentPanels;
        chatPanel.api.updateParameters({ ...params, panels: currentPanels });
      }
    });
  }, [agentId, threadId]);

  useEffect(() => {
    const handleMessage = (
      event: CustomEvent<AddPanelOptions<object>>,
    ) => {
      const { detail } = event;

      const panel = api?.getPanel(detail.id);

      if (panel) {
        panel.api.close();
      } else {
        const group = api?.groups.find((group) =>
          group.locked !== "no-drop-target"
        );
        api?.addPanel({
          ...detail,
          position: {
            direction: group?.id ? "within" : "right",
            referenceGroup: group?.id,
          },
          minimumWidth: 300,
          initialWidth: group?.width || 400,
          floating: false,
        });
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
    <DockviewReact
      key={key}
      components={COMPONENTS}
      tabComponents={TAB_COMPONENTS}
      defaultTabComponent={TAB_COMPONENTS.default}
      onReady={handleReady}
      className="h-full w-full dockview-theme-abyss deco-dockview-container"
      singleTabMode="fullwidth"
      disableTabsOverflowList
      disableFloatingGroups
      hideBorders
    />
  );
}

export default Agent;
