/*
  Helper script: fetch tools list from deployed worker and print JSON (name + schemas).
  Usage:
    npx ts-node ./scripts/self-tools.ts "https://seo-ecommerce.ggstv-fer.workers.dev"
*/

// Allow running under ts-node without full type setup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function main(base = process.argv[2]) {
  if (!base) {
    console.error("Missing base URL argument");
    process.exit(1);
  }
  const listUrl = `${base.replace(/\/$/, "")}/mcp/tools`;
  const res = await fetch(listUrl);
  if (!res.ok) {
    console.error("Failed to list tools", res.status, await res.text());
    process.exit(1);
  }
  const json = await res.json();
  // Expect shape { tools: [{name, inputSchema, outputSchema, description?}, ...] }
  const simplified = json.tools?.map((t: any) => ({
    name: t.name,
    description: t.description,
    inputKeys: Object.keys(t.inputSchema?.properties || {}),
    outputKeys: Object.keys(t.outputSchema?.properties || {}),
  }));
  console.log(JSON.stringify(simplified, null, 2));
}

main();
