export const IMAGE_REGEXP = /\.png|\.jpg|\.jpeg|\.gif|\.webp/;

const safeParse = (content: string) => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

export const toIframeProps = (content: string) => {
  if (Array.isArray(content)) {
    const parsed = safeParse(content[0]?.text);

    if (parsed && typeof parsed.entrypoint === "string") {
      return {
        src: parsed.entrypoint,
      };
    }
  }

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

// TODO: Change to use a dialog instead of removed docked panel
export const openPreviewPanel = (
  _id: string,
  _content: string,
  _title: string,
) => {
  throw new Error("Could not open preview");
  // togglePanel({
  //   id,
  //   component: "preview",
  //   title,
  //   params: toIframeProps(content),
  // });
};
