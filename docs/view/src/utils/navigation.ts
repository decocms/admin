import { getCollection } from "astro:content";

export interface NavigationLink {
  title: string;
  description?: string;
  href: string;
}

export async function getNavigationLinks(
  currentDocId: string,
  locale: string,
): Promise<{ previous?: NavigationLink; next?: NavigationLink }> {
  const allDocs = await getCollection("docs");
  const docs = allDocs.filter((doc) => doc.id.split("/")[0] === locale);

  // Sort docs by their path for consistent ordering
  const sortedDocs = docs.sort((a, b) => {
    const aPath = a.id.split("/").slice(1).join("/");
    const bPath = b.id.split("/").slice(1).join("/");
    return aPath.localeCompare(bPath);
  });

  const currentIndex = sortedDocs.findIndex((doc) => doc.id === currentDocId);

  if (currentIndex === -1) {
    return {};
  }

  const previous = currentIndex > 0 ? sortedDocs[currentIndex - 1] : undefined;
  const next = currentIndex < sortedDocs.length - 1
    ? sortedDocs[currentIndex + 1]
    : undefined;

  return {
    previous: previous
      ? {
        title: previous.data.title,
        description: previous.data.description,
        href: `/${locale}/${previous.id.split("/").slice(1).join("/")}`,
      }
      : undefined,
    next: next
      ? {
        title: next.data.title,
        description: next.data.description,
        href: `/${locale}/${next.id.split("/").slice(1).join("/")}`,
      }
      : undefined,
  };
}
