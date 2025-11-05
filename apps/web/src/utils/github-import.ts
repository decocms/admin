const GITHUB_SLUG_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function extractSlugFromGithubUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname.endsWith("github.com")) {
      return undefined;
    }

    const segments = parsed.pathname
      .split("/")
      .filter((segment) => segment.length > 0);

    if (segments.length === 0) {
      return undefined;
    }

    const slug = segments.slice(0, 2).join("/");
    if (!GITHUB_SLUG_REGEX.test(slug)) {
      return undefined;
    }

    return slug;
  } catch {
    return undefined;
  }
}

export interface NormalizedGithubImportValue {
  slug?: string;
  url?: string;
}

export function normalizeGithubImportValue(
  value?: string | null,
): NormalizedGithubImportValue {
  if (!value) {
    return {};
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }

  if (GITHUB_SLUG_REGEX.test(trimmed)) {
    return {
      slug: trimmed,
      url: `https://github.com/${trimmed}`,
    };
  }

  const slug = extractSlugFromGithubUrl(trimmed);
  if (slug) {
    return {
      slug,
      url: `https://github.com/${slug}`,
    };
  }

  return {
    slug: undefined,
    url: trimmed,
  };
}

