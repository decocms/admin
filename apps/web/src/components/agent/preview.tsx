import { callTool, useIntegration } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  type DetailedHTMLProps,
  type IframeHTMLAttributes,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router";
import { ALLOWANCES } from "../../constants.ts";
import { IMAGE_REGEXP } from "../chat/utils/preview.ts";
import { createChannel } from "bidc";
import { useEffect } from "react";
import * as z from "zod";
import { ReissueApiKeyDialog } from "../api-keys/reissue-api-key-dialog.tsx";

const MessageSchema = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("request_missing_scopes"),
      payload: z.object({
        scopes: z.array(z.string()),
      }),
    }),
  ]),
);

type Message = z.infer<typeof MessageSchema>;

type Props = DetailedHTMLProps<
  IframeHTMLAttributes<HTMLIFrameElement>,
  HTMLIFrameElement
>;

type ReissueKeyDialogProps = {
  open: boolean;
  integrationId: string;
  missingScopes: string[];
};

function PreviewIframe(_props: Props) {
  const props = { ..._props, src: "https://teste-camudo-workflowz.deco.page/" };
  const id = `preview-iframe-${props.src}`;
  const channelRef = useRef<ReturnType<typeof createChannel>>(null);
  const [reissueKeyDialogProps, setReissueKeyDialogProps] =
    useState<ReissueKeyDialogProps | null>(null);
  const { integrationId } = useParams();

  useEffect(() => {
    if (!integrationId) {
      console.warn("No integration ID found");
      return;
    }
    const iframe = document.getElementById(id) as HTMLIFrameElement;

    if (!iframe || !iframe.contentWindow) {
      console.warn("No iframe or content window found");
      return;
    }

    const channel = createChannel(iframe.contentWindow);
    channelRef.current = channel;

    const { receive, cleanup } = channel;

    receive((message) => {
      const parsed = MessageSchema.safeParse(message);
      if (!parsed.success) {
        console.warn("Invalid message", message);
        return;
      }
      const { type, payload } = parsed.data;
      if (type === "request_missing_scopes") {
        setReissueKeyDialogProps({
          open: true,
          missingScopes: ["INTEGRATIONS_LIST"], // payload.scopes,
          integrationId,
        });
      }
    });

    return () => {
      cleanup();
    };
  }, []);

  return (
    <>
      {reissueKeyDialogProps && (
        <ReissueApiKeyDialog
          open={reissueKeyDialogProps.open}
          onOpenChange={(open) =>
            setReissueKeyDialogProps((p) => (p ? { ...p, open } : null))
          }
          integrationId={reissueKeyDialogProps.integrationId}
          newPolicies={reissueKeyDialogProps.missingScopes.map((scope) => ({
            effect: "allow",
            resource: scope,
          }))}
          onReissued={() => {}}
        />
      )}
      <iframe
        id={id}
        allow={ALLOWANCES}
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
        className="w-full h-full"
        {...props}
      />
    </>
  );
}

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

  return <PreviewIframe {...props} />;
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

export default Preview;
