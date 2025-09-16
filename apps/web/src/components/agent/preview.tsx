import type { Agent } from "@deco/sdk";
import { callTool, useIntegration } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  type DetailedHTMLProps,
  type IframeHTMLAttributes,
  useMemo,
  useState,
} from "react";
import { useParams } from "react-router";
import { ALLOWANCES } from "../../constants.ts";
import { IMAGE_REGEXP } from "../chat/utils/preview.ts";
import type { Tab } from "../dock/index.tsx";

type Props = DetailedHTMLProps<
  IframeHTMLAttributes<HTMLIFrameElement>,
  HTMLIFrameElement
>;

function Preview(props: Props) {
  const isImageLike = props.src && IMAGE_REGEXP.test(props.src);

  if (isImageLike) {
    return (
      <img
        src={props.src}
        alt="Preview"
        className="w-full h-full object-contain"
      />
    );
  }

  // Internal fallback removed; views should provide concrete URLs or use dynamic route

  return (
    <iframe
      allow={ALLOWANCES}
      allowFullScreen
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
      className="w-full h-full"
      {...props}
    />
  );
}

function _InternalResourceDetail({ name, uri }: { name: string; uri: string }) {
  const { integrationId } = useParams();
  if (!integrationId) return null;
  return (
    <InternalResourceDetailWithIntegration
      name={name}
      uri={uri}
      integrationId={integrationId}
    />
  );
}

function InternalResourceDetailWithIntegration({
  name,
  uri,
  integrationId,
}: {
  name: string;
  uri: string;
  integrationId: string;
}) {
  const integration = useIntegration(integrationId).data;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<{
    data?: string;
    type?: "text" | "blob";
    mimeType?: string;
  } | null>(null);

  async function read() {
    setLoading(true);
    setError(null);
    try {
      const conn = integration?.connection;
      const target = conn ? { connection: conn } : ({} as never);
      const result = (await callTool(target as never, {
        name: "DECO_CHAT_RESOURCES_READ",
        arguments: { name, uri },
      })) as {
        structuredContent?: {
          data?: string;
          type?: "text" | "blob";
          mimeType?: string;
        } | null;
      };
      const sc = result.structuredContent ?? null;
      setContent(sc ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useState(() => {
    if (uri) read();
  });

  if (!uri) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Missing resource URI
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Icon name="hourglass_empty" /> Loading…
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">{error}</div>;
  }

  if (!content) {
    return null;
  }

  if (content.type === "text") {
    return (
      <div className="p-4">
        <textarea
          className="w-full h-[60vh] border rounded p-2 text-sm bg-background"
          defaultValue={content.data ?? ""}
        />
      </div>
    );
  }

  const dataUrl = `data:${
    content.mimeType ?? "application/octet-stream"
  };base64,${content.data ?? ""}`;
  return (
    <div className="p-4">
      <iframe src={dataUrl} className="w-full h-[70vh] border rounded" />
      <div className="mt-2">
        <a href={dataUrl} download>
          <Button size="sm">Download</Button>
        </a>
      </div>
    </div>
  );
}

export function useTabsForAgent(
  agent: Agent | undefined,
  baseTabs: Record<string, Tab>,
) {
  // Create dynamic tabs for agent views
  const dynamicViewTabs = useMemo(() => {
    if (!agent?.views?.length) return {};

    const viewTabs: Record<string, Tab> = {};
    agent.views.forEach((view, index) => {
      const tabKey = `view-${index}`;
      viewTabs[tabKey] = {
        Component: () => <Preview src={view.url} title={view.name} />,
        title: view.name,
        initialOpen: index === 0 ? "within" : false, // Open first view by default
        active: index === 0,
        metadata: {
          isSavedView: true,
        },
      };
    });
    return viewTabs;
  }, [agent?.views]);

  // Combine static tabs with dynamic view tabs, placing views after chat
  const allTabs = useMemo(() => {
    const hasViews = Object.keys(dynamicViewTabs).length > 0;

    // If we have views, close all base tabs so only the first view is open
    const tabs = hasViews
      ? Object.fromEntries(
          Object.entries(baseTabs).map(([key, tab]) => [
            key,
            { ...tab, initialOpen: false },
          ]),
        )
      : { ...baseTabs };

    // Insert view tabs after chat tab
    if (hasViews) {
      const tabEntries = Object.entries(tabs);
      const chatIndex = tabEntries.findIndex(([key]) => key === "chat");

      if (chatIndex !== -1) {
        // Split tabs at chat position and insert view tabs after
        const beforeChat = tabEntries.slice(0, chatIndex + 1);
        const afterChat = tabEntries.slice(chatIndex + 1);

        return Object.fromEntries([
          ...beforeChat,
          ...Object.entries(dynamicViewTabs),
          ...afterChat,
        ]);
      }
    }

    return tabs;
  }, [baseTabs, dynamicViewTabs]);

  return allTabs;
}

export default Preview;
