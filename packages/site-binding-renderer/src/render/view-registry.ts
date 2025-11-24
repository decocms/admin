import { ContentBlock, SITE_BINDING } from '../bindings/site.js';

export interface ViewProps<T = any> {
    data: T;
    block: ContentBlock;
}

// A View is a function that takes props and returns a string (HTML) or some other renderable node.
// For the core renderer, we'll assume it returns a string or a Promise<string> for SSR,
// or a DOM element for client-side (though we might need an adapter for that).
// To keep it generic, we'll say it returns `any` and the specific adapter handles the result.
export type ViewImplementation<T = any, R = any> = (props: ViewProps<T>) => R | Promise<R>;

// Interface for MCP client (minimal)
export interface SiteMcpClient {
    callTool(name: string, args: any): Promise<any>;
}

export class ViewRegistry<R = any> {
    private views = new Map<string, ViewImplementation<any, R>>();

    register(key: string, view: ViewImplementation<any, R>) {
        this.views.set(key, view);
    }

    get(key: string): ViewImplementation<any, R> | undefined {
        return this.views.get(key);
    }

    // Helper to resolve view for a block
    resolve(block: ContentBlock): ViewImplementation<any, R> | undefined {
        // 1. Try specific viewId if present
        if (block.viewId) {
            const view = this.views.get(block.viewId);
            if (view) return view;
        }

        // 2. Try content type
        return this.views.get(block.contentType);
    }

    /**
     * Load views dynamically from the MCP server's LIST_VIEWS tool.
     * This enables using views authored in DecoCMS.
     */
    async loadViewsFromMcp(client: SiteMcpClient): Promise<void> {
        try {
            const result = await client.callTool(SITE_BINDING.tools.LIST_VIEWS.name, {});

            if (!result.views || !Array.isArray(result.views)) {
                console.warn('LIST_VIEWS returned no views');
                return;
            }

            for (const viewDef of result.views) {
                const { key, code, contentType } = viewDef;

                if (!key || !code) {
                    console.warn('Invalid view definition:', viewDef);
                    continue;
                }

                try {
                    // Create a function from the view code
                    // The code should export a function that takes ViewProps
                    const viewFn = new Function('props', `
                        const { data, block } = props;
                        ${code}
                    `) as ViewImplementation<any, R>;

                    // Register by key
                    this.register(key, viewFn);

                    // Also register by contentType if provided
                    if (contentType) {
                        this.register(contentType, viewFn);
                    }

                    console.log(`✓ Loaded view: ${key}${contentType ? ` (${contentType})` : ''}`);
                } catch (error) {
                    console.error(`Failed to load view ${key}:`, error);
                }
            }

            console.log(`Loaded ${result.views.length} views from MCP`);
        } catch (error) {
            console.error('Failed to load views from MCP:', error);
            throw error;
        }
    }
}
