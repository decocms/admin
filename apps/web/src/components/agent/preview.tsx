import { DetailedHTMLProps, IframeHTMLAttributes, useMemo } from "react";
import { useParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import {
  useAgent,
  useAgentRoot,
  useDeleteFile,
  useUpdateAgent,
  useWriteFile,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { ALLOWANCES } from "../../constants.ts";
import { IMAGE_REGEXP, togglePreviewPanel } from "../chat/utils/preview.ts";

const getAgentViewFilepath = (root: string) => [root, "views"].join("/");

/**
 * @description hook that returns pin agent UI view.
 * If the agent has a view file with the pathname, update it.
 * Otherwise, create a file.
 */
const usePinAgentUI = (
  { agentId, src: propSrc }: { agentId: string; src?: string },
) => {
  const agent = useAgent(agentId);
  const updateAgent = useUpdateAgent();
  const writeFile = useWriteFile();
  const deleteFile = useDeleteFile();
  const agentRoot = useAgentRoot(agent.data?.id);
  const isPinned = useMemo(
    () => agent.data.views.some((v) => v.url === propSrc),
    [propSrc, agent.data],
  );
  const handlePinAgentUI = useMutation({
    mutationFn: async ({ content, title, src: propSrc }: {
      content?: string;
      src?: string;
      title: string;
    }) => {
      if (!agent || !agentId) return;
      let src = propSrc;
      try {
        // First, create or update the file
        if (content) {
          const filePath = [
            getAgentViewFilepath(agentRoot),
            `${title.toLowerCase().replace(/\s+/g, "-")}.html`,
          ]
            .join("/");
          await writeFile.mutateAsync({
            path: filePath,
            content,
            // Add security mode?
            options: { encoding: "utf-8", ensureDir: true },
          });

          src = new URL(filePath, "https://fs.deco.chat/").href;
        }

        // Then update the agent with the view reference
        const updatedAgent = await updateAgent.mutateAsync({
          ...agent.data,
          views: [
            ...agent.data.views.filter((view) => view.url !== src),
            {
              // How get file url
              url: src ?? "",
              name: title,
            },
          ],
        });

        return { success: true, agent: updatedAgent };
      } catch (error) {
        console.error("Failed to pin agent UI:", error);
        return { success: false, error };
      }
    },
  });

  const handleUnpingAgentUI = useMutation({
    mutationFn: async ({ title, src }: { src: string; title: string }) => {
      togglePreviewPanel(`agent-${agentId}-view-${title}`, "", title);
      await deleteFile.mutateAsync({ path: new URL(src).pathname });
      return await updateAgent.mutateAsync({
        ...agent.data,
        views: [
          ...agent.data.views.filter((view) => view.url !== src),
        ],
      });
    },
  });

  return { handlePinAgentUI, handleUnpingAgentUI, isPinned };
};

interface Props extends
  DetailedHTMLProps<
    IframeHTMLAttributes<HTMLIFrameElement>,
    HTMLIFrameElement
  > {
  title: string;
}

function Preview(props: Props) {
  const { src, title, srcDoc } = props;
  const isImageLike = src && IMAGE_REGEXP.test(src);

  const { id: agentId } = useParams();
  const { handlePinAgentUI, handleUnpingAgentUI, isPinned } = usePinAgentUI({
    agentId: agentId ?? "",
    src,
  });

  if (isImageLike) {
    return (
      <img
        src={props.src}
        alt="Preview"
        className="w-full h-full object-contain"
      />
    );
  }

  const isPending = handlePinAgentUI.isPending || handleUnpingAgentUI.isPending;

  return (
    <div className="h-full w-full relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="absolute right-4"
        disabled={isPending}
        onClick={() =>
          isPinned
            ? handleUnpingAgentUI.mutateAsync({ src: src ?? "", title })
            : handlePinAgentUI.mutateAsync({
              content: srcDoc,
              src,
              title,
            })}
      >
        {isPending ? <Spinner /> : (
          <Icon
            name="keep"
            filled={isPinned}
            size={16}
            className="rotate-45"
          />
        )}
      </Button>
      <iframe
        allow={ALLOWANCES}
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        className="w-full h-full"
        {...props}
      />
    </div>
  );
}

export default Preview;
