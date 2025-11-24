import { Page, ContentBlock, SITE_BINDING } from '../bindings/site.js';
import { ViewRegistry } from './view-registry.js';

// Interface for the MCP Client that the renderer needs
export interface SiteMcpClient {
    callTool(name: string, args: any): Promise<any>;
}

export interface RenderOptions<R = any> {
    client: SiteMcpClient;
    registry: ViewRegistry<R>;
    path: string;
    // Optional: hook to render a wrapper around blocks or the page
    renderPage?: (page: Page, blocks: R[]) => R;
}

export async function renderPath<R = any>(options: RenderOptions<R>): Promise<R | null> {
    const { client, registry, path, renderPage } = options;

    // 1. Fetch Page Content
    const result = await client.callTool(SITE_BINDING.tools.GET_PAGE_CONTENT_FOR_PATH.name, { path });
    const page = result.page as Page | null;

    if (!page) {
        return null;
    }

    // 2. Render Blocks
    const renderedBlocks: R[] = [];

    for (const block of page.blocks) {
        // Resolve Input
        let input = block.input || {};

        if (block.inputType === 'dynamic') {
            // If dynamic, the input might describe WHICH tool to call, or we might need a convention.
            // The spec says: "if block is dynamic, call its bound tool to get data."
            // But the Block definition in the binding doesn't explicitly say *which* tool.
            // We'll assume for v0 that the `input` contains the tool call details or 
            // the block's `contentType` implies a specific getter.

            // Let's assume a convention for now based on the spec:
            // "each block has a View implementation... a block’s input comes either from: a tool call... or static config"

            // If the block input has a special structure for tool calls, we use it.
            // For simplicity in v0, let's assume `block.input` contains `{ tool: string, args: any }` if dynamic.
            if (input.tool && input.args) {
                try {
                    input = await client.callTool(input.tool, input.args);
                } catch (e) {
                    console.error(`Failed to fetch data for block ${block.id}`, e);
                    input = { error: 'Failed to load data' };
                }
            }
        }

        // Resolve View
        const View = registry.resolve(block);

        if (View) {
            const rendered = await View({ data: input, block });
            renderedBlocks.push(rendered);
        } else {
            console.warn(`No view found for block ${block.id} (type: ${block.contentType})`);
            // Optionally render a placeholder or nothing
        }
    }

    // 3. Assemble Page
    if (renderPage) {
        return renderPage(page, renderedBlocks);
    }

    // Default: return the blocks as a list (or joined string if R is string)
    // This part depends on R. If R is string (HTML), we join them.
    // If R is generic, we might return an array, but the return type is R | null.
    // We'll assume the caller handles assembly if they don't provide renderPage, 
    // OR we enforce R to be something combinable.

    // For the purpose of this generic renderer, let's assume R is "something that represents the page output".
    // If renderPage is missing, we can't easily combine R[].
    // So we'll require renderPage OR assume R is an array.
    // But the signature returns R.

    // Let's change the signature slightly to be more flexible or default to array.
    // Actually, for HTML (SSR), we want a string. For DOM (Client), we might want a fragment.

    // Let's just return the array of rendered blocks if no renderPage is provided, casting to R.
    // This is a bit loose but flexible.
    return renderedBlocks as unknown as R;
}
