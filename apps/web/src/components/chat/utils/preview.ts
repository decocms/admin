import { openPanel, togglePanel } from "../../dock/index.tsx";

export const IMAGE_REGEXP = /\.png|\.jpg|\.jpeg|\.gif|\.webp/;

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

export const togglePreviewPanel = (
  id: string,
  content: string,
  title: string,
) => {
  togglePanel({
    id,
    component: "preview",
    title,
    params: { title, ...toIframeProps(content) },
  });
};

export const openPreviewPanel = (
  { content, id, title }: {
    content: string;
    id: string;
    title: string;
  },
) => {
  openPanel({
    id,
    component: "preview",
    title,
    params: { title, ...toIframeProps(content) },
  });
};
