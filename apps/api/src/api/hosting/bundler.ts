/**
 * Bundles the given files into a single string.
 *
 * @param files - A record of file paths to their content.
 * @param entrypoint - The entrypoint file path.
 * @returns The bundled code as a string.
 */
export const bundler = async (
  files: Record<string, string>,
  entrypoint: string = "index.ts",
): Promise<string> => {
  const response = await fetch(
    "https://mcp.deco.site/live/invoke/js-bundler/actions/build.ts",
    {
      method: "POST",
      body: JSON.stringify({ files, entrypoint }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to bundle");
  }

  const responseJson: { base64: string } = await response.json();
  return atob(responseJson.base64);
};
