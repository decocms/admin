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
  type DockviewPanelApi,
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
import { useAgentRoot, useUpdateAgent, useWriteFile, API_SERVER_URL, useAgent, useDirectory } from "@deco/sdk";

interface Props {
  agentId?: string;
  threadId?: string;
}

interface PreviewPanelParams {
  agentId: string;
  srcDoc?: string;
  src?: string;
  title?: string;
}

interface PreviewPanelApi extends DockviewPanelApi {
  component: string;
}

interface SaveViewButtonProps {
  isSaving: boolean;
  onSave: () => void;
}

function SaveViewButton({ isSaving, onSave }: SaveViewButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSave}
      disabled={isSaving}
      className="gap-2"
    >
      {isSaving ? (
        <>
          <Icon name="spinner" className="animate-spin" />
          Saving...
        </>
      ) : (
        <>
          <Icon name="save" />
          Save View
        </>
      )}
    </Button>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      className="p-1 h-6 w-6"
      variant="ghost"
      size="icon"
      onClick={onClick}
    >
      <Icon name="close" size={12} />
    </Button>
  );
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
      {props.api.component === "chat" || props.api.component === "preview"
        ? <Component {...props.params} />
        : (
          <ScrollArea className="h-full w-full">
            <Component {...props.params} />
          </ScrollArea>
        )}
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
    const api = props.api as unknown as PreviewPanelApi;
    if (api.component === "chat") {
      return null;
    }

    const [isSaving, setIsSaving] = useState(false);
    
    const agentId = props.params?.agentId;
    const srcDoc = props.params?.srcDoc;
    const src = props.params?.src;
    const title = props.params?.title;

    const agentRoot = useAgentRoot(agentId);
    const { data: agent } = useAgent(agentId);
    const writeFile = useWriteFile();
    const updateAgent = useUpdateAgent();
    const { data: viewsDir } = useDirectory(`${agentRoot}/views`);

    const handleSave = async () => {
      if (!agentId || !title) return;

      setIsSaving(true);
      try {
        let viewUrl: string;

        if (srcDoc) {
          // if theres no views directory, create it
          if (!viewsDir) {
            await writeFile.mutateAsync({
              path: `${agentRoot}/views`,
              content: "",
            });
          }

          // 1. Write the HTML file to the views directory
          const viewPath = `${agentRoot}/views/${title.toLowerCase().replace(/\s+/g, "-")}.html`;
          const content = srcDoc;

          await writeFile.mutateAsync({
            path: viewPath,
            content,
          });

          viewUrl = `${API_SERVER_URL}${viewPath}`;
        } else if (src) {
          viewUrl = src;
        } else {
          return;
        }

        // 2. Update the agent's views array
        const updatedViews = [...(agent?.views || []), { url: viewUrl, name: title }];
        const updatedAgent = {
          ...agent,
          views: updatedViews,
        };

        await updateAgent.mutateAsync(updatedAgent);
      } catch (error) {
        console.error("Error saving view:", error);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <p className="text-sm">{title}</p>
        <div className="flex items-center gap-2">
          {api.component === "preview" && (srcDoc || src) && (
            <SaveViewButton
              isSaving={isSaving}
              onSave={handleSave}
            />
          )}
          <CloseButton onClick={() => api.close()} />
        </div>
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
