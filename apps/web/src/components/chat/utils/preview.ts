import { togglePanel } from "../../dock/index.tsx";

export const toIframeProps = (content: string) => {
  try {
    const url = new URL(content);

    return {
      src: url.href,
    };
  } catch {
    const html = new DOMParser().parseFromString(content, "text/html")
      .documentElement.outerHTML;

    return {
      srcDoc: html,
    };
  }
};

export const openPreviewPanel = (
  id: string,
  content: string,
  title: string,
) => {
  togglePanel({
    id,
    component: "preview",
    title,
    params: toIframeProps(content),
  });
};
